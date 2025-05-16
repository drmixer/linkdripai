/**
 * Email Integration Service
 * 
 * This service handles integrated email outreach for opportunities.
 * It supports multiple email providers (SendGrid, SMTP, Gmail)
 * and handles email tracking, threading, and reply detection.
 */

import { db } from '../db';
import { users, outreachEmails, emailSettings, discoveredOpportunities } from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { google } from 'googleapis';
import sgMail from '@sendgrid/mail';

// Cache of email transporters to avoid recreation
const smtpTransporters: Record<number, Transporter<SMTPTransport.SentMessageInfo>> = {};

type EmailProvider = 'sendgrid' | 'smtp' | 'gmail';

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  variables: string[]; // Variables that can be replaced in template
}

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail: string;
  replyTo?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: EmailAttachment[];
  userId: number;
  opportunityId: number;
  websiteId?: number;
}

/**
 * Initialize email clients and providers
 * @param apiKey API key for service
 * @param service Email service provider
 */
function initializeEmailClient(service: EmailProvider, apiKey?: string) {
  switch (service) {
    case 'sendgrid':
      if (!apiKey) {
        throw new Error('SendGrid API key is required');
      }
      sgMail.setApiKey(apiKey);
      break;
    
    // Other providers initialization as needed
    default:
      break;
  }
}

/**
 * Create an SMTP transporter for a user
 * @param userId The user ID
 * @returns A configured SMTP transporter
 */
async function createSmtpTransporter(userId: number): Promise<Transporter<SMTPTransport.SentMessageInfo> | null> {
  try {
    // Get user's email settings
    const [userEmailSettings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.userId, userId));
    
    if (!userEmailSettings) {
      console.error(`No email settings found for user ${userId}`);
      return null;
    }
    
    if (!userEmailSettings.smtpHost || !userEmailSettings.smtpPort || 
        !userEmailSettings.smtpUsername || !userEmailSettings.smtpPassword) {
      console.error(`Incomplete SMTP settings for user ${userId}`);
      return null;
    }
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: userEmailSettings.smtpHost,
      port: userEmailSettings.smtpPort,
      secure: userEmailSettings.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: userEmailSettings.smtpUsername,
        pass: userEmailSettings.smtpPassword,
      },
    });
    
    // Store in cache
    smtpTransporters[userId] = transporter;
    
    return transporter;
  } catch (error) {
    console.error('Error creating SMTP transporter:', error);
    return null;
  }
}

/**
 * Get or create Gmail OAuth client
 * @param userId User ID
 * @returns Configured Gmail OAuth client
 */
async function getGmailOAuthClient(userId: number) {
  try {
    const [userEmailSettings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.userId, userId));
    
    if (!userEmailSettings?.gmailClientId || !userEmailSettings?.gmailClientSecret || !userEmailSettings?.gmailRefreshToken) {
      throw new Error('Missing Gmail OAuth credentials');
    }
    
    const oauth2Client = new google.auth.OAuth2(
      userEmailSettings.gmailClientId,
      userEmailSettings.gmailClientSecret,
      'https://developers.google.com/oauthplayground' // Redirect URL
    );
    
    oauth2Client.setCredentials({
      refresh_token: userEmailSettings.gmailRefreshToken
    });
    
    // Refresh the token if needed
    const { token } = await oauth2Client.getAccessToken();
    
    // Update the token in the database if it changed
    if (token) {
      await db.update(emailSettings)
        .set({ gmailRefreshToken: token })
        .where(eq(emailSettings.userId, userId));
    }
    
    return oauth2Client;
  } catch (error) {
    console.error('Error getting Gmail OAuth client:', error);
    throw error;
  }
}

/**
 * Get a Gmail transporter for a user
 * @param userId User ID
 * @returns Configured Gmail transporter
 */
async function getGmailTransporter(userId: number): Promise<Transporter<SMTPTransport.SentMessageInfo> | null> {
  try {
    const oauth2Client = await getGmailOAuthClient(userId);
    const accessToken = await oauth2Client.getAccessToken();
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: (await db.select().from(users).where(eq(users.id, userId)))[0].email,
        clientId: oauth2Client._clientId,
        clientSecret: oauth2Client._clientSecret,
        refreshToken: oauth2Client.credentials.refresh_token,
        accessToken: accessToken.token,
      },
    });
    
    return transporter;
  } catch (error) {
    console.error('Error getting Gmail transporter:', error);
    return null;
  }
}

/**
 * Send an email using the user's configured provider
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Get user's email settings
    const [userEmailSettings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.userId, params.userId));
    
    if (!userEmailSettings || !userEmailSettings.isConfigured) {
      return { 
        success: false, 
        error: 'Email integration not configured for this user' 
      };
    }
    
    // Generate a unique message ID for tracking
    const messageId = `<${uuidv4()}@linkdripai.com>`;
    
    // Set up references for threading
    const references = params.references ? `${params.references} ${params.inReplyTo || ''}`.trim() : params.inReplyTo;
    
    // Get the opportunity to include contact information
    const [opportunity] = await db
      .select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.id, params.opportunityId));
    
    if (!opportunity) {
      return { 
        success: false, 
        error: 'Opportunity not found' 
      };
    }
    
    // Create new outreach email record
    const [emailRecord] = await db
      .insert(outreachEmails)
      .values({
        opportunityId: params.opportunityId,
        userId: params.userId,
        subject: params.subject,
        body: params.body,
        status: 'Sending',
        siteName: opportunity.domain,
        contactEmail: params.to,
        sentAt: new Date(),
        isFollowUp: !!params.inReplyTo,
        messageId,
        threadId: params.threadId || messageId,
        // Add other fields as needed
      })
      .returning();
    
    if (!emailRecord) {
      return { 
        success: false, 
        error: 'Failed to create email record' 
      };
    }
    
    // Send the email using the appropriate provider
    switch (userEmailSettings.provider) {
      case 'sendgrid': {
        if (!userEmailSettings.sendgridApiKey) {
          await updateEmailStatus(emailRecord.id, 'Failed', 'SendGrid API key not configured');
          return { 
            success: false, 
            error: 'SendGrid API key not configured' 
          };
        }
        
        // Initialize SendGrid client if needed
        initializeEmailClient('sendgrid', userEmailSettings.sendgridApiKey);
        
        // Send email with SendGrid
        const msg = {
          to: params.to,
          from: {
            email: params.fromEmail,
            name: params.fromName || userEmailSettings.fromName,
          },
          subject: params.subject,
          html: params.body,
          text: params.body.replace(/<[^>]*>?/gm, ''), // Strip HTML
          attachments: params.attachments,
          headers: {
            'Message-ID': messageId,
            ...(params.inReplyTo ? { 'In-Reply-To': params.inReplyTo } : {}),
            ...(references ? { 'References': references } : {}),
          },
        };
        
        try {
          await sgMail.send(msg);
          await updateEmailStatus(emailRecord.id, 'Sent');
          return { 
            success: true, 
            messageId 
          };
        } catch (error: any) {
          const errorMsg = error.response?.body?.errors?.[0]?.message || error.message;
          await updateEmailStatus(emailRecord.id, 'Failed', errorMsg);
          return { 
            success: false, 
            error: errorMsg 
          };
        }
      }
      
      case 'smtp': {
        // Get or create SMTP transporter
        let transporter = smtpTransporters[params.userId];
        if (!transporter) {
          transporter = await createSmtpTransporter(params.userId);
          if (!transporter) {
            await updateEmailStatus(emailRecord.id, 'Failed', 'Failed to create SMTP transporter');
            return { 
              success: false, 
              error: 'Failed to create SMTP transporter' 
            };
          }
        }
        
        // Send email with SMTP
        try {
          const info = await transporter.sendMail({
            from: `"${params.fromName || userEmailSettings.fromName}" <${params.fromEmail}>`,
            to: params.to,
            subject: params.subject,
            text: params.body.replace(/<[^>]*>?/gm, ''), // Strip HTML
            html: params.body,
            attachments: params.attachments,
            headers: {
              'Message-ID': messageId,
              ...(params.inReplyTo ? { 'In-Reply-To': params.inReplyTo } : {}),
              ...(references ? { 'References': references } : {}),
            },
          });
          
          await updateEmailStatus(emailRecord.id, 'Sent', undefined, info.messageId);
          return { 
            success: true, 
            messageId: info.messageId 
          };
        } catch (error: any) {
          await updateEmailStatus(emailRecord.id, 'Failed', error.message);
          return { 
            success: false, 
            error: error.message 
          };
        }
      }
      
      case 'gmail': {
        // Get Gmail transporter
        const transporter = await getGmailTransporter(params.userId);
        if (!transporter) {
          await updateEmailStatus(emailRecord.id, 'Failed', 'Failed to create Gmail transporter');
          return { 
            success: false, 
            error: 'Failed to create Gmail transporter' 
          };
        }
        
        // Send email with Gmail
        try {
          const info = await transporter.sendMail({
            from: `"${params.fromName || userEmailSettings.fromName}" <${params.fromEmail}>`,
            to: params.to,
            subject: params.subject,
            text: params.body.replace(/<[^>]*>?/gm, ''), // Strip HTML
            html: params.body,
            attachments: params.attachments,
            headers: {
              'Message-ID': messageId,
              ...(params.inReplyTo ? { 'In-Reply-To': params.inReplyTo } : {}),
              ...(references ? { 'References': references } : {}),
            },
          });
          
          await updateEmailStatus(emailRecord.id, 'Sent', undefined, info.messageId);
          return { 
            success: true, 
            messageId: info.messageId 
          };
        } catch (error: any) {
          await updateEmailStatus(emailRecord.id, 'Failed', error.message);
          return { 
            success: false, 
            error: error.message 
          };
        }
      }
      
      default:
        await updateEmailStatus(emailRecord.id, 'Failed', `Unsupported email provider: ${userEmailSettings.provider}`);
        return { 
          success: false, 
          error: `Unsupported email provider: ${userEmailSettings.provider}` 
        };
    }
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Update the status of an outreach email
 */
async function updateEmailStatus(emailId: number, status: string, errorMessage?: string, providerMessageId?: string) {
  try {
    await db.update(outreachEmails)
      .set({
        status,
        ...(errorMessage ? { errorMessage } : {}),
        ...(providerMessageId ? { providerMessageId } : {})
      })
      .where(eq(outreachEmails.id, emailId));
  } catch (error) {
    console.error(`Error updating email status for email ${emailId}:`, error);
  }
}

/**
 * Check for replies to sent emails
 * This should be run on a schedule to check for replies
 */
export async function checkForReplies(userId?: number) {
  try {
    // Get all emails that haven't been responded to yet
    // Limit to the specified user if provided
    const query = db.select()
      .from(outreachEmails)
      .where(
        and(
          eq(outreachEmails.status, 'Sent'),
          ...(userId ? [eq(outreachEmails.userId, userId)] : [])
        )
      );
    
    const pendingEmails = await query;
    
    if (pendingEmails.length === 0) {
      return { checked: 0, repliesFound: 0 };
    }
    
    // Group emails by user to batch check by provider
    const emailsByUser: Record<number, typeof pendingEmails> = {};
    for (const email of pendingEmails) {
      if (!emailsByUser[email.userId]) {
        emailsByUser[email.userId] = [];
      }
      emailsByUser[email.userId].push(email);
    }
    
    let repliesFound = 0;
    
    // Check for replies for each user
    for (const userId in emailsByUser) {
      const userEmails = emailsByUser[userId];
      
      // Get user's email settings
      const [userEmailSettings] = await db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.userId, parseInt(userId)));
      
      if (!userEmailSettings || !userEmailSettings.isConfigured) {
        console.warn(`Skipping reply check for user ${userId} - email not configured`);
        continue;
      }
      
      // Check for replies based on provider
      switch (userEmailSettings.provider) {
        case 'gmail':
          // For Gmail, we'd use the Gmail API to check for replies
          // This would require additional setup and permissions
          // Implementation details would go here
          break;
          
        case 'sendgrid':
          // For SendGrid, we'd use their inbound parse webhook
          // This would require setting up a webhook endpoint
          // Implementation details would go here
          break;
          
        case 'smtp':
          // For SMTP, we'd have to check the mailbox directly
          // This might require IMAP access
          // Implementation details would go here
          break;
          
        default:
          console.warn(`Unsupported email provider for checking replies: ${userEmailSettings.provider}`);
          break;
      }
    }
    
    return { checked: pendingEmails.length, repliesFound };
  } catch (error) {
    console.error('Error checking for replies:', error);
    throw error;
  }
}

/**
 * Process an incoming email reply
 */
export async function processEmailReply(incomingEmail: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  headers: Record<string, string>;
}) {
  try {
    // Extract message ID references to find the original email
    const inReplyTo = incomingEmail.headers['in-reply-to'];
    const references = incomingEmail.headers['references'];
    
    if (!inReplyTo && !references) {
      console.warn('Received email without In-Reply-To or References headers, cannot match to outreach');
      return { success: false, error: 'Cannot match reply to original email' };
    }
    
    // Parse all message IDs from headers
    const messageIds = [];
    if (inReplyTo) {
      messageIds.push(inReplyTo);
    }
    if (references) {
      messageIds.push(...references.split(' '));
    }
    
    // Find the original email using message IDs
    const [originalEmail] = await db
      .select()
      .from(outreachEmails)
      .where(inArray(outreachEmails.messageId, messageIds));
    
    if (!originalEmail) {
      console.warn('Could not find original email for incoming reply');
      return { success: false, error: 'Original email not found' };
    }
    
    // Update the original email with reply information
    await db.update(outreachEmails)
      .set({
        status: 'Replied',
        responseAt: new Date(),
        replyContent: incomingEmail.html || incomingEmail.text,
        replyMessageId: incomingEmail.headers['message-id'],
        replyHeaders: incomingEmail.headers
      })
      .where(eq(outreachEmails.id, originalEmail.id));
    
    // Update analytics
    await updateEmailResponseStats(originalEmail.userId);
    
    return { 
      success: true, 
      originalEmailId: originalEmail.id,
      opportunityId: originalEmail.opportunityId
    };
  } catch (error: any) {
    console.error('Error processing email reply:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update email response statistics for a user
 */
async function updateEmailResponseStats(userId: number) {
  try {
    // Get count of emails that received responses
    const [{ count }] = await db
      .select({ count: db.fn.count<number>(outreachEmails.id) })
      .from(outreachEmails)
      .where(
        and(
          eq(outreachEmails.userId, userId),
          eq(outreachEmails.status, 'Replied')
        )
      );
    
    // Update the user's analytics
    await db.update(users)
      .set({
        // Placeholder for analytics updates
        // We would update the appropriate fields here
      })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error(`Error updating email response stats for user ${userId}:`, error);
  }
}

/**
 * Get email templates for a user
 */
export async function getEmailTemplates(userId: number): Promise<EmailTemplate[]> {
  // For now we'll return some basic templates
  // In the future, these would be stored in the database
  return [
    {
      name: 'Guest Post Request',
      subject: 'Guest Post Opportunity for {{website}}',
      body: `
        <p>Hi there,</p>
        <p>I'm {{name}} from {{website}}. I came across your website and I'm interested in contributing a guest post.</p>
        <p>Our site focuses on {{niche}} and I believe our content would be valuable to your audience.</p>
        <p>Would you be interested in a guest post on one of the following topics?</p>
        <ul>
          <li>{{topic1}}</li>
          <li>{{topic2}}</li>
          <li>{{topic3}}</li>
        </ul>
        <p>Let me know what you think!</p>
        <p>Best regards,<br>{{name}}</p>
      `,
      variables: ['website', 'name', 'niche', 'topic1', 'topic2', 'topic3']
    },
    {
      name: 'Resource Page Outreach',
      subject: 'Resource for your {{topic}} page',
      body: `
        <p>Hello,</p>
        <p>I was researching {{topic}} resources and came across your page: {{page}}.</p>
        <p>I noticed you have a great collection of resources, and I thought you might be interested in adding our guide: {{resource_title}}.</p>
        <p>It covers {{resource_description}}</p>
        <p>You can check it out here: {{resource_url}}</p>
        <p>Let me know if you'd like any additional information!</p>
        <p>Thanks,<br>{{name}}</p>
      `,
      variables: ['topic', 'page', 'resource_title', 'resource_description', 'resource_url', 'name']
    },
    {
      name: 'Broken Link Outreach',
      subject: 'Broken link on your website',
      body: `
        <p>Hi there,</p>
        <p>I was browsing your website and noticed that you have a broken link on this page: {{page_url}}</p>
        <p>The broken link is pointing to: {{broken_url}}</p>
        <p>I actually have a resource on a similar topic that might be a good replacement: {{replacement_url}}</p>
        <p>Just thought I'd let you know!</p>
        <p>Best,<br>{{name}}</p>
      `,
      variables: ['page_url', 'broken_url', 'replacement_url', 'name']
    }
  ];
}

/**
 * Verify email settings for a user
 */
export async function verifyEmailSettings(userId: number): Promise<{ success: boolean; message: string }> {
  try {
    // Get user's email settings
    const [userEmailSettings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.userId, userId));
    
    if (!userEmailSettings) {
      return { 
        success: false, 
        message: 'No email settings found for this user' 
      };
    }
    
    // Test connection based on provider
    switch (userEmailSettings.provider) {
      case 'sendgrid': {
        if (!userEmailSettings.sendgridApiKey) {
          return { 
            success: false, 
            message: 'SendGrid API key not configured' 
          };
        }
        
        try {
          // Test SendGrid API key by making a simple API call
          const response = await axios.get('https://api.sendgrid.com/v3/user/credits', {
            headers: {
              'Authorization': `Bearer ${userEmailSettings.sendgridApiKey}`
            }
          });
          
          if (response.status === 200) {
            // Update verification status
            await db.update(emailSettings)
              .set({ isVerified: true })
              .where(eq(emailSettings.userId, userId));
            
            return { 
              success: true, 
              message: 'SendGrid API key verified successfully' 
            };
          } else {
            return { 
              success: false, 
              message: `SendGrid API returned unexpected status: ${response.status}` 
            };
          }
        } catch (error: any) {
          return { 
            success: false, 
            message: `SendGrid API verification failed: ${error.message}` 
          };
        }
      }
      
      case 'smtp': {
        // Test SMTP connection
        const transporter = await createSmtpTransporter(userId);
        if (!transporter) {
          return { 
            success: false, 
            message: 'Failed to create SMTP transporter' 
          };
        }
        
        try {
          // Verify the connection
          await transporter.verify();
          
          // Update verification status
          await db.update(emailSettings)
            .set({ isVerified: true })
            .where(eq(emailSettings.userId, userId));
          
          return { 
            success: true, 
            message: 'SMTP connection verified successfully' 
          };
        } catch (error: any) {
          return { 
            success: false, 
            message: `SMTP verification failed: ${error.message}` 
          };
        }
      }
      
      case 'gmail': {
        // Test Gmail OAuth connection
        try {
          const transporter = await getGmailTransporter(userId);
          if (!transporter) {
            return { 
              success: false, 
              message: 'Failed to create Gmail transporter' 
            };
          }
          
          // Verify the connection
          await transporter.verify();
          
          // Update verification status
          await db.update(emailSettings)
            .set({ isVerified: true })
            .where(eq(emailSettings.userId, userId));
          
          return { 
            success: true, 
            message: 'Gmail connection verified successfully' 
          };
        } catch (error: any) {
          return { 
            success: false, 
            message: `Gmail verification failed: ${error.message}` 
          };
        }
      }
      
      default:
        return { 
          success: false, 
          message: `Unsupported email provider: ${userEmailSettings.provider}` 
        };
    }
  } catch (error: any) {
    console.error('Error verifying email settings:', error);
    return { 
      success: false, 
      message: `Verification failed: ${error.message}` 
    };
  }
}

/**
 * Send a test email
 */
export async function sendTestEmail(userId: number, testEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return { 
        success: false, 
        message: 'User not found' 
      };
    }
    
    // Get email settings
    const [userEmailSettings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.userId, userId));
    
    if (!userEmailSettings || !userEmailSettings.isConfigured) {
      return { 
        success: false, 
        message: 'Email settings not configured' 
      };
    }
    
    // Send test email using the email service
    const result = await sendEmail({
      userId,
      opportunityId: 0, // Dummy ID for test email
      to: testEmail,
      fromEmail: userEmailSettings.fromEmail || user.email,
      fromName: userEmailSettings.fromName || `${user.firstName} ${user.lastName}`,
      subject: 'LinkDripAI Email Integration Test',
      body: `
        <h1>Email Integration Test</h1>
        <p>This is a test email from LinkDripAI to verify your email integration settings.</p>
        <p>If you're receiving this, your email integration is working correctly!</p>
        <p>Best regards,<br>The LinkDripAI Team</p>
      `
    });
    
    if (result.success) {
      return { 
        success: true, 
        message: 'Test email sent successfully!' 
      };
    } else {
      return { 
        success: false, 
        message: `Failed to send test email: ${result.error}` 
      };
    }
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return { 
      success: false, 
      message: `Error sending test email: ${error.message}` 
    };
  }
}

/**
 * Create or update email settings for a user
 */
export async function saveEmailSettings(userId: number, settings: {
  provider: EmailProvider;
  fromEmail: string;
  fromName?: string;
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    // Check if user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return { 
        success: false, 
        message: 'User not found' 
      };
    }
    
    // Get existing settings if any
    const [existingSettings] = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.userId, userId));
    
    // Validate settings based on provider
    let isConfigured = false;
    
    switch (settings.provider) {
      case 'sendgrid':
        isConfigured = !!settings.sendgridApiKey && !!settings.fromEmail;
        break;
        
      case 'smtp':
        isConfigured = !!(
          settings.smtpHost && 
          settings.smtpPort && 
          settings.smtpUsername && 
          settings.smtpPassword &&
          settings.fromEmail
        );
        break;
        
      case 'gmail':
        isConfigured = !!(
          settings.gmailClientId && 
          settings.gmailClientSecret && 
          (settings.gmailRefreshToken || existingSettings?.gmailRefreshToken) &&
          settings.fromEmail
        );
        break;
        
      default:
        return { 
          success: false, 
          message: `Unsupported email provider: ${settings.provider}` 
        };
    }
    
    if (!isConfigured) {
      return { 
        success: false, 
        message: 'Incomplete email settings for the selected provider' 
      };
    }
    
    if (existingSettings) {
      // Update existing settings
      await db.update(emailSettings)
        .set({
          provider: settings.provider,
          fromEmail: settings.fromEmail,
          fromName: settings.fromName,
          isConfigured,
          // Reset verification since settings changed
          isVerified: false,
          // Provider-specific settings
          ...(settings.sendgridApiKey ? { sendgridApiKey: settings.sendgridApiKey } : {}),
          ...(settings.smtpHost ? { smtpHost: settings.smtpHost } : {}),
          ...(settings.smtpPort ? { smtpPort: settings.smtpPort } : {}),
          ...(settings.smtpUsername ? { smtpUsername: settings.smtpUsername } : {}),
          ...(settings.smtpPassword ? { smtpPassword: settings.smtpPassword } : {}),
          ...(settings.gmailClientId ? { gmailClientId: settings.gmailClientId } : {}),
          ...(settings.gmailClientSecret ? { gmailClientSecret: settings.gmailClientSecret } : {}),
          ...(settings.gmailRefreshToken ? { gmailRefreshToken: settings.gmailRefreshToken } : {}),
          updatedAt: new Date()
        })
        .where(eq(emailSettings.userId, userId));
    } else {
      // Create new settings
      await db.insert(emailSettings)
        .values({
          userId,
          provider: settings.provider,
          fromEmail: settings.fromEmail,
          fromName: settings.fromName,
          isConfigured,
          // Provider-specific settings
          sendgridApiKey: settings.sendgridApiKey,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpUsername: settings.smtpUsername,
          smtpPassword: settings.smtpPassword,
          gmailClientId: settings.gmailClientId,
          gmailClientSecret: settings.gmailClientSecret,
          gmailRefreshToken: settings.gmailRefreshToken,
        });
    }
    
    // Update user's fromEmail in the main user record
    await db.update(users)
      .set({
        fromEmail: settings.fromEmail,
        emailConfigured: isConfigured,
        emailVerified: false, // Reset verification
      })
      .where(eq(users.id, userId));
    
    return { 
      success: true, 
      message: 'Email settings saved successfully' 
    };
  } catch (error: any) {
    console.error('Error saving email settings:', error);
    return { 
      success: false, 
      message: `Error saving email settings: ${error.message}` 
    };
  }
}