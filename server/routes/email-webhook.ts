/**
 * Email Webhook Routes
 * 
 * Handles incoming emails and webhook callbacks from email providers
 */
import { Request, Response, Router } from 'express';
import { createEmailServiceForUser } from '../services/email-service';
import { storage } from '../storage';
import { db } from '../db';
import { outreachEmails } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from '../vite';

const router = Router();

/**
 * SendGrid Webhook
 * Handles incoming emails from SendGrid
 */
router.post('/sendgrid', async (req, res) => {
  try {
    log('SendGrid webhook received', 'email-webhook');
    
    // SendGrid sends an array of events
    const events = req.body || [];
    
    for (const event of events) {
      if (event.event === 'inbound') {
        await processIncomingEmail({
          provider: 'sendgrid',
          from: event.from,
          to: event.to,
          subject: event.subject,
          body: event.html || event.text,
          headers: event.headers,
          messageId: event.messageId,
          timestamp: new Date(),
        });
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    log(`Error processing SendGrid webhook: ${error}`, 'email-webhook');
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Generic Email Webhook
 * Handles incoming emails in a standardized format
 */
router.post('/generic', async (req, res) => {
  try {
    log('Generic email webhook received', 'email-webhook');
    
    const { 
      provider, 
      from, 
      to, 
      subject, 
      body, 
      headers, 
      messageId,
      threadId,
      inReplyTo
    } = req.body;
    
    if (!from || !to || !body) {
      return res.status(400).send('Missing required fields');
    }
    
    await processIncomingEmail({
      provider,
      from,
      to,
      subject,
      body,
      headers,
      messageId,
      threadId,
      inReplyTo,
      timestamp: new Date(),
    });
    
    res.status(200).send('OK');
  } catch (error) {
    log(`Error processing generic webhook: ${error}`, 'email-webhook');
    res.status(500).send('Error processing webhook');
  }
});

/**
 * Process an incoming email or reply
 */
async function processIncomingEmail(emailData: {
  provider: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  headers?: any;
  messageId?: string;
  threadId?: string;
  inReplyTo?: string;
  timestamp: Date;
}) {
  try {
    const { from, to, subject, body, messageId, inReplyTo, threadId } = emailData;
    
    // Extract the actual email address from the "from" field (which might be "John Doe <john@example.com>")
    const fromEmail = extractEmailAddress(from);
    const toEmail = extractEmailAddress(to);
    
    // Look for a matching sent email that might be replied to
    let matchingEmailId: number | null = null;
    
    // First try to match by In-Reply-To header which is most reliable
    if (inReplyTo) {
      const [matchByReplyTo] = await db.select()
        .from(outreachEmails)
        .where(eq(outreachEmails.messageId, inReplyTo));
      
      if (matchByReplyTo) {
        matchingEmailId = matchByReplyTo.id;
      }
    }
    
    // Then try to match by thread ID
    if (!matchingEmailId && threadId) {
      const [matchByThread] = await db.select()
        .from(outreachEmails)
        .where(eq(outreachEmails.threadId, threadId));
      
      if (matchByThread) {
        matchingEmailId = matchByThread.id;
      }
    }
    
    // If still no match, try to match by subject line (naive but fallback)
    if (!matchingEmailId && subject) {
      // If it starts with Re: or RE: or re:, try to match the original subject
      const cleanSubject = subject.replace(/^re:\s*/i, '').trim();
      
      const [matchBySubject] = await db.select()
        .from(outreachEmails)
        .where(eq(outreachEmails.subject, cleanSubject));
      
      if (matchBySubject) {
        matchingEmailId = matchBySubject.id;
      }
    }
    
    // If we found a matching email, update it
    if (matchingEmailId) {
      await db.update(outreachEmails)
        .set({
          status: 'Responded',
          responseAt: new Date(),
          replyContent: body,
          // Safely add fields without type issues
          ...(messageId ? { replyMessageId: messageId } : {})
        })
        .where(eq(outreachEmails.id, matchingEmailId));
      
      log(`Updated email ${matchingEmailId} as responded`, 'email-webhook');
    } else {
      // If no matching email, this might be a new incoming email (not a reply)
      // You could store it separately or ignore depending on your requirements
      log(`Received non-matching email from ${fromEmail}`, 'email-webhook');
    }
  } catch (error) {
    log(`Error processing email: ${error}`, 'email-webhook');
    throw error;
  }
}

/**
 * Extract email address from a string like "John Doe <john@example.com>"
 */
function extractEmailAddress(input: string): string {
  // If it's already just an email, return it
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
    return input;
  }
  
  // Try to extract email from a format like "Name <email@example.com>"
  const matches = input.match(/<([^>]+)>/);
  if (matches && matches[1]) {
    return matches[1];
  }
  
  // If all else fails, just return the input
  return input;
}

export default router;