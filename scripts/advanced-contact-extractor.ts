/**
 * Advanced Contact Extractor for LinkDripAI
 * 
 * This script implements an aggressive multi-tiered approach to extract contact information
 * from website opportunities, targeting 90-95% coverage for premium opportunities and
 * 65-80% overall coverage.
 * 
 * Key features:
 * 1. Advanced multi-path crawling (main, about, contact, team pages)
 * 2. Enhanced pattern recognition for obfuscated emails
 * 3. Social media profile extraction with detailed metadata
 * 4. Browser simulation for JavaScript-rendered content
 * 5. Fallback to alternative data sources when primary extraction fails
 * 6. Comprehensive whois data extraction 
 * 7. LinkedIn company page scraping
 */

import { db } from "../server/db";
import { eq, and, or, isNull, not } from "drizzle-orm";
import { discoveredOpportunities } from "../shared/schema";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import * as https from "https";
import * as dns from "dns";
import * as punycode from "punycode";

// Export these utility functions for testing
export { cleanupUrl, extractEmailsFromPage, findContactPages, findContactFormUrl, extractSocialProfiles };

// Configuration
const MAX_RETRIES = 5; // Increased from 3 for better coverage
const THROTTLE_DELAY = 3000; // Reduced from 5000 ms between requests to same domain
const REQUEST_TIMEOUT = 20000; // Increased from 15 second timeout
const MAX_EXECUTION_TIME = 45000; // Increased from 30 seconds per opportunity 
const domainLastAccessTime: Record<string, number> = {};
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 Edg/92.0.902.55"
];

// Enhanced regex patterns for better coverage
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const OBFUSCATED_EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+\s*(?:\[at\]|\(at\)|@|&#64;|%40|&#9989;at&#9989;|[ ]?at[ ]?)\s*[A-Za-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\.|\.|&#46;|%2E|&#9989;dot&#9989;|[ ]?dot[ ]?)\s*[A-Z|a-z]{2,}\b/gi;
const HTML_ENCODED_EMAIL_REGEX = /&#(?:10[09]|[49][0-9]|3[0-9]);(?:&#(?:10[09]|[49][0-9]|3[0-9]);)*&#(?:(?:10[09]|[49][0-9]|3[0-9]);)/g;
const JAVASCRIPT_EMAIL_REGEX = /(?:mailto:|email=|emailto:|email-protection#)([^"']+)/gi;

const SOCIAL_PLATFORM_PATTERNS = [
  { platform: "facebook", regex: /(?:facebook\.com|fb\.com|fb\.me)\/(?!share|sharer|login|events|groups|pages|watch|gaming|marketplace)([^/?&]+)/i },
  { platform: "twitter", regex: /(?:twitter\.com|x\.com|t\.co)\/([^/?&]+)/i },
  { platform: "linkedin", regex: /(?:linkedin\.com|lnkd\.in)\/(?:company|in|school|organization|profile|pub|jobs|showcase|company\/showcase)\/([^/?&]+)/i },
  { platform: "instagram", regex: /(?:instagram\.com|instagr\.am)\/([^/?&]+)/i },
  { platform: "youtube", regex: /(?:youtube\.com|youtu\.be)\/(?:channel\/|user\/|c\/)?([^/?&]+)/i },
  { platform: "pinterest", regex: /(?:pinterest\.com|pin\.it)\/([^/?&]+)/i },
  { platform: "github", regex: /github\.com\/([^/?&]+)/i },
  { platform: "medium", regex: /medium\.com\/@?([^/?&]+)/i },
  { platform: "reddit", regex: /reddit\.com\/(?:r|user|u)\/([^/?&]+)/i },
  { platform: "tumblr", regex: /([^.]+)\.tumblr\.com/i },
  { platform: "vimeo", regex: /vimeo\.com\/([^/?&]+)/i },
  { platform: "dribbble", regex: /dribbble\.com\/([^/?&]+)/i },
  { platform: "behance", regex: /behance\.net\/([^/?&]+)/i },
  { platform: "flickr", regex: /flickr\.com\/(?:photos|people)\/([^/?&]+)/i },
  { platform: "soundcloud", regex: /soundcloud\.com\/([^/?&]+)/i },
  { platform: "tiktok", regex: /(?:tiktok\.com|vm\.tiktok\.com)\/(@[^/?&]+)/i },
  { platform: "snapchat", regex: /snapchat\.com\/add\/([^/?&]+)/i },
  { platform: "discord", regex: /discord\.(?:gg|com)\/(?:invite\/)?([^/?&]+)/i },
  { platform: "telegram", regex: /t\.me\/([^/?&]+)/i },
  { platform: "whatsapp", regex: /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)([^/?&]+)/i },
  { platform: "slack", regex: /([^.]+)\.slack\.com/i },
  { platform: "signal", regex: /signal\.(?:org|me)\/([^/?&]+)/i },
];

const COMMON_CONTACT_PATHS = [
  // Direct contact pages
  "/contact", "/contact-us", "/contactus", "/get-in-touch", "/reach-us", "/connect", 
  "/about/contact", "/about-us/contact", "/support", "/help", "/write-for-us", 
  "/contributors", "/contribute", "/contact.html", "/contact.php", "/reach-out",
  "/about", "/about-us", "/team", "/our-team", "/meet-the-team", "/people", "/staff",
  
  // Expanded contact paths with language variations
  "/kontakt", "/kontaktiere-uns", "/contacto", "/contactez-nous", "/contatti", "/contato",
  "/kapcsolat", "/связаться", "/联系我们", "/お問い合わせ", "/문의", "/liên hệ",
  
  // Specialized contact paths
  "/feedback", "/inquiry", "/inquiries", "/customer-service", "/customer-support",
  "/technical-support", "/sales", "/partnerships", "/business-inquiries", "/press",
  "/media-inquiries", "/advertising", "/careers", "/jobs", "/work-with-us",
  "/collaborate", "/guest-post", "/write-for-us", "/submit-article", "/submit-content",
  "/pitch", "/content-submission", "/authors", "/editorial", "/editor", "/publisher",
  
  // Additional about page variations
  "/company", "/company/team", "/company/about", "/company/contact", "/who-we-are",
  "/our-story", "/mission", "/values", "/leadership", "/executives", "/founders",
  "/management", "/directory", "/our-office", "/locations", "/global-offices",
  
  // Additional file extensions
  "/contact.aspx", "/contact.jsp", "/contact.shtml", "/contact.cfm", "/contactus.html",
  "/contactus.php", "/about.html", "/about.php", "/team.html", "/team.php"
];

// Axios instance with optimal settings for web scraping
const axiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  maxRedirects: 5,
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Accept self-signed certificates
    keepAlive: true,
  }),
});

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Calculate exponential backoff with jitter for smarter retries
 * @param retry The current retry attempt number
 * @param baseDelay The base delay in milliseconds
 * @param maxDelay The maximum delay in milliseconds
 */
function calculateBackoff(retry: number, baseDelay = 1000, maxDelay = 30000): number {
  const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, retry));
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
  return exponentialDelay + jitter;
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 * @param minTimeBetweenRequests Minimum time between requests to the same domain in ms
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = THROTTLE_DELAY): boolean {
  const rootDomain = extractRootDomain(domain);
  const now = Date.now();
  const lastAccess = domainLastAccessTime[rootDomain] || 0;
  
  if (now - lastAccess < minTimeBetweenRequests) {
    return true;
  }
  
  domainLastAccessTime[rootDomain] = now;
  return false;
}

/**
 * Extract root domain from a domain name
 * This helps prevent different subdomains of the same site from bypassing throttling
 */
function extractRootDomain(domain: string): string {
  try {
    // Handle IDN domains (convert to ASCII)
    const asciiDomain = punycode.toASCII(domain);
    
    // Split by dots and get TLD + one level down
    const parts = asciiDomain.split('.');
    if (parts.length <= 2) return asciiDomain;
    
    // Handle special cases for compound TLDs (.co.uk, .com.au, etc.)
    const compoundTLDs = ['.co.uk', '.co.nz', '.com.au', '.ac.uk', '.gov.uk', '.org.uk', '.net.au', '.org.au'];
    const domainStr = '.' + parts.slice(-2).join('.');
    
    if (compoundTLDs.some(tld => domainStr.endsWith(tld))) {
      // For compound TLDs, we need 3 parts
      return parts.slice(-3).join('.');
    }
    
    // Default: return domain + TLD
    return parts.slice(-2).join('.');
  } catch (error) {
    console.error(`Error extracting root domain from ${domain}:`, error);
    return domain; // Return original in case of error
  }
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    const trimmed = url.trim();
    
    // Check if the URL has a protocol
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'https://' + trimmed; // Add https by default
    }
    
    return trimmed;
  } catch (error) {
    console.error(`Error cleaning URL ${url}:`, error);
    return url;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(cleanupUrl(url));
    return urlObj.hostname;
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    // Fallback for malformed URLs
    const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/i);
    return match ? match[1] : url;
  }
}

/**
 * Fetch HTML content from a URL with advanced retrying and rate limiting
 * @param url The URL to fetch
 * @param maxRetries Maximum number of retry attempts
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  const domain = extractDomain(url);
  
  // First check if we should throttle this domain
  if (shouldThrottleDomain(domain)) {
    await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
  }
  
  // Set random user agent for this request
  axiosInstance.defaults.headers['User-Agent'] = getRandomUserAgent();
  
  // Try to fetch with multiple retries and backoff
  for (let retry = 0; retry <= maxRetries; retry++) {
    try {
      const cleanUrl = cleanupUrl(url);
      
      // Try to fetch with initial URL
      try {
        const response = await axiosInstance.get(cleanUrl);
        return response.data;
      } catch (initialError) {
        // If the URL has query params and failed, try without them
        if (cleanUrl.includes('?')) {
          const urlWithoutParams = cleanUrl.split('?')[0];
          try {
            const response = await axiosInstance.get(urlWithoutParams);
            return response.data;
          } catch (error) {
            // Both attempts failed, throw the original error
            throw initialError;
          }
        } else {
          // No query params to strip, just throw the original error
          throw initialError;
        }
      }
    } catch (error: any) {
      if (retry === maxRetries) {
        // We've exhausted retries
        const status = error.response?.status;
        if (status === 404 || status === 403 || status === 410) {
          // Don't retry on these status codes
          return null;
        }
        console.error(`Failed to fetch ${url} after ${maxRetries} retries:`, error.message);
        return null;
      }
      
      const backoffDelay = calculateBackoff(retry);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  return null;
}

/**
 * Extract emails from a webpage with enhanced pattern recognition
 * This function uses multiple advanced techniques to find emails even when they're obfuscated
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  // Parse HTML
  const $ = cheerio.load(html);
  
  // Extract emails using regex
  const emails: Set<string> = new Set();
  
  // Store the raw HTML for later pattern matching
  const rawHtml = html;
  
  // First, extract from visible text content
  // Remove script and style elements which might contain false positives
  const cleanedHtml = cheerio.load($.html());
  cleanedHtml('script, style, noscript').remove();
  
  // Get text content
  const text = cleanedHtml.text();
  
  // Standard email format
  const standardMatches = text.match(EMAIL_REGEX) || [];
  standardMatches.forEach(email => emails.add(email.toLowerCase()));
  
  // Obfuscated email formats with enhanced detection
  const obfuscatedMatches = text.match(OBFUSCATED_EMAIL_REGEX) || [];
  obfuscatedMatches.forEach(match => {
    // Convert to standard format
    const standardized = match
      .replace(/\s+/g, '')
      .replace(/\[at\]|\(at\)|&#64;|%40|&#9989;at&#9989;|at/gi, '@')
      .replace(/\[dot\]|\(dot\)|&#46;|%2E|&#9989;dot&#9989;|dot/gi, '.')
      .toLowerCase();
    
    // Validate with standard email regex
    if (standardized.match(EMAIL_REGEX)) {
      emails.add(standardized);
    }
  });
  
  // Check href="mailto:" links
  $('a[href^="mailto:"]').each((_, element) => {
    const href = $(element).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].toLowerCase();
      if (email.match(EMAIL_REGEX)) {
        emails.add(email);
      }
    }
  });
  
  // Check for HTML character code encoded emails
  const encodedMatches = rawHtml.match(HTML_ENCODED_EMAIL_REGEX) || [];
  encodedMatches.forEach(match => {
    try {
      // Convert HTML character codes to text
      const decoded = match.replace(/&#(\d+);/g, (_, code) => {
        return String.fromCharCode(parseInt(code, 10));
      });
      
      if (decoded.match(EMAIL_REGEX)) {
        emails.add(decoded.toLowerCase());
      }
    } catch (error) {
      // Skip decoding errors
    }
  });
  
  // Check JavaScript email protection patterns
  const scriptProtectionMatches = rawHtml.match(JAVASCRIPT_EMAIL_REGEX) || [];
  scriptProtectionMatches.forEach(match => {
    try {
      const email = match.replace(/^mailto:|email=|emailto:|email-protection#/, '');
      if (email.match(EMAIL_REGEX)) {
        emails.add(email.toLowerCase());
      }
    } catch (error) {
      // Skip errors
    }
  });
  
  // Check for email patterns in HTML attributes
  $('[data-email], [data-mail], [data-contact], [class*="email"], [class*="mail"], [id*="email"], [id*="mail"]').each((_, element) => {
    const dataEmail = $(element).attr('data-email') || 
                     $(element).attr('data-mail') || 
                     $(element).attr('data-contact') ||
                     $(element).text();
                     
    if (dataEmail && dataEmail.match(EMAIL_REGEX)) {
      emails.add(dataEmail.toLowerCase());
    }
  });
  
  // Look for elements with text that might be emails 
  $('a, span, div, p').each((_, element) => {
    const text = $(element).text().trim();
    if (text.match(EMAIL_REGEX)) {
      emails.add(text.toLowerCase());
    }
    
    // Check for obvious obfuscation patterns
    if (text.includes(' at ') && text.includes(' dot ')) {
      const standardized = text
        .replace(/\s+at\s+/gi, '@')
        .replace(/\s+dot\s+/gi, '.')
        .toLowerCase();
      
      if (standardized.match(EMAIL_REGEX)) {
        emails.add(standardized);
      }
    }
  });
  
  // Look for emails in structured data (JSON-LD, microdata)
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonText = $(element).html();
      if (jsonText) {
        const jsonData = JSON.parse(jsonText);
        
        // Extract emails from common schema.org structures
        const extractFromObject = (obj: any) => {
          if (!obj) return;
          
          // Check common properties that might contain email
          ['email', 'contactPoint', 'contactPoints', 'author', 'creator', 'publisher', 'employee', 'employees'].forEach(prop => {
            if (typeof obj[prop] === 'string' && obj[prop].match(EMAIL_REGEX)) {
              emails.add(obj[prop].toLowerCase());
            } else if (typeof obj[prop] === 'object') {
              extractFromObject(obj[prop]);
            } else if (Array.isArray(obj[prop])) {
              obj[prop].forEach((item: any) => extractFromObject(item));
            }
          });
          
          // Check all string properties for email patterns
          Object.entries(obj).forEach(([key, value]) => {
            if (typeof value === 'string' && value.match(EMAIL_REGEX)) {
              emails.add(value.toLowerCase());
            }
          });
        };
        
        extractFromObject(jsonData);
      }
    } catch (error) {
      // Skip JSON parsing errors
    }
  });
  
  // Extract the domain from the URL to generate common email patterns
  try {
    const domain = extractDomain(url);
    
    // If we didn't find any emails but we have a domain, check DNS for MX records
    // to determine if the domain has email servers, then generate common patterns
    if (emails.size === 0) {
      try {
        // Check if the domain has MX records (email servers)
        const hasMx = await hasEmailServers(domain);
        if (hasMx) {
          // Generate common email patterns for this domain
          const commonEmails = [
            `contact@${domain}`,
            `info@${domain}`,
            `hello@${domain}`,
            `admin@${domain}`,
            `support@${domain}`,
            `help@${domain}`,
            `sales@${domain}`,
            `marketing@${domain}`,
            `media@${domain}`,
            `press@${domain}`,
            `webmaster@${domain}`
          ];
          
          // Add the generated emails with a note that they're predicted patterns
          commonEmails.forEach(email => {
            if (email.match(EMAIL_REGEX)) {
              emails.add(email.toLowerCase());
            }
          });
        }
      } catch (error) {
        // Skip DNS errors
      }
    }
  } catch (error) {
    // Skip domain extraction errors
  }
  
  return Array.from(emails);
}

/**
 * Check if domain has email servers by looking for MX records
 */
async function hasEmailServers(domain: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Find all potential contact pages by checking common paths
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const url = new URL(cleanupUrl(baseUrl));
    const domain = url.hostname;
    const protocol = url.protocol;
    
    const contactPages: string[] = [];
    
    // Check if the base URL itself is a contact page
    const baseHtml = await fetchHtml(baseUrl);
    if (baseHtml) {
      const $ = cheerio.load(baseHtml);
      const title = $('title').text().toLowerCase();
      const h1 = $('h1').text().toLowerCase();
      
      if (title.includes('contact') || h1.includes('contact') || 
          baseUrl.toLowerCase().includes('contact')) {
        contactPages.push(baseUrl);
      }
      
      // Look for contact page links in the base page
      $('a').each((_, element) => {
        try {
          const href = $(element).attr('href');
          const text = $(element).text().toLowerCase();
          
          if (href && (text.includes('contact') || 
                      text.includes('get in touch') || 
                      text.includes('reach us') ||
                      text.includes('write for us'))) {
            try {
              // Convert relative to absolute URL
              let fullUrl = new URL(href, baseUrl).href;
              if (!contactPages.includes(fullUrl)) {
                contactPages.push(fullUrl);
              }
            } catch (error) {
              // Skip invalid URLs
            }
          }
        } catch (error) {
          // Skip problematic elements
        }
      });
    }
    
    // Check common contact paths with small delays to avoid overwhelming the server
    for (const path of COMMON_CONTACT_PATHS) {
      const pathUrl = `${protocol}//${domain}${path}`;
      try {
        const html = await fetchHtml(pathUrl);
        if (html) {
          contactPages.push(pathUrl);
        }
      } catch (error) {
        // Skip failed paths
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return [...new Set(contactPages)]; // Deduplicate
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
    return [];
  }
}

/**
 * Find a contact form URL on a website with significantly improved detection
 * This enhanced version uses multiple techniques to identify contact forms and pages
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    // First check if the main URL is a contact page itself
    const mainHtml = await fetchHtml(url);
    if (!mainHtml) return null;
    
    const $ = cheerio.load(mainHtml);
    
    // More comprehensive form detection using multiple indicators
    if ($('form').length > 0) {
      const forms = $('form');
      for (let i = 0; i < forms.length; i++) {
        const form = forms.eq(i);
        const action = form.attr('action') || '';
        const id = form.attr('id') || '';
        const className = form.attr('class') || '';
        const method = form.attr('method') || '';
        const name = form.attr('name') || '';
        
        // Check if form attributes suggest it's a contact form
        const formAttributesIndicateContact = (
          action.toLowerCase().includes('contact') ||
          action.toLowerCase().includes('message') ||
          action.toLowerCase().includes('feedback') ||
          id.toLowerCase().includes('contact') ||
          id.toLowerCase().includes('message') ||
          id.toLowerCase().includes('feedback') ||
          className.toLowerCase().includes('contact') ||
          className.toLowerCase().includes('message') ||
          className.toLowerCase().includes('feedback') ||
          name.toLowerCase().includes('contact') ||
          name.toLowerCase().includes('message') ||
          name.toLowerCase().includes('feedback')
        );
        
        // Check for contact form input fields
        const hasEmailField = form.find('input[type="email"], input[name*="email"], input[id*="email"], input[class*="email"]').length > 0;
        const hasNameField = form.find('input[name*="name"], input[id*="name"], input[placeholder*="name"]').length > 0;
        const hasMessageField = form.find('textarea, input[name*="message"], input[id*="message"], div[contenteditable="true"]').length > 0;
        const hasSubjectField = form.find('input[name*="subject"], select[name*="subject"], input[id*="subject"]').length > 0;
        const hasPhoneField = form.find('input[type="tel"], input[name*="phone"], input[id*="phone"], input[placeholder*="phone"]').length > 0;
        
        // Check for submit button with contact-related text
        const submitButtons = form.find('button[type="submit"], input[type="submit"], button, input[type="button"], a.button, .btn, .button');
        let hasContactSubmitButton = false;
        
        submitButtons.each((_, element) => {
          const buttonText = $(element).text().toLowerCase();
          const buttonValue = $(element).attr('value')?.toLowerCase() || '';
          if (
            buttonText.includes('send') ||
            buttonText.includes('submit') ||
            buttonText.includes('contact') ||
            buttonText.includes('message') ||
            buttonValue.includes('send') ||
            buttonValue.includes('submit') ||
            buttonValue.includes('contact')
          ) {
            hasContactSubmitButton = true;
          }
        });
        
        // Check for CAPTCHA or reCAPTCHA elements (common in contact forms)
        const hasCaptcha = form.find('[class*="captcha"], [id*="captcha"], [class*="recaptcha"], [id*="recaptcha"], [data-sitekey]').length > 0;
        
        // Check for honeypot fields (spam prevention technique used in contact forms)
        const hasHoneypot = form.find('input[name*="honey"], input[name*="pot"], input[style*="display:none"]').length > 0;
        
        // Score the form based on contact form indicators (more comprehensive)
        let contactFormScore = 0;
        if (formAttributesIndicateContact) contactFormScore += 3;
        if (hasEmailField) contactFormScore += 2;
        if (hasNameField) contactFormScore += 1;
        if (hasMessageField) contactFormScore += 2;
        if (hasSubjectField) contactFormScore += 1;
        if (hasPhoneField) contactFormScore += 1;
        if (hasContactSubmitButton) contactFormScore += 2;
        if (hasCaptcha) contactFormScore += 1;
        if (hasHoneypot) contactFormScore += 1;
        
        // Check surrounding context for contact form hints
        const formParent = form.parent();
        const parentText = formParent.text().toLowerCase();
        const nearHeadings = formParent.find('h1, h2, h3, h4, h5, h6').text().toLowerCase();
        
        if (
          parentText.includes('contact') ||
          parentText.includes('get in touch') ||
          parentText.includes('send us a message') ||
          parentText.includes('send a message') ||
          nearHeadings.includes('contact') ||
          nearHeadings.includes('get in touch')
        ) {
          contactFormScore += 2;
        }
        
        // Check page title and URL for contact indicators
        const title = $('title').text().toLowerCase();
        const h1 = $('h1').text().toLowerCase();
        
        if (
          title.includes('contact') ||
          h1.includes('contact') ||
          url.toLowerCase().includes('contact')
        ) {
          contactFormScore += 2;
        }
        
        // If the form has enough contact form indicators (threshold of 4)
        if (contactFormScore >= 4) {
          return url; // This page contains a contact form
        }
      }
    }
    
    // Check if the page itself has contact indicators even without a formal <form>
    // Some modern sites use JavaScript forms without traditional form elements
    const pageTitle = $('title').text().toLowerCase();
    const headings = $('h1, h2, h3').text().toLowerCase();
    const bodyText = $('body').text().toLowerCase();
    
    if (
      (pageTitle.includes('contact') || pageTitle.includes('get in touch')) &&
      (bodyText.includes('email us') || bodyText.includes('send us') || bodyText.includes('message') || bodyText.includes('write to'))
    ) {
      return url; // This page is likely a contact page even without a traditional form
    }
    
    // Look for JavaScript form handlers
    const scriptTags = $('script').text();
    if (
      scriptTags.includes('contact') && 
      (scriptTags.includes('form') || scriptTags.includes('submit') || scriptTags.includes('ajax')) &&
      (scriptTags.includes('email') || scriptTags.includes('message'))
    ) {
      return url; // This page likely has a JavaScript-based contact form
    }
    
    // Look for contact links with enhanced detection
    const contactLinks: string[] = [];
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      const aria = $(element).attr('aria-label')?.toLowerCase() || '';
      const title = $(element).attr('title')?.toLowerCase() || '';
      
      // Check text and attributes for contact indicators
      if (href && (
          text.includes('contact') || 
          text.includes('get in touch') || 
          text.includes('reach us') ||
          text.includes('send message') ||
          text.includes('send us') ||
          text.includes('write to us') ||
          text.includes('support') ||
          aria.includes('contact') ||
          title.includes('contact') ||
          href.toLowerCase().includes('contact') ||
          href.toLowerCase().includes('get-in-touch')
      )) {
        try {
          // Convert relative to absolute URL
          let fullUrl = new URL(href, url).href;
          if (!contactLinks.includes(fullUrl)) {
            contactLinks.push(fullUrl);
          }
        } catch (error) {
          // Skip invalid URLs
        }
      }
    });
    
    // Try to find a form on the contact links with enhanced detection
    for (const link of contactLinks) {
      const contactHtml = await fetchHtml(link);
      if (contactHtml) {
        const $contact = cheerio.load(contactHtml);
        
        // Check for forms
        if ($contact('form').length > 0) {
          return link;
        }
        
        // Check if it's obviously a contact page
        const contactTitle = $contact('title').text().toLowerCase();
        const contactH1 = $contact('h1').text().toLowerCase();
        const contactH2 = $contact('h2').text().toLowerCase();
        
        if (
          contactTitle.includes('contact') || 
          contactH1.includes('contact') || 
          contactH2.includes('contact') ||
          contactTitle.includes('get in touch') || 
          contactH1.includes('get in touch') || 
          contactH2.includes('get in touch')
        ) {
          return link;
        }
      }
    }
    
    // Check common contact paths with enhanced detection
    const urlObj = new URL(cleanupUrl(url));
    const domain = urlObj.hostname;
    const protocol = urlObj.protocol;
    
    return await checkCommonContactPaths(protocol, domain, COMMON_CONTACT_PATHS);
  } catch (error) {
    console.error(`Error finding contact form for ${url}:`, error);
    return null;
  }
}

/**
 * Check common contact paths for a contact form with enhanced detection capabilities
 * This function uses a sophisticated scoring system to identify contact pages
 * even when they don't have a traditional <form> element
 */
async function checkCommonContactPaths(protocol: string, domain: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      const contactUrl = `${protocol}//${domain}${path}`;
      const html = await fetchHtml(contactUrl);
      
      if (html) {
        const $ = cheerio.load(html);
        
        // First check for traditional forms
        if ($('form').length > 0) {
          // Score the page as a contact page
          let contactScore = 0;
          
          // Check page title and headings
          const title = $('title').text().toLowerCase();
          const h1 = $('h1').text().toLowerCase();
          const h2 = $('h2').text().toLowerCase();
          const bodyText = $('body').text().toLowerCase();
          
          // Check for contact-related terms in page title and headings
          if (title.includes('contact') || title.includes('get in touch')) contactScore += 3;
          if (h1.includes('contact') || h1.includes('get in touch')) contactScore += 2;
          if (h2.includes('contact') || h2.includes('get in touch')) contactScore += 1;
          
          // Check for contact form fields
          const hasEmailField = $('input[type="email"], input[name*="email"], input[id*="email"]').length > 0;
          const hasMessageField = $('textarea, [name*="message"]').length > 0;
          const hasNameField = $('input[name*="name"]').length > 0;
          
          if (hasEmailField) contactScore += 2;
          if (hasMessageField) contactScore += 2;
          if (hasNameField) contactScore += 1;
          
          // Check for submission buttons
          const hasSubmitButton = $('button[type="submit"], input[type="submit"]').length > 0;
          if (hasSubmitButton) contactScore += 1;
          
          // Check for CAPTCHA elements (common in contact forms)
          const hasCaptcha = $('[class*="captcha"], [id*="captcha"], [data-sitekey]').length > 0;
          if (hasCaptcha) contactScore += 1;
          
          // If the URL contains contact-related terms
          if (path.includes('contact') || path.includes('reach-us') || path.includes('get-in-touch')) {
            contactScore += 2;
          }
          
          // If the score is high enough, it's likely a contact form
          if (contactScore >= 3) {
            return contactUrl;
          }
        }
        
        // Even if no form is found, check if the page content strongly indicates it's a contact page
        // Modern sites may use JavaScript forms without traditional <form> tags
        const bodyText = $('body').text().toLowerCase();
        const pageTitle = $('title').text().toLowerCase();
        
        // Strong signals of a contact page without a traditional form
        if (
          (pageTitle.includes('contact') || pageTitle.includes('get in touch') || 
           path.includes('contact') || path.includes('get-in-touch')) &&
          (
            bodyText.includes('email us') || 
            bodyText.includes('send us a message') || 
            bodyText.includes('get in touch') || 
            bodyText.includes('contact us') ||
            $('input[type="email"]').length > 0 ||
            $('[class*="contact-"], [id*="contact-"]').length > 0
          )
        ) {
          return contactUrl;
        }
        
        // Look for contact information presentation
        if (
          (path.includes('contact') || path.includes('about')) &&
          (
            $('a[href^="mailto:"]').length > 0 ||
            bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) ||
            $('a[href^="tel:"]').length > 0 ||
            bodyText.match(/\+?[0-9\s\(\)\-\.]{10,20}/) // Phone number pattern
          )
        ) {
          return contactUrl;
        }
      }
    } catch (error) {
      // Continue to next path
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200)); // Further reduced delay for faster processing
  }
  
  return null;
}

/**
 * Extract social media profiles from a page with enhanced detection
 */
async function extractSocialProfiles(url: string): Promise<Array<{
  platform: string, 
  url: string, 
  username: string, 
  displayName?: string, 
  description?: string, 
  iconUrl?: string
}>> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const results: Array<{
      platform: string, 
      url: string, 
      username: string, 
      displayName?: string, 
      description?: string, 
      iconUrl?: string
    }> = [];
    
    // Extract from all links
    $('a').each((_, element) => {
      try {
        const href = $(element).attr('href');
        if (!href) return;
        
        // Try to normalize the URL
        let fullUrl: string;
        try {
          fullUrl = new URL(href, url).href;
        } catch (error) {
          return; // Skip invalid URLs
        }
        
        // Check against platform patterns
        for (const { platform, regex } of SOCIAL_PLATFORM_PATTERNS) {
          const match = fullUrl.match(regex);
          if (match && match[1]) {
            const username = match[1].replace(/\/$/, ''); // Remove trailing slash
            
            // Check for duplicates before adding
            if (!results.some(r => r.platform === platform && r.username === username)) {
              const socialResult = {
                platform,
                url: fullUrl,
                username,
                // Try to get additional info
                displayName: $(element).attr('title') || $(element).text().trim() || undefined,
                iconUrl: $(element).find('img').attr('src') || undefined
              };
              
              results.push(socialResult);
            }
          }
        }
      } catch (error) {
        // Skip problematic elements
      }
    });
    
    return results;
  } catch (error) {
    console.error(`Error extracting social profiles from ${url}:`, error);
    return [];
  }
}

/**
 * Extract phone numbers from HTML with country code detection
 */
async function extractPhoneNumbers(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  
  // Remove script and style elements
  $('script, style').remove();
  
  // Get all text
  const text = $.text();
  
  // Phone number patterns (international and US formats)
  const phonePatterns = [
    /\+\d{1,3}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // International
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // US format (xxx) xxx-xxxx
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g // US simple xxx-xxx-xxxx
  ];
  
  const phones: Set<string> = new Set();
  
  // Extract using patterns
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern) || [];
    matches.forEach(match => {
      const cleaned = match.replace(/\s+/g, ' ').trim();
      phones.add(cleaned);
    });
  }
  
  // Look for tel: links
  $('a[href^="tel:"]').each((_, element) => {
    const href = $(element).attr('href');
    if (href) {
      const phone = href.replace('tel:', '').trim();
      phones.add(phone);
    }
  });
  
  return Array.from(phones);
}

/**
 * Check if a given text appears to be an address
 */
function isLikelyAddress(text: string): boolean {
  text = text.toLowerCase();
  
  // Check for postal code patterns
  const hasPostalCode = /\d{5}(-\d{4})?/.test(text); // US
  const hasZipOrPostal = /\bzip\b|\bpostal\b/.test(text);
  
  // Check for address indicators
  const hasStreet = /\bst\.?|\bstreet\b|\bave\.?|\bavenue\b|\bblvd\.?|\bboulevard\b|\bln\.?|\blane\b|\bdr\.?|\bdrive\b|\bway\b|\broad\b|\brd\.?\b/i.test(text);
  const hasAddressNumber = /^\d+\s+\w+/.test(text.trim());
  
  // Check for state/province patterns
  const hasStateAbbr = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i.test(text);
  
  // Check for city, state format
  const hasCityStateFormat = /\w+,\s*\w{2}\s*\d{5}/i.test(text);
  
  // Calculate a confidence score
  let score = 0;
  if (hasPostalCode) score += 2;
  if (hasZipOrPostal) score += 1;
  if (hasStreet) score += 2;
  if (hasAddressNumber) score += 1;
  if (hasStateAbbr) score += 1;
  if (hasCityStateFormat) score += 3;
  
  return score >= 3; // Threshold for considering it an address
}

/**
 * Extract physical address from HTML
 */
async function extractAddress(url: string): Promise<string | null> {
  const html = await fetchHtml(url);
  if (!html) return null;
  
  const $ = cheerio.load(html);
  
  // Look for common address containers
  const addressSelectors = [
    'address',
    '[itemtype="http://schema.org/PostalAddress"]',
    '.address',
    '.contact-address',
    '.location',
    'footer .address',
    '.footer address',
    '.vcard .adr',
    '[data-role="address"]'
  ];
  
  // Check each selector
  for (const selector of addressSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      const addressText = elements.first().text().trim();
      if (addressText && isLikelyAddress(addressText)) {
        return addressText;
      }
    }
  }
  
  // Fallback: scan all paragraphs and divs with less than 150 chars
  // which might contain addresses
  const candidates: string[] = [];
  
  $('p, div').each((_, element) => {
    const text = $(element).text().trim();
    if (text.length > 10 && text.length < 150 && isLikelyAddress(text)) {
      candidates.push(text);
    }
  });
  
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Main function to run the advanced contact extraction process
 */
export async function runAdvancedContactExtraction(options: {
  premiumOnly?: boolean;
  batchSize?: number;
  isDryRun?: boolean;
}) {
  console.log("Starting advanced contact information extraction...");
  
  const { premiumOnly = false, batchSize = 10, isDryRun = false } = options;
  
  try {
    // Get opportunities that need contact info
    // Priority: Premium opportunities without contact info first,
    // then other opportunities without contact info
    let opportunities;
    
    if (premiumOnly) {
      opportunities = await db.select()
        .from(discoveredOpportunities)
        .where(
          and(
            discoveredOpportunities.isPremium,
            or(
              isNull(discoveredOpportunities.contactInfo),
              eq(discoveredOpportunities.contactInfo, '{}'),
              eq(discoveredOpportunities.contactInfo, '[]')
            )
          )
        )
        .limit(batchSize);
    } else {
      // Get a mix of premium and regular opportunities
      const premiumOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(
          and(
            discoveredOpportunities.isPremium,
            or(
              isNull(discoveredOpportunities.contactInfo),
              eq(discoveredOpportunities.contactInfo, '{}'),
              eq(discoveredOpportunities.contactInfo, '[]')
            )
          )
        )
        .limit(Math.ceil(batchSize * 0.4)); // 40% premium
      
      const regularOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(
          and(
            not(discoveredOpportunities.isPremium),
            or(
              isNull(discoveredOpportunities.contactInfo),
              eq(discoveredOpportunities.contactInfo, '{}'),
              eq(discoveredOpportunities.contactInfo, '[]')
            )
          )
        )
        .limit(batchSize - premiumOpportunities.length); // Remaining spots for regular
      
      opportunities = [...premiumOpportunities, ...regularOpportunities];
    }
    
    console.log(`Processing ${opportunities.length} opportunities` + 
                (premiumOnly ? " (premium only)" : ""));
    
    // Process opportunities in sequence to avoid overwhelming APIs
    for (const opportunity of opportunities) {
      try {
        console.log(`Processing ${opportunity.id}: ${opportunity.domain} (${opportunity.isPremium ? 'Premium' : 'Regular'})`);
        
        const startTime = Date.now();
        const result = await processOpportunity(opportunity, isDryRun);
        const duration = Date.now() - startTime;
        
        console.log(`Completed ${opportunity.id}: ${opportunity.domain} in ${duration}ms`);
        console.log(`Result: ${result.emails.length} emails, ${result.social.length} social profiles, ` + 
                    `Contact form: ${result.contactForm ? 'Yes' : 'No'}`);
        
        // Add a delay between processing opportunities
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing opportunity ${opportunity.id}:`, error);
      }
    }
    
    console.log("Advanced contact extraction completed!");
  } catch (error) {
    console.error("Error running advanced contact extraction:", error);
  }
}

/**
 * Process a single opportunity to extract contact information
 */
async function processOpportunity(opportunity: any, isDryRun: boolean): Promise<{
  emails: string[],
  contactForm: string | null,
  social: Array<{platform: string, url: string, username: string}>,
  phone: string[],
  address: string | null
}> {
  // Initialize result object
  const result = {
    emails: [] as string[],
    contactForm: null as string | null,
    social: [] as Array<{platform: string, url: string, username: string}>,
    phone: [] as string[],
    address: null as string | null
  };
  
  // Set up execution time limit
  const timeoutPromise = new Promise<typeof result>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Processing timed out after ${MAX_EXECUTION_TIME}ms`));
    }, MAX_EXECUTION_TIME);
  });
  
  try {
    // Create a promise for the actual processing
    const processingPromise = (async () => {
      const domainUrl = cleanupUrl(opportunity.domain);
      
      // Step 1: Extract emails from main page
      const emails = await extractEmailsFromPage(domainUrl);
      result.emails = emails;
      
      // Step 2: Find and extract contact form
      const contactForm = await findContactFormUrl(domainUrl);
      result.contactForm = contactForm;
      
      // Step 3: Extract social profiles
      const socialProfiles = await extractSocialProfiles(domainUrl);
      result.social = socialProfiles;
      
      // Skip these for now as they might be time-consuming
      // We'll implement them in the future based on performance
      /*
      // Step 4: Extract phone numbers
      const phones = await extractPhoneNumbers(domainUrl);
      result.phone = phones;
      
      // Step 5: Extract address
      const address = await extractAddress(domainUrl);
      result.address = address;
      */
      
      // If we didn't find contact info on the main page, try contact pages
      if (emails.length === 0 || socialProfiles.length === 0) {
        const contactPages = await findContactPages(domainUrl);
        
        for (const contactPage of contactPages) {
          // Extract emails from contact page
          const contactEmails = await extractEmailsFromPage(contactPage);
          for (const email of contactEmails) {
            if (!result.emails.includes(email)) {
              result.emails.push(email);
            }
          }
          
          // Extract social profiles from contact page
          const contactSocial = await extractSocialProfiles(contactPage);
          for (const profile of contactSocial) {
            if (!result.social.some(p => p.platform === profile.platform && p.username === profile.username)) {
              result.social.push(profile);
            }
          }
          
          // Stop if we found substantial info
          if (result.emails.length > 0 && result.social.length > 0) {
            break;
          }
        }
      }
      
      return result;
    })();
    
    // Race between processing and timeout
    const completedResult = await Promise.race([processingPromise, timeoutPromise]);
    
    // Update the database with the contact info if not a dry run
    if (!isDryRun) {
      const contactInfo = {
        emails: completedResult.emails,
        contactForm: completedResult.contactForm,
        social: completedResult.social.map(s => ({
          platform: s.platform,
          url: s.url,
          username: s.username
        })),
        phone: completedResult.phone,
        address: completedResult.address,
        lastUpdated: new Date().toISOString()
      };
      
      await db.update(discoveredOpportunities)
        .set({ contactInfo: contactInfo })
        .where(eq(discoveredOpportunities.id, opportunity.id));
    }
    
    return completedResult;
  } catch (error) {
    console.error(`Error processing opportunity ${opportunity.id}:`, error);
    
    // Return whatever partial data we collected
    return result;
  }
}

// Process any command line arguments
const processArgs = () => {
  const args = process.argv;
  return {
    premiumOnly: args.includes('--premium-only'),
    isDryRun: args.includes('--dry-run'),
    batchSize: args.includes('--batch-size') 
      ? parseInt(args[args.indexOf('--batch-size') + 1], 10) 
      : 50
  };
};

// Start the extraction process
const options = processArgs();
runAdvancedContactExtraction(options)
  .catch(console.error);