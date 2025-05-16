/**
 * Email Service
 * 
 * A centralized service for handling email operations including:
 * - Sending emails through different providers (SendGrid, SMTP, Gmail)
 * - Adding tracking and threading capabilities to emails
 * - Processing incoming emails and replies
 * - Managing email verification
 */
import nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { users, outreachEmails, userEmailSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from '../vite';
import sgMail from '@sendgrid/mail';

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

export class EmailService {
  private config: EmailConfig;
  private transporter: any = null;
  private domain: string = 'linkdripai.com';
  
  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeProvider();
  }
  
  /**
   * Initialize the appropriate email provider based on user configuration
   */
  private initializeProvider() {
    switch (this.config.provider) {
      case 'sendgrid':
        if (!this.config.sendgridApiKey) {
          throw new Error('SendGrid API key is required');
        }
        sgMail.setApiKey(this.config.sendgridApiKey);
        break;
        
      case 'smtp':
        if (!this.config.smtpHost || !this.config.smtpPort || 
            !this.config.smtpUsername || !this.config.smtpPassword) {
          throw new Error('SMTP configuration is incomplete');
        }
        
        this.transporter = createTransport({
          host: this.config.smtpHost,
          port: this.config.smtpPort,
          secure: this.config.smtpPort === 465, // true for 465, false for other ports
          auth: {
            user: this.config.smtpUsername,
            pass: this.config.smtpPassword,
          },
        });
        break;
        
      case 'gmail':
        if (!this.config.gmailClientId || !this.config.gmailClientSecret || !this.config.gmailRefreshToken) {
          throw new Error('Gmail OAuth configuration is incomplete');
        }
        
        this.transporter = createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: this.config.fromEmail,
            clientId: this.config.gmailClientId,
            clientSecret: this.config.gmailClientSecret,
            refreshToken: this.config.gmailRefreshToken,
          },
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
    return `<email-${emailId}-${randomBytes(8).toString('hex')}@${this.domain}>`;
  }
  
  private generateThreadId(): string {
    return `thread-${randomBytes(12).toString('hex')}@${this.domain}`;
  }
  
  /**
   * Add tracking headers to outgoing emails
   */
  private addTrackingHeaders(emailId: number, userId: number, prospectId: number) {
    return {
      'X-LinkDripAI-Email-ID': emailId.toString(),
      'X-LinkDripAI-User-ID': userId.toString(),
      'X-LinkDripAI-Prospect-ID': prospectId.toString(),
    };
  }
  
  /**
   * Send an email with tracking capabilities
   */
  public async sendEmail(emailId: number, userId: number, prospectId: number, content: EmailContent) {
    const messageId = this.generateMessageId(emailId);
    const threadId = this.generateThreadId();
    
    // Headers for tracking
    const headers = this.addTrackingHeaders(emailId, userId, prospectId);
    
    // Create email content object
    const email = {
      from: this.config.fromName 
        ? `"${this.config.fromName}" <${this.config.fromEmail}>`
        : this.config.fromEmail,
      to: content.to,
      subject: content.subject,
      html: content.body,
      text: this.stripHtml(content.body),
      cc: content.cc,
      bcc: content.bcc,
      replyTo: content.replyTo || this.config.fromEmail,
      headers: {
        ...headers,
        'Message-ID': messageId,
        'X-Thread-ID': threadId,
      },
    };
    
    try {
      let result;
      
      // Send email through the appropriate provider
      if (this.config.provider === 'sendgrid') {
        result = await sgMail.send(email);
      } else {
        // For SMTP and Gmail
        result = await this.transporter.sendMail(email);
      }
      
      // Update the email record with the tracking IDs
      await db.update(outreachEmails)
        .set({
          messageId,
          threadId,
          status: 'Sent',
          sentAt: new Date(),
        })
        .where(eq(outreachEmails.id, emailId));
      
      log(`Email sent successfully: ${messageId}`, 'email-service');
      return { messageId, threadId, result };
    } catch (error) {
      log(`Failed to send email: ${error}`, 'email-service');
      
      // Update the email record to reflect the failure
      const errorMsg = error instanceof Error ? error.message : 'Failed to send email';
      await db.update(outreachEmails)
        .set({
          status: 'Failed',
          errorMessage: errorMsg,
        })
        .where(eq(outreachEmails.id, emailId));
      
      throw error;
    }
  }
  
  /**
   * Process incoming email (from webhook or API polling)
   */
  public async processIncomingEmail(email: any) {
    // This will be implemented in the webhook routes
    log('Processing incoming email', 'email-service');
  }
  
  /**
   * Check for replies to sent emails (for non-webhook providers)
   */
  public async checkForReplies(userId: number) {
    // This would be implemented for providers that don't support webhooks
    // It would poll an inbox for replies to sent emails
    log(`Checking for replies for user ${userId}`, 'email-service');
  }
  
  /**
   * Send a verification email to confirm email ownership
   */
  public async sendVerificationEmail(userId: number, email: string) {
    // Generate a verification token
    const verificationToken = randomBytes(32).toString('hex');
    
    // Store the token in the database
    await db.update(userEmailSettings)
      .set({
        verificationToken,
        verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      })
      .where(eq(userEmailSettings.userId, userId));
    
    // Create a verification link
    const verificationLink = `https://linkdripai.com/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    
    // Email content
    const content = {
      to: email,
      subject: 'Verify Your Email for LinkDripAI',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5568;">Verify Your Email</h2>
          <p>Thank you for setting up your email with LinkDripAI. Please verify your email address by clicking the button below:</p>
          <a href="${verificationLink}" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
          <p>If you did not request this verification, please ignore this email.</p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `,
    };
    
    try {
      // For verification emails, we use the platform's default email service
      // rather than the user's configured service
      if (this.config.provider === 'sendgrid') {
        await sgMail.send({
          from: this.config.fromEmail,
          to: content.to,
          subject: content.subject,
          html: content.body,
          text: this.stripHtml(content.body),
        });
      } else {
        await this.transporter.sendMail({
          from: this.config.fromEmail,
          to: content.to,
          subject: content.subject,
          html: content.body,
          text: this.stripHtml(content.body),
        });
      }
      
      log(`Verification email sent to ${email}`, 'email-service');
      return true;
    } catch (error) {
      log(`Failed to send verification email: ${error}`, 'email-service');
      throw error;
    }
  }
  
  /**
   * Utility: Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<\/?[^>]+(>|$)/g, '');
  }
}

/**
 * Factory function to create an EmailService instance for a specific user
 */
export async function createEmailServiceForUser(userId: number): Promise<EmailService | null> {
  try {
    // Get the user's email settings
    const [userSettings] = await db.select()
      .from(userEmailSettings)
      .where(eq(userEmailSettings.userId, userId));
    
    if (!userSettings || !userSettings.isConfigured) {
      log(`Email not configured for user ${userId}`, 'email-service');
      return null;
    }
    
    // Get the user record for the email address
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      log(`User ${userId} not found`, 'email-service');
      return null;
    }
    
    const config: EmailConfig = {
      provider: userSettings.provider as 'sendgrid' | 'smtp' | 'gmail',
      fromEmail: userSettings.fromEmail || user.email,
      fromName: userSettings.fromName || `${user.firstName} ${user.lastName}`.trim(),
    };
    
    // Add provider-specific settings and convert null to undefined
    if (userSettings.provider === 'sendgrid') {
      config.sendgridApiKey = userSettings.sendgridApiKey === null ? undefined : userSettings.sendgridApiKey;
    } else if (userSettings.provider === 'smtp') {
      config.smtpHost = userSettings.smtpHost === null ? undefined : userSettings.smtpHost;
      config.smtpPort = userSettings.smtpPort === null ? undefined : userSettings.smtpPort;
      config.smtpUsername = userSettings.smtpUsername === null ? undefined : userSettings.smtpUsername;
      config.smtpPassword = userSettings.smtpPassword === null ? undefined : userSettings.smtpPassword;
    } else if (userSettings.provider === 'gmail') {
      config.gmailClientId = userSettings.gmailClientId === null ? undefined : userSettings.gmailClientId;
      config.gmailClientSecret = userSettings.gmailClientSecret === null ? undefined : userSettings.gmailClientSecret;
      config.gmailRefreshToken = userSettings.gmailRefreshToken === null ? undefined : userSettings.gmailRefreshToken;
    }
    
    // Create and return the email service
    return new EmailService(config);
  } catch (error) {
    log(`Error creating email service: ${error}`, 'email-service');
    return null;
  }
}