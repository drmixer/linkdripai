/**
 * Email Integration Routes
 * 
 * These routes handle email integration configuration, testing, and sending.
 */

import { Router } from 'express';
import * as EmailIntegrationService from '../services/email-integration-service';
import { z } from 'zod';
import { db } from '../db';
import { userEmailSettings, discoveredOpportunities } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Middleware to ensure user is authenticated
function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'You must be logged in' });
  }
  next();
}

// Get email settings for current user
router.get('/api/email/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [userEmailSettings] = await db
      .select()
      .from(userEmailSettings)
      .where(eq(userEmailSettings.userId, userId));
    
    if (!userEmailSettings) {
      return res.json({ 
        configured: false,
        verified: false,
        provider: null,
        fromEmail: req.user.email,
        fromName: `${req.user.firstName} ${req.user.lastName}`
      });
    }
    
    // Return settings without sensitive data
    return res.json({
      configured: userEmailSettings.isConfigured,
      verified: userEmailSettings.isVerified,
      provider: userEmailSettings.provider,
      fromEmail: userEmailSettings.fromEmail,
      fromName: userEmailSettings.fromName,
      termsAccepted: userEmailSettings.termsAccepted,
      hasSmtp: !!userEmailSettings.smtpHost,
      hasSendgrid: !!userEmailSettings.sendgridApiKey,
      hasGmail: !!userEmailSettings.gmailClientId
    });
  } catch (error: any) {
    console.error('Error getting email settings:', error);
    return res.status(500).json({ error: `Failed to get email settings: ${error.message}` });
  }
});

// Save email settings
router.post('/api/email/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Validate input schema
    const schema = z.object({
      provider: z.enum(['sendgrid', 'smtp', 'gmail']),
      fromEmail: z.string().email(),
      fromName: z.string().optional(),
      // SendGrid settings
      sendgridApiKey: z.string().optional(),
      // SMTP settings
      smtpHost: z.string().optional(),
      smtpPort: z.number().optional(),
      smtpUsername: z.string().optional(),
      smtpPassword: z.string().optional(),
      // Gmail settings
      gmailClientId: z.string().optional(),
      gmailClientSecret: z.string().optional(),
      gmailRefreshToken: z.string().optional(),
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid email settings data', details: validationResult.error.issues });
    }
    
    const result = await EmailIntegrationService.saveEmailSettings(userId, validationResult.data);
    
    if (result.success) {
      return res.json({ success: true, message: result.message });
    } else {
      return res.status(400).json({ error: result.message });
    }
  } catch (error: any) {
    console.error('Error saving email settings:', error);
    return res.status(500).json({ error: `Failed to save email settings: ${error.message}` });
  }
});

// Verify email settings
router.post('/api/email/verify', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await EmailIntegrationService.verifyEmailSettings(userId);
    
    if (result.success) {
      return res.json({ success: true, message: result.message });
    } else {
      return res.status(400).json({ error: result.message });
    }
  } catch (error: any) {
    console.error('Error verifying email settings:', error);
    return res.status(500).json({ error: `Failed to verify email settings: ${error.message}` });
  }
});

// Send test email
router.post('/api/email/test', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Validate input schema
    const schema = z.object({
      testEmail: z.string().email()
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid email address', details: validationResult.error.issues });
    }
    
    const result = await EmailIntegrationService.sendTestEmail(userId, validationResult.data.testEmail);
    
    if (result.success) {
      return res.json({ success: true, message: result.message });
    } else {
      return res.status(400).json({ error: result.message });
    }
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return res.status(500).json({ error: `Failed to send test email: ${error.message}` });
  }
});

// Accept email terms
router.post('/api/email/accept-terms', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Update terms acceptance in the database
    await db.update(userEmailSettings)
      .set({ termsAccepted: true })
      .where(eq(userEmailSettings.userId, userId));
    
    return res.json({ success: true, message: 'Email terms accepted' });
  } catch (error: any) {
    console.error('Error accepting email terms:', error);
    return res.status(500).json({ error: `Failed to accept email terms: ${error.message}` });
  }
});

// Send outreach email to opportunity
router.post('/api/email/send-outreach', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Validate input schema
    const schema = z.object({
      opportunityId: z.number(),
      websiteId: z.number().optional(),
      subject: z.string(),
      body: z.string(),
      toEmail: z.string().email().optional(),
      fromName: z.string().optional(),
      fromEmail: z.string().email().optional(),
      attachments: z.array(z.object({
        filename: z.string(),
        content: z.string(),
        contentType: z.string().optional()
      })).optional()
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid outreach email data', details: validationResult.error.issues });
    }
    
    const data = validationResult.data;
    
    // Get opportunity to extract contact email if not provided
    const [opportunity] = await db
      .select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.id, data.opportunityId));
    
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    // Extract email from opportunity if not provided in request
    let toEmail = data.toEmail;
    if (!toEmail) {
      if (!opportunity.contactInfo?.emails || opportunity.contactInfo.emails.length === 0) {
        return res.status(400).json({ error: 'No contact email available for this opportunity' });
      }
      toEmail = opportunity.contactInfo.emails[0];
    }
    
    // Get email settings to use default fromEmail/fromName if not provided
    const [userEmailSettings] = await db
      .select()
      .from(userEmailSettings)
      .where(eq(userEmailSettings.userId, userId));
    
    if (!userEmailSettings?.isConfigured) {
      return res.status(400).json({ error: 'Email not configured. Please set up your email integration first.' });
    }
    
    if (!userEmailSettings.isVerified) {
      return res.status(400).json({ error: 'Email settings not verified. Please verify your email settings first.' });
    }
    
    // Send the email
    const result = await EmailIntegrationService.sendEmail({
      userId,
      opportunityId: data.opportunityId,
      websiteId: data.websiteId,
      to: toEmail,
      subject: data.subject,
      body: data.body,
      fromEmail: data.fromEmail || userEmailSettings.fromEmail || req.user.email,
      fromName: data.fromName || userEmailSettings.fromName || `${req.user.firstName} ${req.user.lastName}`,
      attachments: data.attachments
    });
    
    if (result.success) {
      return res.json({ 
        success: true, 
        message: 'Email sent successfully',
        messageId: result.messageId 
      });
    } else {
      return res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Error sending outreach email:', error);
    return res.status(500).json({ error: `Failed to send outreach email: ${error.message}` });
  }
});

// Get email templates
router.get('/api/email/templates', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const templates = await EmailIntegrationService.getEmailTemplates(userId);
    
    return res.json({ templates });
  } catch (error: any) {
    console.error('Error getting email templates:', error);
    return res.status(500).json({ error: `Failed to get email templates: ${error.message}` });
  }
});

// Webhook endpoint for receiving email replies
// Note: This would need to be configured with the email provider
router.post('/api/email/webhook', async (req, res) => {
  try {
    // Basic validation of the webhook payload
    const schema = z.object({
      to: z.string(),
      from: z.string(),
      subject: z.string(),
      text: z.string(),
      html: z.string().optional(),
      headers: z.record(z.string())
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    // Process the email reply
    const result = await EmailIntegrationService.processEmailReply(validationResult.data);
    
    if (result.success) {
      return res.json({ success: true });
    } else {
      // Still return 200 to acknowledge receipt, but with error info
      return res.json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    // Still return 200 to acknowledge receipt, but with error info
    return res.json({ success: false, error: error.message });
  }
});

export default router;