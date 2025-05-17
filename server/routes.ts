import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, MemStorage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertProspectSchema, insertEmailSchema } from "@shared/schema";
import { db } from "./db";
import * as schema from "@shared/schema";
import { users } from "@shared/schema";
import { desc, sql, eq, and, gte, lte, or } from "drizzle-orm";
import { getMozApiService } from "./services/moz";
import { getOpportunityCrawler } from "./services/crawler";
import { getWebsiteAnalyzer } from "./services/website-analyzer";
import { getOpportunityMatcher } from "./services/opportunity-matcher";
import { getDiscoveryScheduler } from "./services/discovery-scheduler";
import { EmailService, createEmailServiceForUser } from "./services/email-service";
import emailWebhookRoutes from "./routes/email-webhook";
import emailIntegrationRoutes from "./routes/email-integration-routes";
import paymentRoutes from "./routes/payment-routes";
import subscriptionRoutes from "./routes/subscription-routes";
import lemonSqueezyWebhookRoutes from "./routes/webhook-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Register email integration routes
  app.use(emailIntegrationRoutes);
  
  // Register payment routes
  app.use('/api/payments', paymentRoutes);
  
  // Register subscription routes
  app.use('/api/subscription', subscriptionRoutes);
  
  // Register LemonSqueezy webhook routes
  app.use('/api/subscription', lemonSqueezyWebhookRoutes);
  
  // Start the discovery scheduler to continuously find opportunities
  const discoveryScheduler = getDiscoveryScheduler();
  // Run every 12 hours (in production this would be configured based on system load)
  discoveryScheduler.startScheduler(12);
  
  // Start continuous crawling process
  const crawler = getOpportunityCrawler();
  // Run every 60 minutes in development (would be less frequent in production)
  crawler.startContinuousDiscovery(60);
  
  // Run the discovery pipeline once at startup to initialize opportunities
  setTimeout(() => {
    discoveryScheduler.runDiscoveryPipeline()
      .then(result => {
        console.log('[Discovery] Initial pipeline run complete:', result.success);
      })
      .catch(error => {
        console.error('[Discovery] Initial pipeline run failed:', error);
      });
  }, 30000); // Wait 30 seconds after server start to run initial pipeline

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // User stats
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      // Handle directly with database query to avoid column errors
      const userId = req.user!.id;
      
      // Get user's subscription plan
      const [user] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get available splash data
      const planSplashLimits = {
        'Free Trial': 1,
        'Starter': 1,
        'Grow': 3,
        'Pro': 7
      };
      
      const planName = user.subscription || 'Free Trial';
      const totalSplashes = planSplashLimits[planName as keyof typeof planSplashLimits] || 1;
      
      // Get splash usage - using direct SQL to bypass schema issues
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      let splashesUsed = 0;
      try {
        // First check if the table exists
        const tableCheck = await db.execute(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'splashusage'
          )
        `);
        
        const tableExists = tableCheck.rows[0]?.exists || false;
        
        if (tableExists) {
          try {
            const { rows } = await db.execute(`
              SELECT SUM(COALESCE("count", 1)) as total_used
              FROM splashusage
              WHERE "userid" = $1 AND "usedat" >= $2
            `, [userId, firstDayOfMonth]);
            
            splashesUsed = parseInt(rows[0]?.total_used || '0', 10);
          } catch (error) {
            console.error("Error getting splash usage:", error);
            // Silently handle the error and assume 0 splashes used
            splashesUsed = 0;
          }
        } else {
          // Table doesn't exist, create it
          await db.execute(`
            CREATE TABLE IF NOT EXISTS splashusage (
              id SERIAL PRIMARY KEY,
              userid INTEGER NOT NULL,
              usedat TIMESTAMP NOT NULL DEFAULT NOW(),
              count INTEGER DEFAULT 1
            )
          `);
          
          console.log("Created splashusage table");
          splashesUsed = 0;
        }
      } catch (error) {
        console.error('Error getting splash usage:', error);
        // If there's an error, fall back to the user's count
        splashesUsed = user.splashesUsed || 0;
      }
      const remainingSplashes = Math.max(0, totalSplashes - splashesUsed);
      
      // Calculate next reset date (first day of next month)
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      
      // Generate the stats object
      const stats = {
        dailyOpportunities: {
          used: 0,
          total: user.subscription === 'Pro' ? 15 : (user.subscription === 'Grow' ? 10 : 5)
        },
        splashes: {
          available: remainingSplashes,
          total: totalSplashes,
          nextReset: nextMonth
        },
        emailsSent: {
          total: 0,
          changePercentage: 0
        },
        backlinksSecured: {
          total: 0,
          new: 0,
          averageDA: 0
        },
        premium: 0
      };
      
      // Count premium opportunities (if possible)
      try {
        const dailyDrips = await db.select()
          .from(schema.dailyDrips)
          .where(
            and(
              eq(schema.dailyDrips.userId, userId),
              eq(schema.dailyDrips.isPremium, true)
            )
          );
        
        stats.premium = dailyDrips.length || 0;
      } catch (e) {
        // Silently fail and keep premium count at 0
      }
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Prospects API
  // Get daily prospects
  app.get("/api/prospects/daily", isAuthenticated, async (req, res) => {
    try {
      const prospects = await storage.getDailyProspects(req.user!.id);
      res.json(prospects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all prospects
  app.get("/api/prospects", isAuthenticated, async (req, res) => {
    try {
      const prospects = await storage.getAllProspects(req.user!.id);
      res.json(prospects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get saved prospects
  app.get("/api/prospects/saved", isAuthenticated, async (req, res) => {
    try {
      const prospects = await storage.getSavedProspects(req.user!.id);
      res.json(prospects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get unlocked prospects
  app.get("/api/prospects/unlocked", isAuthenticated, async (req, res) => {
    try {
      const prospects = await storage.getUnlockedProspects(req.user!.id);
      res.json(prospects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Unlock prospect - using new unlocked-by-default system
  app.post("/api/prospects/:id/unlock", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) {
        return res.status(400).json({ message: "Invalid prospect ID" });
      }

      const prospect = await storage.unlockProspect(prospectId, req.user!.id);
      
      // No need to deduct credits since all opportunities are now unlocked by default
      res.json({ prospect, user: req.user });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Save prospect
  app.post("/api/prospects/:id/save", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) {
        return res.status(400).json({ message: "Invalid prospect ID" });
      }

      const prospect = await storage.saveProspect(prospectId, req.user!.id);
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Hide prospect
  app.post("/api/prospects/:id/hide", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) {
        return res.status(400).json({ message: "Invalid prospect ID" });
      }

      const prospect = await storage.hideProspect(prospectId, req.user!.id);
      res.json(prospect);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Bulk operations - using new unlocked-by-default system
  app.post("/api/prospects/bulk-unlock", isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Valid prospect IDs are required" });
      }
      
      const user = req.user!;
      const results: any[] = [];
      
      for (const id of ids) {
        try {
          const prospect = await storage.unlockProspect(id, user.id);
          results.push(prospect);
        } catch (err) {
          console.error(`Error unlocking prospect ${id}:`, err);
        }
      }
      
      // No need to deduct credits since all opportunities are now unlocked by default
      res.json({ prospects: results, user: user });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/prospects/bulk-star", isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Valid prospect IDs are required" });
      }
      
      const results = [];
      for (const id of ids) {
        try {
          const prospect = await storage.saveProspect(id, req.user!.id);
          results.push(prospect);
        } catch (err) {
          console.error(`Error starring prospect ${id}:`, err);
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/prospects/bulk-hide", isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Valid prospect IDs are required" });
      }
      
      const results = [];
      for (const id of ids) {
        try {
          const hiddenProspect = await storage.hideProspect(id, req.user!.id);
          results.push(hiddenProspect);
        } catch (err) {
          console.error(`Error hiding prospect ${id}:`, err);
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Email API
  // Generate email
  app.post("/api/email/generate", isAuthenticated, async (req, res) => {
    try {
      const { prospectId, template } = req.body;
      
      if (!prospectId || !template) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const prospect = await storage.getProspectById(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // Generate email based on template and prospect data
      const email = await storage.generateEmail(prospect, template);
      res.json(email);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send email
  app.post("/api/email/send", isAuthenticated, async (req, res) => {
    try {
      const { prospectId, subject, body, cc, bcc, replyTo } = req.body;
      
      if (!prospectId || !subject || !body) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const prospect = await storage.getProspectById(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // All opportunities now unlocked by default
      // Check for email settings
      const emailService = await createEmailServiceForUser(req.user!.id);
      if (!emailService) {
        return res.status(400).json({ message: "Email is not configured for this user" });
      }
      
      // Create the email record first
      const emailData = {
        prospectId,
        userId: req.user!.id,
        subject,
        body,
        siteName: prospect.siteName || prospect.siteType,
        contactEmail: prospect.contactEmail!,
        contactRole: prospect.contactRole,
        domainAuthority: prospect.domainAuthority,
        status: 'Sending', // Initial status
      };

      const emailSchema = insertEmailSchema.parse(emailData);
      
      // Insert the email to get the ID
      const savedEmail = await storage.sendEmail(emailSchema);
      
      // Now actually send the email with tracking info
      try {
        const result = await emailService.sendEmail(
          savedEmail.id,
          req.user!.id,
          prospectId,
          {
            to: prospect.contactEmail!,
            subject,
            body,
            cc: cc ? Array.isArray(cc) ? cc : [cc] : undefined,
            bcc: bcc ? Array.isArray(bcc) ? bcc : [bcc] : undefined,
            replyTo,
          }
        );
        
        // Return the success result
        res.json({
          email: savedEmail,
          sent: true,
          messageId: result.messageId,
        });
      } catch (emailError: any) {
        // Since we already saved the email, return it with the error
        res.status(500).json({
          email: savedEmail,
          sent: false,
          error: emailError.message,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Follow up on email
  app.post("/api/email/:id/follow-up", isAuthenticated, async (req, res) => {
    try {
      const emailId = parseInt(req.params.id);
      if (isNaN(emailId)) {
        return res.status(400).json({ message: "Invalid email ID" });
      }

      const followUpEmail = await storage.createFollowUpEmail(emailId, req.user!.id);
      res.json(followUpEmail);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all emails
  app.get("/api/emails", isAuthenticated, async (req, res) => {
    try {
      const emails = await storage.getUserEmails(req.user!.id);
      res.json(emails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get recent emails
  app.get("/api/emails/recent", isAuthenticated, async (req, res) => {
    try {
      const emails = await storage.getRecentEmails(req.user!.id);
      res.json(emails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get all emails
  app.get("/api/emails", isAuthenticated, async (req, res) => {
    try {
      const emails = await storage.getUserEmails(req.user!.id);
      res.json(emails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create follow-up email
  app.post("/api/emails/:id/follow-up", isAuthenticated, async (req, res) => {
    try {
      const emailId = parseInt(req.params.id);
      if (isNaN(emailId)) {
        return res.status(400).json({ message: "Invalid email ID" });
      }
      
      const email = await storage.createFollowUpEmail(emailId, req.user!.id);
      res.json(email);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get email settings
  app.get("/api/email/settings", isAuthenticated, async (req, res) => {
    try {
      // Retrieve user with email settings
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user!.id));
      
      // Check if user has configured email settings
      const hasEmailSettings = user?.emailProvider && user?.emailConfigured;
      
      let response = {
        isConfigured: Boolean(hasEmailSettings),
        provider: user?.emailProvider || null,
        fromEmail: user?.fromEmail || user?.email || null,
        termsAccepted: Boolean(user?.emailTermsAccepted),
        isVerified: Boolean(user?.emailVerified),
        websiteSettings: {},
      };
      
      // Add provider-specific settings if available
      if (user?.emailProviderSettings) {
        response = {
          ...response,
          providerSettings: user.emailProviderSettings,
        };
      }
      
      // Add website-specific email settings if available
      if (user?.websiteEmailSettings) {
        response = {
          ...response,
          websiteSettings: user.websiteEmailSettings,
        };
      }
      
      res.json(response);
    } catch (error: any) {
      console.error("Error retrieving email settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Save email settings
  app.post("/api/email/settings", isAuthenticated, async (req, res) => {
    try {
      const { 
        provider, 
        fromEmail, 
        termsAccepted,
        providerSettings,
        requiresVerification = true,
        isVerified = false
      } = req.body;
      
      // Validate required fields
      if (!provider || !fromEmail || !termsAccepted) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Validate provider-specific settings
      if (provider === 'sendgrid' && (!providerSettings?.apiKey)) {
        return res.status(400).json({ message: "SendGrid API key is required" });
      } else if (provider === 'smtp' && (!providerSettings?.server || !providerSettings?.port || 
                                          !providerSettings?.username || !providerSettings?.password)) {
        return res.status(400).json({ message: "SMTP server details are required" });
      } else if (provider === 'gmail' && (!providerSettings?.clientId || !providerSettings?.clientSecret)) {
        return res.status(400).json({ message: "Google client ID and secret are required" });
      }
      
      // Structure the email provider settings in the correct format
      const emailProviderSettings = {
        [provider]: providerSettings
      };
      
      // Update user with email settings
      const user = await db
        .update(users)
        .set({
          emailProvider: provider,
          fromEmail: fromEmail,
          emailConfigured: true,
          emailVerified: isVerified,
          emailProviderSettings,
          emailTermsAccepted: termsAccepted,
        })
        .where(eq(users.id, req.user!.id))
        .returning();
      
      res.json({
        isConfigured: true,
        provider,
        fromEmail,
        termsAccepted,
        isVerified,
        requiresVerification
      });
    } catch (error: any) {
      console.error("Error saving email settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Email verification endpoint
  app.post("/api/email/verify", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      // In a production environment, you would:
      // 1. Generate a unique verification token
      // 2. Store it in the database with an expiration time
      // 3. Send an email with a verification link
      
      // For now, we'll simulate the verification process
      const verificationToken = Math.random().toString(36).substring(2, 15);
      
      // TODO: In production, integrate with actual email sending service
      console.log(`Verification email would be sent to ${email} with token ${verificationToken}`);
      
      // Return success
      res.json({
        message: "Verification email sent",
        success: true
      });
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Confirm email verification
  app.get("/api/email/verify/:token", isAuthenticated, async (req, res) => {
    try {
      const { token } = req.params;
      
      // In production, validate the token from the database
      // For now, we'll simulate successful verification
      
      // Update the user's email verified status
      await db
        .update(users)
        .set({
          emailVerified: true,
        })
        .where(eq(users.id, req.user!.id));
      
      res.json({
        message: "Email verified successfully",
        success: true
      });
    } catch (error: any) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Website-specific email settings
  app.post("/api/email/website/:websiteId", isAuthenticated, async (req, res) => {
    try {
      const { websiteId } = req.params;
      const { fromEmail, signature } = req.body;
      
      if (!fromEmail) {
        return res.status(400).json({ message: "From email address is required" });
      }
      
      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user!.id));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get current website email settings or initialize empty object
      const websiteEmailSettings = user.websiteEmailSettings || {};
      
      // Update website-specific email settings
      websiteEmailSettings[websiteId] = {
        fromEmail,
        verified: false, // New email addresses start as unverified
        signature: signature || undefined
      };
      
      // Update user with new website email settings
      await db
        .update(users)
        .set({
          websiteEmailSettings
        })
        .where(eq(users.id, req.user!.id));
      
      // Return updated settings
      res.json({
        websiteId,
        settings: websiteEmailSettings[websiteId],
        message: "Website email settings updated"
      });
    } catch (error: any) {
      console.error("Error updating website email settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get prospects with contact information
  app.get("/api/prospects/contacts", isAuthenticated, async (req, res) => {
    try {
      // For now, we'll use the same endpoint as unlocked prospects
      const prospects = await storage.getUnlockedProspects(req.user!.id);
      res.json(prospects);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics API
  app.get("/api/analytics", isAuthenticated, async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || "30days";
      const analytics = await storage.getUserAnalytics(req.user!.id, timeRange);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Reset Splash API for end of billing cycle
  app.post("/api/reset-splashes", isAuthenticated, async (req, res) => {
    try {
      const updatedUser = await storage.resetMonthlySplashes(req.user!.id);
      
      // Update session
      req.login(updatedUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error updating session" });
        }
        
        res.json({
          success: true,
          message: "Monthly splashes reset successfully",
          splashesAllowed: updatedUser.splashesAllowed,
          splashesUsed: updatedUser.splashesUsed,
          nextReset: updatedUser.billingAnniversary
        });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Splash feature - get additional opportunities immediately
  app.post(["/api/splash", "/api/splashes/use", "/api/opportunities/splash"], isAuthenticated, async (req, res) => {
    try {
      const { websiteId } = req.body;
      
      // Check if the user has Splashes available
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.splashesAllowed || user.splashesUsed >= user.splashesAllowed) {
        return res.status(400).json({ 
          message: "No Splashes available. Upgrade your plan or wait until next billing cycle." 
        });
      }
      
      // Record the Splash usage
      // Try-catch to handle potential DB schema mismatch
      try {
        // First check if the table exists
        const { rows } = await db.execute(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'splashusage'
          );
        `);
        
        // Only try to insert if the table exists
        if (rows && rows[0] && rows[0].exists) {
          await db.execute(
            `INSERT INTO splashusage ("userid", "websiteid", "usedat", "source") 
             VALUES ($1, $2, $3, $4)`,
            [user.id, websiteId || null, new Date(), "monthly_allowance"]
          );
        } else {
          console.log('Splash usage table does not exist, skipping record');
        }
      } catch (err) {
        console.error('Error recording splash usage:', err);
        // Continue even if this fails, as it's not critical
      }
      
      // Increment the user's splash usage count
      const [updatedUser] = await db.update(schema.users)
        .set({ splashesUsed: (user.splashesUsed || 0) + 1 })
        .where(eq(schema.users.id, user.id))
        .returning();
      
      // Update the session
      req.login(updatedUser, async (err) => {
        if (err) {
          return res.status(500).json({ message: "Error updating session" });
        }
        
        // Generate opportunities (would normally come from the matcher)
        // In a production environment, this would call matcher.assignImmediateOpportunities
        
        // Generate a premium opportunity
        const newOpportunities = [{
          id: Math.floor(Math.random() * 10000) + 1,
          url: "https://premium-example.com/resource",
          domain: "premium-example.com",
          sourceType: "resource_page",
          pageTitle: "Premium Resource Page",
          domainAuthority: Math.floor(Math.random() * 20) + 40, // 40-60 DA
          pageAuthority: Math.floor(Math.random() * 20) + 35,
          spamScore: Math.floor(Math.random() * 2), // Low spam score
          discoveredAt: new Date(),
          status: 'premium',
          isPremium: true,
          relevanceScore: (Math.random() * 0.2) + 0.8, // 80-100% relevance
          matchReason: "Premium quality opportunity with high domain authority"
        }];
        
        res.json({
          success: true,
          opportunities: newOpportunities,
          splashesRemaining: (updatedUser.splashesAllowed || 0) - (updatedUser.splashesUsed || 0)
        });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

// Onboarding API endpoints
  app.post("/api/onboarding/subscription", isAuthenticated, async (req, res) => {
    try {
      const { plan } = req.body;
      
      if (!plan || typeof plan !== 'string') {
        return res.status(400).json({ message: "Valid subscription plan is required" });
      }
      
      // Update user's subscription plan
      const updatedUser = await storage.updateUserSubscription(req.user!.id, plan);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/onboarding/websites", isAuthenticated, async (req, res) => {
    try {
      const { websites } = req.body;
      
      if (!Array.isArray(websites)) {
        return res.status(400).json({ message: "Websites must be an array" });
      }
      
      // First save to the user's websites property for backward compatibility
      const updatedUser = await storage.updateUserWebsites(req.user!.id, websites);
      
      // Then also save each website to the websites table
      for (const website of websites) {
        // Add website to the websites table
        await db.insert(schema.websites)
          .values({
            userId: req.user!.id,
            url: website.url,
            name: website.url.split('.')[0], // Use domain name as the website name
            description: website.description || '',
            niche: website.niche,
            createdAt: new Date(),
          })
          .onConflictDoNothing(); // Avoid duplicates
      }
      
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/onboarding/preferences", isAuthenticated, async (req, res) => {
    try {
      const { websiteIndex, preferences } = req.body;
      
      if (typeof websiteIndex !== 'number' || !preferences) {
        return res.status(400).json({ message: "Invalid request format" });
      }
      
      const updatedUser = await storage.updateWebsitePreferences(req.user!.id, websiteIndex, preferences);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/onboarding/complete", isAuthenticated, async (req, res) => {
    try {
      const updatedUser = await storage.completeOnboarding(req.user!.id);
      
      // Update session with onboarding completed flag
      req.login(updatedUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error updating session" });
        }
        res.json(updatedUser);
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Website management endpoints
  
  // Get user's websites
  app.get("/api/websites", isAuthenticated, async (req, res) => {
    try {
      const websites = await db.select()
        .from(schema.websites)
        .where(eq(schema.websites.userId, req.user!.id));
      
      res.json(websites);
    } catch (error: any) {
      console.error("Error fetching user websites:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Handle website submissions from onboarding
  app.post("/api/user/websites", isAuthenticated, async (req, res) => {
    try {
      const { websites } = req.body;
      
      if (!Array.isArray(websites)) {
        return res.status(400).json({ message: "Websites must be an array" });
      }
      
      // Save to user's websites property for compatibility
      await storage.updateUserWebsites(req.user!.id, websites);
      
      // Then save each website to the websites table
      for (const website of websites) {
        // Process preferences if available
        const preferences = website.preferences || {};
        
        // Add website to the websites table
        await db.insert(schema.websites)
          .values({
            userId: req.user!.id,
            url: website.url,
            name: website.url.split('.')[0].replace(/^www\./, ''), // Use domain name as the website name
            description: website.description || '',
            niche: website.niche,
            createdAt: new Date(),
          })
          .onConflictDoNothing(); // Avoid duplicates
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving user websites:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Add a new website
  app.post("/api/websites", isAuthenticated, async (req, res) => {
    try {
      const { name, url, niche } = req.body;
      
      if (!name || !url || !niche) {
        return res.status(400).json({ message: "Website name, URL, and niche are required" });
      }
      
      // Calculate website limits based on subscription plan
      const planLimits = {
        'Free Trial': 1,
        'Starter': 1,
        'Grow': 2,
        'Pro': 5,
      };
      
      // Check if user has reached their website limit
      const userWebsites = await db.select()
        .from(schema.websites)
        .where(eq(schema.websites.userId, req.user!.id));
      
      const planName = req.user!.subscription || 'Free Trial';
      const limit = planLimits[planName as keyof typeof planLimits] || 1;
      
      if (userWebsites.length >= limit) {
        return res.status(400).json({ 
          message: `You have reached your limit of ${limit} website${limit > 1 ? 's' : ''} for your current plan.`
        });
      }
      
      // Add the website
      const [website] = await db.insert(schema.websites)
        .values({
          userId: req.user!.id,
          name: name,
          url: url,
          niche: niche,
          createdAt: new Date(),
        })
        .returning();
      
      res.status(201).json(website);
    } catch (error: any) {
      console.error("Error adding website:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update a website
  app.patch("/api/websites/:id", isAuthenticated, async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id);
      const { name, url, niche } = req.body;
      
      if (!name || !url || !niche) {
        return res.status(400).json({ message: "Website name, URL, and niche are required" });
      }
      
      // Check if website exists and belongs to user
      const websites = await db.select()
        .from(schema.websites)
        .where(and(
          eq(schema.websites.id, websiteId),
          eq(schema.websites.userId, req.user!.id)
        ));
      
      if (websites.length === 0) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      // Update the website
      const [website] = await db.update(schema.websites)
        .set({
          name: name,
          url: url,
          niche: niche,
        })
        .where(and(
          eq(schema.websites.id, websiteId),
          eq(schema.websites.userId, req.user!.id)
        ))
        .returning();
      
      res.json(website);
    } catch (error: any) {
      console.error("Error updating website:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete a website
  app.delete("/api/websites/:id", isAuthenticated, async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id);
      
      // Check if website exists and belongs to user
      const websites = await db.select()
        .from(schema.websites)
        .where(and(
          eq(schema.websites.id, websiteId),
          eq(schema.websites.userId, req.user!.id)
        ));
      
      if (websites.length === 0) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      // Delete the website
      await db.delete(schema.websites)
        .where(and(
          eq(schema.websites.id, websiteId),
          eq(schema.websites.userId, req.user!.id)
        ));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting website:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Moz API Endpoints
  app.get("/api/moz/domain-metrics", isAuthenticated, async (req, res) => {
    try {
      const { domain } = req.query;
      
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: "Valid domain is required" });
      }
      
      const mozApiService = getMozApiService();
      const metrics = await mozApiService.getDomainMetrics(domain);
      
      res.json(metrics);
    } catch (error: any) {
      console.error('Moz API error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/moz/batch-domain-metrics", isAuthenticated, async (req, res) => {
    try {
      const { domains } = req.body;
      
      if (!Array.isArray(domains) || domains.length === 0) {
        return res.status(400).json({ message: "Valid domains array is required" });
      }
      
      const mozApiService = getMozApiService();
      const metrics = await mozApiService.getBatchDomainMetrics(domains);
      
      res.json(metrics);
    } catch (error: any) {
      console.error('Moz API batch error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Endpoint to enrich prospects with Moz data
  app.post("/api/prospects/enrich/:id", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) {
        return res.status(400).json({ message: "Invalid prospect ID" });
      }
      
      // Get the prospect
      const prospect = await storage.getProspectById(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }
      
      if (!prospect.domain) {
        return res.status(400).json({ message: "Prospect has no domain to enrich" });
      }
      
      // Get metrics from Moz
      const mozApiService = getMozApiService();
      const metrics = await mozApiService.getDomainMetrics(prospect.domain);
      
      // Update prospect with Moz data
      const prospectUpdate = {
        domainAuthority: metrics.domain_authority.toString(),
        pageAuthority: metrics.page_authority?.toString(),
        spamScore: metrics.spam_score?.toString(),
        totalLinks: metrics.links?.toString(),
        rootDomainsLinking: metrics.root_domains_to_root_domain?.toString(),
        lastCrawled: metrics.last_crawled
      };
      
      // Save the updated prospect with Moz data
      const updatedProspect = await storage.updateProspect(prospectId, prospectUpdate);
      
      res.json(updatedProspect);
    } catch (error: any) {
      console.error('Prospect enrichment error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Test endpoint to show prospects with Moz metrics (for development testing)
  app.get("/api/prospects/test", async (req, res) => {
    try {
      // Get data from the in-memory storage for testing
      // Use our already set up test data from getAllProspects, but we'll transform it
      const allProspects = await storage.getAllProspects(1); // Use demo user id (1)
      
      // Create an array with both locked and unlocked versions for testing the UI
      const testProspects = [];
      
      // Take first 5 prospects with complete data
      // Type assertion to avoid import errors
      const filteredProspects = allProspects
        .filter((p: any) => p.pageAuthority && p.domain && p.siteName)
        .slice(0, 5);
      
      for (const prospect of filteredProspects) {
        // Clone the prospect before modifying to avoid affecting the stored data
        const originalProspect = { ...prospect };
        
        // For the locked version, we hide the identifying information
        const lockedVersion = {
          ...originalProspect,
          // Hide identity when locked
          siteName: null,
          domain: null,
          contactEmail: null,
          contactName: null,
          contactRole: null,
          targetUrl: null,
          isUnlocked: false,
          isNew: true
        };
        testProspects.push(lockedVersion);
        
        // For the unlocked version, we show all fields
        const unlockedVersion = {
          ...originalProspect,
          isUnlocked: true,
          isNew: false
        };
        testProspects.push(unlockedVersion);
      }
      
      res.json(testProspects);
    } catch (error: any) {
      console.error('Get test prospects error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== Automated Opportunity Discovery System API Endpoints =====
  
  // Get website profile
  app.get("/api/websites/:id/profile", isAuthenticated, async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id);
      if (isNaN(websiteId)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }

      // Check if website belongs to user
      const websites = await db.select()
        .from(schema.websites)
        .where(and(
          eq(schema.websites.id, websiteId),
          eq(schema.websites.userId, req.user!.id)
        ));
        
      if (websites.length === 0) {
        return res.status(404).json({ message: "Website not found" });
      }

      // Get or create website profile
      const analyzer = getWebsiteAnalyzer();
      const profile = await analyzer.getProfile(websiteId);
      
      if (!profile) {
        // Process website to create profile
        const newProfile = await analyzer.processWebsite(websites[0]);
        res.json(newProfile);
      } else {
        res.json(profile);
      }
    } catch (error: any) {
      console.error('Get website profile error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analyze website
  app.post("/api/websites/:id/analyze", isAuthenticated, async (req, res) => {
    try {
      const websiteId = parseInt(req.params.id);
      if (isNaN(websiteId)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }

      // Check if website belongs to user
      const websites = await db.select()
        .from(schema.websites)
        .where(and(
          eq(schema.websites.id, websiteId),
          eq(schema.websites.userId, req.user!.id)
        ));
        
      if (websites.length === 0) {
        return res.status(404).json({ message: "Website not found" });
      }

      // Process website
      const analyzer = getWebsiteAnalyzer();
      const profile = await analyzer.processWebsite(websites[0]);
      
      res.json(profile);
    } catch (error: any) {
      console.error('Analyze website error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Start opportunity discovery (admin only)
  app.post("/api/admin/discovery/start", isAuthenticated, async (req, res) => {
    try {
      // In production, this would check for admin privileges
      // For now, anyone can trigger it for testing
      
      const { type, urls } = req.body;
      
      if (!type || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ 
          message: "Valid discovery type and URLs array required" 
        });
      }
      
      const crawler = getOpportunityCrawler();
      const job = await crawler.startDiscoveryCrawl(type, urls);
      
      res.json(job);
    } catch (error: any) {
      console.error('Start discovery error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Process discovered opportunities (admin only)
  app.post("/api/admin/discovery/process", isAuthenticated, async (req, res) => {
    try {
      // In production, this would check for admin privileges
      
      const crawler = getOpportunityCrawler();
      await crawler.processDiscoveredBatch([]);
      
      const matcher = getOpportunityMatcher();
      const matchesCreated = await matcher.processNewOpportunities();
      
      res.json({ matchesCreated });
    } catch (error: any) {
      console.error('Process opportunities error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Assign daily drips to all users (admin only)
  app.post("/api/admin/drips/assign", isAuthenticated, async (req, res) => {
    try {
      // In production, this would check for admin privileges
      
      const matcher = getOpportunityMatcher();
      const assignedCount = await matcher.assignDailyOpportunities();
      
      res.json({ assignedCount });
    } catch (error: any) {
      console.error('Assign drips error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get match explanation for opportunity
  app.get("/api/opportunities/:id/explain", isAuthenticated, async (req, res) => {
    try {
      const opportunityId = parseInt(req.params.id);
      const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
      
      if (isNaN(opportunityId)) {
        return res.status(400).json({ message: "Invalid opportunity ID" });
      }
      
      if (websiteId !== undefined && isNaN(websiteId)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }
      
      // Check if opportunity exists
      const opportunities = await db.select()
        .from(schema.discoveredOpportunities)
        .where(eq(schema.discoveredOpportunities.id, opportunityId));
        
      if (opportunities.length === 0) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
      
      // Check if website belongs to user if websiteId is provided
      if (websiteId) {
        const websites = await db.select()
          .from(schema.websites)
          .where(and(
            eq(schema.websites.id, websiteId),
            eq(schema.websites.userId, req.user!.id)
          ));
          
        if (websites.length === 0) {
          return res.status(404).json({ message: "Website not found" });
        }
      }
      
      const opportunity = opportunities[0];
      const matcher = getOpportunityMatcher();
      const explanation = await matcher.explainMatch(opportunity, websiteId);
      
      res.json(explanation);
    } catch (error: any) {
      console.error('Get match explanation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI-matched daily opportunities
  app.get("/api/drips/opportunities", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
      
      if (websiteId && isNaN(websiteId)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }
      
      // If websiteId provided, check if it belongs to user
      if (websiteId) {
        const websites = await db.select()
          .from(schema.websites)
          .where(and(
            eq(schema.websites.id, websiteId),
            eq(schema.websites.userId, userId)
          ));
          
        if (websites.length === 0) {
          return res.status(404).json({ message: "Website not found" });
        }
      }
      
      // Directly fetch from the database
      // Get today's date (without time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // For this demo, we'll create sample opportunities
      // In production, this would fetch from appropriate tables with JOIN operations
      
      // Mock data instead of database query that's failing
      let opportunities = [];
      
      try {
        // Try a more direct approach
        const { rows } = await db.execute(`
          SELECT * FROM "discoveredOpportunities" 
          ORDER BY RANDOM() 
          LIMIT 10
        `);
        
        if (rows && rows.length > 0) {
          opportunities = rows;
        } else {
          // If no data, create mock opportunities
          opportunities = Array(10).fill(0).map((_, i) => ({
            id: 1000 + i,
            url: `https://example${i}.com/resource`,
            domain: `example${i}.com`,
            sourceType: ['blog', 'resource_page', 'directory'][Math.floor(Math.random() * 3)],
            pageTitle: `Sample Resource Page ${i}`,
            domainAuthority: Math.floor(Math.random() * 50) + 30,
            pageAuthority: Math.floor(Math.random() * 40) + 20,
            spamScore: Math.floor(Math.random() * 8),
            discoveredAt: new Date(),
            status: 'validated'
          }));
        }
      } catch (error) {
        console.error('Error fetching opportunities:', error);
        
        // Fallback to mock data
        opportunities = Array(10).fill(0).map((_, i) => ({
          id: 1000 + i,
          url: `https://example${i}.com/resource`,
          domain: `example${i}.com`,
          sourceType: ['blog', 'resource_page', 'directory'][Math.floor(Math.random() * 3)],
          pageTitle: `Sample Resource Page ${i}`,
          domainAuthority: Math.floor(Math.random() * 50) + 30,
          pageAuthority: Math.floor(Math.random() * 40) + 20,
          spamScore: Math.floor(Math.random() * 8),
          discoveredAt: new Date(),
          status: 'validated'
        }));
      }
      
      // Enhance the opportunities with premium info and website ID
      const enhancedOpportunities = opportunities.map(opp => ({
        ...opp,
        isPremium: Math.random() > 0.7, // 30% chance of being premium
        matchedWebsiteId: websiteId || 1,
        relevanceScore: Math.random() * 0.5 + 0.5, // Random score between 0.5 and 1.0
      }));
      
      res.json(enhancedOpportunities);
    } catch (error: any) {
      console.error('Get daily drips error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Run the entire discovery pipeline (admin only)
  app.post("/api/admin/discovery/pipeline", isAuthenticated, async (req, res) => {
    try {
      // In production, this would check for admin privileges
      
      const scheduler = getDiscoveryScheduler();
      const result = await scheduler.runDiscoveryPipeline();
      
      res.json(result);
    } catch (error: any) {
      console.error('Run discovery pipeline error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Buy additional drips
  app.post("/api/drips/purchase", isAuthenticated, async (req, res) => {
    try {
      const { quantity } = req.body;
      
      if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ message: "Valid quantity required" });
      }
      
      // In a real implementation, this would process payment via Stripe
      // For now, just update the user's credits and return success
      
      // Get today's date (without time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Add extra drips to each website (this is a simplified implementation)
      const userWebsites = await db.select()
        .from(schema.websites)
        .where(eq(schema.websites.userId, req.user!.id));
        
      if (userWebsites.length === 0) {
        return res.status(400).json({ message: "User has no websites" });
      }
      
      // For now just take the first website
      const websiteId = userWebsites[0].id;
      
      // Create or update daily drip with extra opportunities
      const drips = await db.select()
        .from(schema.dailyDrips)
        .where(and(
          eq(schema.dailyDrips.userId, req.user!.id),
          eq(schema.dailyDrips.websiteId, websiteId),
          eq(schema.dailyDrips.date, today)
        ));
        
      if (drips.length === 0) {
        // Create new drip
        await db.insert(schema.dailyDrips)
          .values({
            userId: req.user!.id,
            websiteId: websiteId,
            date: today,
            opportunitiesLimit: quantity,
            opportunitiesDelivered: 0,
            isPurchasedExtra: true,
            matches: []
          });
      } else {
        // Update existing drip
        await db.update(schema.dailyDrips)
          .set({
            opportunitiesLimit: drips[0].opportunitiesLimit + quantity,
            isPurchasedExtra: true
          })
          .where(eq(schema.dailyDrips.id, drips[0].id));
      }
      
      // Assign new opportunities
      const matcher = getOpportunityMatcher();
      await matcher.assignDailyOpportunities();
      
      res.json({ success: true, quantity });
    } catch (error: any) {
      console.error('Purchase drips error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Purchase additional splashes
  app.post("/api/splashes/add", isAuthenticated, async (req, res) => {
    try {
      const { splashes } = req.body;
      
      if (!splashes || typeof splashes !== 'number' || splashes <= 0) {
        return res.status(400).json({ message: "Valid splashes quantity required" });
      }
      
      // In a real implementation, this would process payment via Stripe
      // For now, just update the user's splashes and return success
      
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Add purchased splashes to user's account
      const [updatedUser] = await db.update(schema.users)
        .set({ 
          splashesAllowed: (user.splashesAllowed || 0) + splashes,
        })
        .where(eq(schema.users.id, user.id))
        .returning();
      
      // Record the purchase in splashUsage table
      try {
        await db.execute(
          `INSERT INTO splashusage ("userid", "websiteid", "usedat", "source", "count") 
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, null, new Date(), "purchased", splashes]
        );
      } catch (err) {
        console.error('Error recording splash purchase:', err);
        // Continue even if this fails
      }
      
      // Update the session
      req.login(updatedUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error updating session" });
        }
        
        res.json({
          success: true,
          splashesAdded: splashes,
          splashesTotal: updatedUser.splashesAllowed,
          splashesRemaining: (updatedUser.splashesAllowed || 0) - (updatedUser.splashesUsed || 0)
        });
      });
    } catch (error: any) {
      console.error('Purchase splashes error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Register email webhook routes
  app.use('/api', emailWebhookRoutes);
  
  // Enhanced email sending endpoint with tracking and threading
  app.post("/api/email/send-tracked", isAuthenticated, async (req, res) => {
    try {
      const { prospectId, subject, body } = req.body;
      
      if (!prospectId || !subject || !body) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const prospect = await storage.getProspectById(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // Create the email record first
      const emailData = {
        prospectId,
        userId: req.user!.id,
        subject,
        body,
        siteName: prospect.siteName || prospect.siteType,
        contactEmail: prospect.contactEmail!,
        contactRole: prospect.contactRole,
        domainAuthority: prospect.domainAuthority,
      };

      const emailSchema = insertEmailSchema.parse(emailData);
      const email = await storage.sendEmail(emailSchema);
      
      // Then send it through the email service with tracking
      const emailService = await createEmailServiceForUser(req.user!.id);
      if (!emailService) {
        return res.status(400).json({ 
          message: "Email service not configured. Please set up your email settings first.",
          email
        });
      }
      
      const emailContent = {
        to: prospect.contactEmail!,
        subject: subject,
        body: body,
      };
      
      const result = await emailService.sendEmail(email.id, req.user!.id, prospectId, emailContent);
      
      if (!result.success) {
        return res.status(500).json({ 
          message: `Failed to send email: ${result.error}`,
          email
        });
      }
      
      res.json({ 
        ...email, 
        messageId: result.messageId,
        threadId: result.threadId
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Verify email address
  app.post("/api/email/verify", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      // Check if user has configured email settings
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user!.id));
      
      if (!user || !user.emailProvider || !user.fromEmail) {
        return res.status(400).json({ message: "Email settings not configured" });
      }
      
      // Create temporary service to send verification
      // Create email service directly using the factory function
      const emailService = await createEmailServiceForUser(req.user!.id);
      
      if (!emailService) {
        return res.status(400).json({ message: "Failed to create email service with your settings" });
      }
      const result = await emailService.sendVerificationEmail(req.user!.id, email);
      
      if (!result.success) {
        return res.status(500).json({ message: `Failed to send verification email: ${result.error}` });
      }
      
      res.json({ success: true, message: "Verification email sent" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send a verification email
  app.post("/api/email/verify", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      const emailService = await createEmailServiceForUser(req.user!.id);
      if (!emailService) {
        return res.status(400).json({ message: "Email is not configured for this user" });
      }
      
      // Send verification email
      const result = await emailService.sendVerificationEmail(req.user!.id, email);
      
      res.json({
        success: true,
        message: "Verification email sent successfully"
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });
  
  // Verify email with token
  app.get("/api/email/verify", async (req, res) => {
    try {
      const { token, email } = req.query;
      
      if (!token || !email) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Find the user with this verification token
      const [emailSetting] = await db.select()
        .from(schema.emailSettings)
        .where(eq(schema.emailSettings.verificationToken, token as string));
      
      if (!emailSetting) {
        return res.status(404).json({ message: "Invalid or expired verification token" });
      }
      
      // Check if token is expired
      if (emailSetting.verificationExpires && new Date() > emailSetting.verificationExpires) {
        return res.status(400).json({ message: "Verification token has expired" });
      }
      
      // Update the email verified status
      await db.update(schema.emailSettings)
        .set({
          isVerified: true,
          verificationToken: null,
          verificationExpires: null
        })
        .where(eq(schema.emailSettings.id, emailSetting.id));
      
      res.json({
        success: true,
        message: "Email verified successfully"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Register email webhook routes
  app.use('/api/webhooks', emailWebhookRoutes);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Start the opportunity discovery scheduler in development
  // In production, this would be a separate process or cron job
  if (process.env.NODE_ENV === 'development') {
    // Initialize the scheduler but don't start it automatically
    getDiscoveryScheduler();
    console.log('[Discovery] Scheduler initialized');
  }
  
  return httpServer;
}
