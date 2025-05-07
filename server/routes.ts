import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertProspectSchema, insertEmailSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

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
      const stats = await storage.getUserStats(req.user!.id);
      res.json(stats);
    } catch (error: any) {
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

  // Unlock prospect
  app.post("/api/prospects/:id/unlock", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) {
        return res.status(400).json({ message: "Invalid prospect ID" });
      }

      const user = req.user!;
      if (user.credits < 1) {
        return res.status(400).json({ message: "Not enough credits" });
      }

      const prospect = await storage.unlockProspect(prospectId, user.id);
      const updatedUser = await storage.updateUserCredits(user.id, user.credits - 1);
      
      res.json({ prospect, user: updatedUser });
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

      const prospect = await storage.getProspectById(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }
      
      // Update prospect to be hidden
      const updatedProspect = {
        ...prospect,
        isHidden: true
      };
      
      storage.prospects.set(prospectId, updatedProspect);
      res.json(updatedProspect);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Bulk operations
  app.post("/api/prospects/bulk-unlock", isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Valid prospect IDs are required" });
      }
      
      const user = req.user!;
      // Check if user has enough credits
      if (user.credits < ids.length) {
        return res.status(400).json({ message: "Not enough credits" });
      }
      
      const results = [];
      for (const id of ids) {
        try {
          const prospect = await storage.unlockProspect(id, user.id);
          results.push(prospect);
        } catch (err) {
          console.error(`Error unlocking prospect ${id}:`, err);
        }
      }
      
      // Update user credits
      const updatedUser = await storage.updateUserCredits(user.id, user.credits - results.length);
      
      res.json({ prospects: results, user: updatedUser });
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
          const prospect = await storage.getProspectById(id);
          if (prospect) {
            const updatedProspect = {
              ...prospect,
              isHidden: true
            };
            storage.prospects.set(id, updatedProspect);
            results.push(updatedProspect);
          }
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
      const { prospectId, subject, body } = req.body;
      
      if (!prospectId || !subject || !body) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const prospect = await storage.getProspectById(prospectId);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      if (!prospect.isUnlocked || prospect.unlockedBy !== req.user!.id) {
        return res.status(403).json({ message: "You haven't unlocked this prospect" });
      }

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
      res.json(email);
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
      
      const updatedUser = await storage.updateUserWebsites(req.user!.id, websites);
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
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
