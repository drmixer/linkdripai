/**
 * Email Webhook Routes
 * 
 * Handles incoming emails and webhook callbacks from email providers
 */

import { Router, Request, Response } from 'express';
import { EmailService } from '../services/email-service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * SendGrid Webhook
 * Handles incoming emails from SendGrid
 */
router.post('/webhook/sendgrid', async (req, res) => {
  try {
    const events = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    let processedCount = 0;
    
    // Process each event
    for (const event of events) {
      if (event.event === 'inbound') {
        // Extract email data from the event
        const email = {
          from: event.from,
          to: event.to,
          subject: event.subject,
          text: event.text,
          html: event.html,
          headers: event.headers || {},
        };
        
        // Find the recipient's user account
        const recipient = email.to.split('@')[0];
        const [user] = await db.select()
          .from(users)
          .where(eq(users.fromEmail, recipient + '@' + process.env.EMAIL_DOMAIN));
        
        if (!user) {
          continue; // Skip if no matching user
        }
        
        // Create email service for this user
        const emailService = new EmailService({
          provider: 'sendgrid',
          fromEmail: user.fromEmail || '',
          sendgridApiKey: user.sendgridApiKey || '',
        });
        
        // Process the incoming email
        const result = await emailService.processIncomingEmail(email);
        
        if (result.processed) {
          processedCount++;
        }
      }
    }
    
    return res.status(200).json({ success: true, processed: processedCount });
  } catch (error) {
    console.error('Error processing SendGrid webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Generic Email Webhook
 * Handles incoming emails in a standardized format
 */
router.post('/webhook/email', async (req, res) => {
  try {
    const { userId, email } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get user details
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create email service for this user
    const emailService = await createEmailServiceForUser(userId);
    
    if (!emailService) {
      return res.status(400).json({ error: 'Failed to create email service for user' });
    }
    
    // Process the incoming email
    const result = await emailService.processIncomingEmail(email);
    
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error processing generic email webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Function to create an email service for a user
 */
async function createEmailServiceForUser(userId: number) {
  // Get user details
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user || !user.emailProvider || !user.fromEmail) {
    return null;
  }
  
  // Create config based on user settings
  const config: any = {
    provider: user.emailProvider,
    fromEmail: user.fromEmail,
  };
  
  // Add provider-specific settings
  if (user.emailProvider === 'sendgrid') {
    config.sendgridApiKey = user.sendgridApiKey;
  } else if (user.emailProvider === 'smtp') {
    config.smtpHost = user.smtpHost;
    config.smtpPort = user.smtpPort || 587;
    config.smtpUsername = user.smtpUsername;
    config.smtpPassword = user.smtpPassword;
  } else if (user.emailProvider === 'gmail') {
    config.gmailClientId = user.gmailClientId;
    config.gmailClientSecret = user.gmailClientSecret;
    config.gmailRefreshToken = user.gmailRefreshToken;
  }
  
  return new EmailService(config);
}

export default router;