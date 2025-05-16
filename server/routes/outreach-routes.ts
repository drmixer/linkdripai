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
import { eq, desc, and } from 'drizzle-orm';
import { outreachMessages, outreachTemplates } from '@shared/schema';
import nodemailer from 'nodemailer';
import { z } from 'zod';

const router = express.Router();

// Email validation schema
const emailOutreachSchema = z.object({
  emailTo: z.string().email(),
  subject: z.string().min(5),
  message: z.string().min(20),
  templateId: z.number().optional(),
  scheduledFor: z.string().optional(),
});

// Social media outreach validation schema
const socialOutreachSchema = z.object({
  platform: z.string(),
  profileUrl: z.string().url(),
  message: z.string().min(10),
  templateId: z.number().optional(),
  scheduledFor: z.string().optional(),
});

// Contact form outreach validation schema
const contactFormOutreachSchema = z.object({
  contactFormUrl: z.string().url(),
  subject: z.string().min(5),
  message: z.string().min(20),
  yourName: z.string().min(1),
  yourEmail: z.string().email(),
  yourWebsite: z.string().url(),
  templateId: z.number().optional(),
  notes: z.string().optional(),
});

// Template validation schema
const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  channel: z.enum(['email', 'linkedin', 'twitter', 'facebook', 'instagram', 'contact_form']),
  subject: z.string().optional(),
  content: z.string().min(10),
  variables: z.record(z.any()).optional(),
  isDefault: z.boolean().optional(),
});

// Get outreach history for an opportunity
router.get('/outreach-history/:opportunityId', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const opportunityId = parseInt(req.params.opportunityId);
    
    if (isNaN(opportunityId)) {
      return res.status(400).json({ error: 'Invalid opportunity ID' });
    }
    
    const outreachHistory = await db
      .select({
        id: outreachMessages.id,
        channel: outreachMessages.channel,
        status: outreachMessages.status,
        subject: outreachMessages.subject,
        sentAt: outreachMessages.sentAt,
        createdAt: outreachMessages.createdAt,
      })
      .from(outreachMessages)
      .where(
        and(
          eq(outreachMessages.opportunityId, opportunityId),
          eq(outreachMessages.userId, req.user.id)
        )
      )
      .orderBy(desc(outreachMessages.createdAt));
    
    res.json(outreachHistory);
  } catch (error) {
    console.error('Error fetching outreach history:', error);
    res.status(500).json({ error: 'Failed to fetch outreach history' });
  }
});

// Get all outreach templates
router.get('/outreach-templates', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const channel = req.query.channel as string;
    
    let query = db
      .select()
      .from(outreachTemplates)
      .where(eq(outreachTemplates.userId, req.user.id));
    
    if (channel) {
      query = query.where(eq(outreachTemplates.channel, channel));
    }
    
    const templates = await query;
    
    // If no custom templates, get defaults
    if (templates.length === 0) {
      const defaultTemplates = await db
        .select()
        .from(outreachTemplates)
        .where(eq(outreachTemplates.isDefault, true));
      
      if (channel) {
        const filteredDefaults = defaultTemplates.filter(template => 
          template.channel === channel
        );
        return res.json(filteredDefaults);
      }
      
      return res.json(defaultTemplates);
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching outreach templates:', error);
    res.status(500).json({ error: 'Failed to fetch outreach templates' });
  }
});

// Get a specific template
router.get('/outreach-templates/:id', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }
    
    const [template] = await db
      .select()
      .from(outreachTemplates)
      .where(eq(outreachTemplates.id, templateId));
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if template belongs to user or is a default template
    if (!template.isDefault && template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create a new template
router.post('/outreach-templates', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const validatedData = templateSchema.parse(req.body);
    
    const [template] = await db
      .insert(outreachTemplates)
      .values({
        ...validatedData,
        userId: req.user.id,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Send email outreach
router.post('/outreach/email/:opportunityId', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const opportunityId = parseInt(req.params.opportunityId);
    
    if (isNaN(opportunityId)) {
      return res.status(400).json({ error: 'Invalid opportunity ID' });
    }
    
    const validatedData = emailOutreachSchema.parse(req.body);
    
    // Handle email sending logic here
    // For now, we'll just track the outreach in the database
    
    // Record the outreach message
    const [outreachRecord] = await db
      .insert(outreachMessages)
      .values({
        userId: req.user.id,
        opportunityId: opportunityId,
        channel: 'email',
        status: 'sent', // or 'scheduled' if scheduledFor is provided
        subject: validatedData.subject,
        message: validatedData.message,
        templateId: validatedData.templateId,
        scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : null,
        sentAt: validatedData.scheduledFor ? null : new Date(),
        metadata: { emailTo: validatedData.emailTo },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    // In a production environment, you would actually send the email here
    // using your SMTP settings or email service provider
    
    res.json({
      success: true,
      message: 'Email outreach record created',
      outreachId: outreachRecord.id,
    });
  } catch (error) {
    console.error('Error processing email outreach:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to process email outreach' });
  }
});

// Track social media outreach
router.post('/outreach/social/:opportunityId', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const opportunityId = parseInt(req.params.opportunityId);
    
    if (isNaN(opportunityId)) {
      return res.status(400).json({ error: 'Invalid opportunity ID' });
    }
    
    const validatedData = socialOutreachSchema.parse(req.body);
    
    // Record the social outreach
    const [outreachRecord] = await db
      .insert(outreachMessages)
      .values({
        userId: req.user.id,
        opportunityId: opportunityId,
        channel: validatedData.platform,
        status: 'sent', // or 'scheduled' if scheduledFor is provided
        subject: null, // Social platforms typically don't use subjects
        message: validatedData.message,
        templateId: validatedData.templateId,
        scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : null,
        sentAt: validatedData.scheduledFor ? null : new Date(),
        metadata: { 
          profileUrl: validatedData.profileUrl,
          platform: validatedData.platform,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    res.json({
      success: true,
      message: 'Social outreach record created',
      outreachId: outreachRecord.id,
    });
  } catch (error) {
    console.error('Error processing social outreach:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to process social outreach' });
  }
});

// Track contact form outreach
router.post('/outreach/contact-form/:opportunityId', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const opportunityId = parseInt(req.params.opportunityId);
    
    if (isNaN(opportunityId)) {
      return res.status(400).json({ error: 'Invalid opportunity ID' });
    }
    
    const validatedData = contactFormOutreachSchema.parse(req.body);
    
    // Record the contact form outreach
    const [outreachRecord] = await db
      .insert(outreachMessages)
      .values({
        userId: req.user.id,
        opportunityId: opportunityId,
        channel: 'contact_form',
        status: 'sent',
        subject: validatedData.subject,
        message: validatedData.message,
        templateId: validatedData.templateId,
        sentAt: new Date(),
        metadata: { 
          contactFormUrl: validatedData.contactFormUrl,
          yourName: validatedData.yourName,
          yourEmail: validatedData.yourEmail,
          yourWebsite: validatedData.yourWebsite,
          notes: validatedData.notes,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    res.json({
      success: true,
      message: 'Contact form outreach record created',
      outreachId: outreachRecord.id,
    });
  } catch (error) {
    console.error('Error processing contact form outreach:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to process contact form outreach' });
  }
});

// Get email templates specifically
router.get('/email-templates', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const templates = await db
      .select()
      .from(outreachTemplates)
      .where(eq(outreachTemplates.channel, 'email'));
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get a specific email template
router.get('/email-templates/:id', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }
    
    const [template] = await db
      .select()
      .from(outreachTemplates)
      .where(and(
        eq(outreachTemplates.id, templateId),
        eq(outreachTemplates.channel, 'email')
      ));
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Check if template belongs to user or is a default template
    if (!template.isDefault && template.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching email template:', error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

// Get user profile for outreach forms
router.get('/user/profile', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Return user profile data for outreach
    // This would typically come from a user profile table
    // For now, we'll return some basic information from the user object
    
    res.json({
      name: req.user.name || req.user.username,
      email: req.user.email || '',
      website: req.user.website || '',
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;