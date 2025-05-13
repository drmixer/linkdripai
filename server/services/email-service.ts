/**
 * Email Service
 * 
 * A centralized service for handling email operations including:
 * - Sending emails through different providers (SendGrid, SMTP, Gmail)
 * - Adding tracking and threading capabilities to emails
 * - Processing incoming emails and replies
 * - Managing email verification
 */

import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { db } from "../db";
import { outreachEmails, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as SendGrid from '@sendgrid/mail';

// Types for email configuration
interface EmailConfig {
  provider: 'sendgrid' | 'smtp' | 'gmail';
  fromEmail: string;
  fromName?: string;
  // Provider-specific settings
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  gmailClientId?: string;
  gmailClientSecret?: string;
  gmailRefreshToken?: string;
}

interface EmailContent {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

// Constants
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'linkdripai.com';
const PLATFORM_NAME = 'LinkDripAI';

export class EmailService {
  private config: EmailConfig;
  private transporter: any = null;
  
  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeProvider();
  }
  
  /**
   * Initialize the appropriate email provider based on user configuration
   */
  private initializeProvider() {
    switch(this.config.provider) {
      case 'sendgrid':
        if (!this.config.sendgridApiKey) {
          throw new Error('SendGrid API key is required');
        }
        SendGrid.setApiKey(this.config.sendgridApiKey);
        break;
        
      case 'smtp':
        if (!this.config.smtpHost || !this.config.smtpPort || 
            !this.config.smtpUsername || !this.config.smtpPassword) {
          throw new Error('SMTP configuration is incomplete');
        }
        
        this.transporter = nodemailer.createTransport({
          host: this.config.smtpHost,
          port: this.config.smtpPort,
          secure: this.config.smtpPort === 465,
          auth: {
            user: this.config.smtpUsername,
            pass: this.config.smtpPassword
          }
        });
        break;
        
      case 'gmail':
        if (!this.config.gmailClientId || !this.config.gmailClientSecret || !this.config.gmailRefreshToken) {
          throw new Error('Gmail OAuth configuration is incomplete');
        }
        
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: this.config.fromEmail,
            clientId: this.config.gmailClientId,
            clientSecret: this.config.gmailClientSecret,
            refreshToken: this.config.gmailRefreshToken
          }
        });
        break;
        
      default:
        throw new Error(`Unsupported email provider: ${this.config.provider}`);
    }
  }
  
  /**
   * Generate unique message and thread IDs for tracking
   */
  private generateMessageId(emailId: number): string {
    const randomPart = randomUUID().replace(/-/g, '').substring(0, 8);
    return `${emailId}-${randomPart}@${EMAIL_DOMAIN}`;
  }
  
  private generateThreadId(): string {
    return randomUUID().replace(/-/g, '').substring(0, 12);
  }
  
  /**
   * Add tracking headers to outgoing emails
   */
  private addTrackingHeaders(emailId: number, userId: number, prospectId: number) {
    const messageId = this.generateMessageId(emailId);
    const threadId = this.generateThreadId();
    
    const headers = {
      'X-LinkDripAI-Message-ID': messageId,
      'X-LinkDripAI-Thread-ID': threadId,
      'X-LinkDripAI-User-ID': userId.toString(),
      'X-LinkDripAI-Prospect-ID': prospectId.toString(),
      'X-LinkDripAI-Email-ID': emailId.toString(),
    };
    
    return { headers, messageId, threadId };
  }
  
  /**
   * Send an email with tracking capabilities
   */
  public async sendEmail(emailId: number, userId: number, prospectId: number, content: EmailContent) {
    // Add tracking information
    const { headers, messageId, threadId } = this.addTrackingHeaders(emailId, userId, prospectId);
    
    // Set up common email options
    const emailOptions = {
      from: {
        name: this.config.fromName || PLATFORM_NAME,
        email: this.config.fromEmail
      },
      to: content.to,
      subject: content.subject,
      html: content.body,
      text: this.stripHtml(content.body),
      cc: content.cc,
      bcc: content.bcc,
      replyTo: content.replyTo || this.config.fromEmail,
      headers: headers,
      messageId: `<${messageId}>`,
    };
    
    try {
      let result;
      
      // Send via appropriate provider
      if (this.config.provider === 'sendgrid') {
        result = await SendGrid.send(emailOptions);
      } else {
        // For SMTP and Gmail
        result = await this.transporter.sendMail(emailOptions);
      }
      
      // Update the email record with tracking information
      await db.update(outreachEmails)
        .set({
          messageId,
          threadId,
          providerMessageId: result.messageId || null,
          status: 'Sent',
          sentAt: new Date()
        })
        .where(eq(outreachEmails.id, emailId));
      
      return { success: true, messageId, threadId };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Process incoming email (from webhook or API polling)
   */
  public async processIncomingEmail(email: any) {
    // Extract tracking headers
    const headers = email.headers || {};
    const messageId = headers['X-LinkDripAI-Message-ID'] || 
                      headers['x-linkdripai-message-id'] || null;
    
    if (!messageId) {
      // Not a tracked email
      return { processed: false, reason: 'No tracking ID found' };
    }
    
    // Find the original email
    const [originalEmail] = await db.select()
      .from(outreachEmails)
      .where(eq(outreachEmails.messageId, messageId));
      
    if (!originalEmail) {
      return { processed: false, reason: 'Original email not found' };
    }
    
    // Update the original email with the reply
    await db.update(outreachEmails)
      .set({
        status: 'Responded',
        responseAt: new Date(),
        replyContent: email.text || email.html || '',
        replyHeaders: headers,
      })
      .where(eq(outreachEmails.id, originalEmail.id));
      
    return { processed: true, originalEmailId: originalEmail.id };
  }
  
  /**
   * Check for replies to sent emails (for non-webhook providers)
   */
  public async checkForReplies(userId: number) {
    // This would need to be implemented specifically for Gmail and IMAP
    // For Gmail, it would use the Gmail API to search for emails with our headers
    // For SMTP/IMAP, it would connect to the inbox and search for replies
    
    // Placeholder for future implementation
    return { checked: true, newReplies: 0 };
  }
  
  /**
   * Send a verification email to confirm email ownership
   */
  public async sendVerificationEmail(userId: number, email: string) {
    // Generate verification token
    const token = randomUUID();
    
    // Store token in database
    // This would need a verification tokens table in a full implementation
    
    // Create verification link
    const verificationLink = `${process.env.APP_URL || 'https://linkdripai.com'}/verify-email?token=${token}`;
    
    // Send email
    const content = {
      to: email,
      subject: 'Verify your email address for LinkDripAI',
      body: `
        <p>Thank you for setting up your email integration with LinkDripAI.</p>
        <p>Please click the button below to verify this email address:</p>
        <p>
          <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 4px;">
            Verify Email Address
          </a>
        </p>
        <p>If you didn't request this verification, you can safely ignore this email.</p>
        <p>Thanks,<br>The LinkDripAI Team</p>
      `,
    };
    
    // Use a simpler email sending process for verification
    try {
      if (this.config.provider === 'sendgrid') {
        await SendGrid.send({
          from: {
            name: PLATFORM_NAME,
            email: this.config.fromEmail
          },
          to: content.to,
          subject: content.subject,
          html: content.body,
          text: this.stripHtml(content.body),
        });
      } else {
        // For SMTP and Gmail
        await this.transporter.sendMail({
          from: `"${PLATFORM_NAME}" <${this.config.fromEmail}>`,
          to: content.to,
          subject: content.subject,
          html: content.body,
          text: this.stripHtml(content.body),
        });
      }
      
      return { success: true, token };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Utility: Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}

/**
 * Factory function to create an EmailService instance for a specific user
 */
export async function createEmailServiceForUser(userId: number): Promise<EmailService | null> {
  try {
    // Get user's email settings
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user || !user.emailProvider || !user.fromEmail) {
      return null;
    }
    
    // Create config based on user settings
    const config: EmailConfig = {
      provider: user.emailProvider as 'sendgrid' | 'smtp' | 'gmail',
      fromEmail: user.fromEmail,
      fromName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
    };
    
    // Add provider-specific settings
    if (user.emailProvider === 'sendgrid' && user.sendgridApiKey) {
      config.sendgridApiKey = user.sendgridApiKey;
    } else if (user.emailProvider === 'smtp' && user.smtpHost && user.smtpUsername && user.smtpPassword) {
      config.smtpHost = user.smtpHost;
      config.smtpPort = user.smtpPort || 587;
      config.smtpUsername = user.smtpUsername;
      config.smtpPassword = user.smtpPassword;
    } else if (user.emailProvider === 'gmail' && user.gmailClientId && user.gmailClientSecret && user.gmailRefreshToken) {
      config.gmailClientId = user.gmailClientId;
      config.gmailClientSecret = user.gmailClientSecret;
      config.gmailRefreshToken = user.gmailRefreshToken;
    } else {
      return null; // Missing required provider settings
    }
    
    return new EmailService(config);
  } catch (error) {
    console.error('Failed to create EmailService for user:', error);
    return null;
  }
}