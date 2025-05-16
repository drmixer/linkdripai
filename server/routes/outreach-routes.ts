/**
 * Outreach API Routes
 * 
 * This file contains routes for handling multi-channel outreach capabilities including:
 * - Email outreach
 * - Social media outreach
 * - Contact form outreach
 * - Outreach history and analytics
 */

import express from 'express';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { 
  discoveredOpportunities, 
  contactActivityStatusEnum,
  contactMethodEnum,
  contactActivities
} from '@shared/schema';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

/**
 * GET /api/outreach/history
 * 
 * Get outreach history for the logged-in user
 */
router.get('/api/outreach/history', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    const activities = await db.select()
      .from(contactActivities)
      .where(eq(contactActivities.userId, userId))
      .orderBy(desc(contactActivities.createdAt));
    
    res.json(activities);
  } catch (error) {
    console.error('Error fetching outreach history:', error);
    res.status(500).json({ error: 'Failed to fetch outreach history' });
  }
});

/**
 * GET /api/email-templates
 * 
 * Get email templates for the logged-in user
 */
router.get('/api/email-templates', ensureAuthenticated, async (req, res) => {
  try {
    // For now, return some default templates
    // In a future update, these could be stored in the database and customized per user
    const templates = [
      {
        id: 1,
        name: 'Standard Backlink Request',
        subject: 'Collaboration opportunity with {{website}}',
        content: `Hi there,

I was browsing through {{website}} and I noticed your excellent content on [topic]. I run a website in a similar field, and I think there could be an opportunity for us to collaborate.

I've recently published an in-depth article on [your topic] that I think would be a valuable resource for your audience. Would you be interested in checking it out for a potential link?

I'd be happy to reciprocate the favor or explore other ways we could work together.

Looking forward to your response,
[Your Name]`
      },
      {
        id: 2,
        name: 'Resource Suggestion',
        subject: 'Resource for your {{website}} article',
        content: `Hello,

I recently came across your article on {{domain}} about [specific topic] and found it extremely informative.

I noticed you mentioned [specific point], and I thought you might be interested in a comprehensive resource I've created that expands on this topic further. It covers [briefly describe your content] and has been well-received by readers.

If you find it valuable, perhaps you could include it as an additional resource for your readers? I'm confident it would provide extra value to your already excellent content.

Thanks for considering,
[Your Name]`
      },
      {
        id: 3,
        name: 'Broken Link Replacement',
        subject: 'Broken link found on {{website}}',
        content: `Hello {{website}} team,

I was reading your article at [URL] and noticed that the link to [describe destination] appears to be broken.

I've actually published a comprehensive resource on this exact topic that could serve as a perfect replacement. My article covers [briefly describe content] and would provide your readers with the information they were looking for.

Would you be open to replacing the broken link with my resource? I'm happy to share more details if you're interested.

Thanks for your time,
[Your Name]`
      }
    ];
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

/**
 * GET /api/social-templates
 * 
 * Get social media outreach templates for the logged-in user
 */
router.get('/api/social-templates', ensureAuthenticated, async (req, res) => {
  try {
    // For now, return some default templates
    // In a future update, these could be stored in the database and customized per user
    const templates = [
      {
        id: 1,
        name: 'LinkedIn Connection',
        platform: 'linkedin',
        content: `Hello! I discovered {{website}} while researching [topic] and was impressed by your expertise. I've published a comprehensive guide on [your topic] that might be a valuable resource for your audience. Would you be interested in a potential collaboration or link exchange? I'd be happy to discuss how we could mutually benefit.`
      },
      {
        id: 2,
        name: 'Twitter Outreach',
        platform: 'twitter',
        content: `Hi! Loved your content on {{website}}. I've created a helpful resource on [topic] that complements your work. Would you check it out? Happy to return the favor!`
      },
      {
        id: 3,
        name: 'General Social',
        platform: 'any',
        content: `Hi there! I came across {{website}} and really enjoyed your content on [topic]. I've written an in-depth article on [your topic] that I think would be valuable for your audience. Would you be interested in checking it out for a potential backlink? Happy to reciprocate!`
      }
    ];
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching social templates:', error);
    res.status(500).json({ error: 'Failed to fetch social templates' });
  }
});

/**
 * POST /api/outreach/email
 * 
 * Send email outreach and record the activity
 */
router.post('/api/outreach/email', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      opportunityId, 
      to, 
      subject, 
      message, 
      fromName,
      domain,
      websiteName
    } = req.body;
    
    // Check if opportunity exists
    const [opportunity] = await db.select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.id, opportunityId));
      
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    // Right now, we'll simply record the email outreach activity
    // In a production implementation, this would actually send the email
    // via the user's configured email provider (SMTP, SendGrid, etc.)
    const messageId = uuidv4();
    
    // Record the outreach activity
    const [activity] = await db.insert(contactActivities)
      .values({
        userId,
        opportunityId,
        method: contactMethodEnum.enumValues[0], // 'email'
        status: contactActivityStatusEnum.enumValues[0], // 'pending'
        details: {
          to,
          subject,
          fromName,
          messageContent: message,
          messageId,
          domain,
          websiteName
        }
      })
      .returning();
    
    // Simulate sending email
    // If the user wants to actually integrate email sending, they would configure
    // their email provider settings in their user profile
    
    // Add optional simulated email sending code here for demo purposes
    // In a real implementation, this would use the user's configured email provider

    // Mock email sending response
    const sendResponse = {
      messageId,
      to,
      subject,
      status: 'sent'
    };
    
    res.json({ 
      success: true, 
      message: 'Email outreach recorded', 
      activityId: activity.id,
      emailResponse: sendResponse
    });
    
  } catch (error) {
    console.error('Error sending email outreach:', error);
    res.status(500).json({ error: 'Failed to send email outreach' });
  }
});

/**
 * POST /api/outreach/social
 * 
 * Record social media outreach activity
 */
router.post('/api/outreach/social', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      opportunityId, 
      platform, 
      profileUrl, 
      message,
      domain,
      websiteName
    } = req.body;
    
    // Check if opportunity exists
    const [opportunity] = await db.select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.id, opportunityId));
      
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    // Record the outreach activity
    const [activity] = await db.insert(contactActivities)
      .values({
        userId,
        opportunityId,
        method: contactMethodEnum.enumValues[1], // 'social_message'
        status: contactActivityStatusEnum.enumValues[0], // 'pending'
        details: {
          platform,
          profileUrl,
          messageContent: message,
          domain,
          websiteName,
          recordedAt: new Date().toISOString()
        }
      })
      .returning();
    
    res.json({ 
      success: true, 
      message: 'Social media outreach recorded', 
      activityId: activity.id 
    });
    
  } catch (error) {
    console.error('Error recording social outreach:', error);
    res.status(500).json({ error: 'Failed to record social outreach' });
  }
});

/**
 * POST /api/outreach/contact-form
 * 
 * Record contact form outreach activity
 */
router.post('/api/outreach/contact-form', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      opportunityId, 
      formUrl, 
      name,
      email,
      subject,
      message,
      domain,
      websiteName
    } = req.body;
    
    // Check if opportunity exists
    const [opportunity] = await db.select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.id, opportunityId));
      
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    // Record the outreach activity
    const [activity] = await db.insert(contactActivities)
      .values({
        userId,
        opportunityId,
        method: contactMethodEnum.enumValues[2], // 'contact_form'
        status: contactActivityStatusEnum.enumValues[0], // 'pending'
        details: {
          formUrl,
          name,
          email,
          subject,
          messageContent: message,
          domain,
          websiteName,
          recordedAt: new Date().toISOString()
        }
      })
      .returning();
    
    res.json({ 
      success: true, 
      message: 'Contact form outreach recorded', 
      activityId: activity.id 
    });
    
  } catch (error) {
    console.error('Error recording contact form outreach:', error);
    res.status(500).json({ error: 'Failed to record contact form outreach' });
  }
});

/**
 * PUT /api/outreach/status/:activityId
 * 
 * Update status of an outreach activity
 */
router.put('/api/outreach/status/:activityId', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { activityId } = req.params;
    const { status, notes } = req.body;
    
    // Check if activity exists and belongs to user
    const [existingActivity] = await db.select()
      .from(contactActivities)
      .where(
        and(
          eq(contactActivities.id, parseInt(activityId)),
          eq(contactActivities.userId, userId)
        )
      );
      
    if (!existingActivity) {
      return res.status(404).json({ error: 'Activity not found or does not belong to you' });
    }
    
    // Update the activity status
    const [updatedActivity] = await db.update(contactActivities)
      .set({ 
        status: status as typeof contactActivityStatusEnum.enumValues[number],
        notes
      })
      .where(eq(contactActivities.id, parseInt(activityId)))
      .returning();
    
    res.json({ 
      success: true, 
      message: 'Outreach status updated', 
      activity: updatedActivity 
    });
    
  } catch (error) {
    console.error('Error updating outreach status:', error);
    res.status(500).json({ error: 'Failed to update outreach status' });
  }
});

/**
 * GET /api/opportunities/:id
 * 
 * Get opportunity details for outreach
 */
router.get('/api/opportunities/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get opportunity details including contact info
    const [opportunity] = await db.select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.id, parseInt(id)));
      
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    
    res.json(opportunity);
    
  } catch (error) {
    console.error('Error fetching opportunity details:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity details' });
  }
});

export default router;