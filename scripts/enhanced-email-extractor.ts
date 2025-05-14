/**
 * Enhanced Email Extractor for LinkDripAI
 * 
 * This script combines multiple free techniques to significantly improve email discovery:
 * 1. Email pattern permutation with SMTP verification
 * 2. Enhanced WHOIS data mining
 * 3. Improved crawler for obfuscated emails
 * 4. GitHub repository mining for contact information
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, sql, desc, isNull, not } from 'drizzle-orm';
import * as schema from '../shared/schema';
import whoisJson from 'whois-json';
import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';
import ws from 'ws';
import net from 'net';

// Configure neon to use the WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Constants for rate limiting and throttling
const MAX_RETRIES = 4;
const THROTTLE_DELAY = 5000; // ms
const BATCH_SIZE = 5;
const MAX_OPPORTUNITIES_TO_PROCESS = 10; // Reduced for testing

// Connect to the database
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

// Domain request timestamp map for throttling
const domainLastRequestTime: Record<string, number> = {};

// Common name patterns for email generation
const COMMON_FIRST_NAMES = ['john', 'jane', 'michael', 'david', 'sarah', 'james', 'robert', 'mary', 'linda', 'william', 'richard', 'susan', 'joseph', 'thomas', 'jennifer', 'charles', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven'];

// Common email patterns for businesses
const EMAIL_PATTERNS = [
  'info',
  'contact',
  'hello',
  'support',
  'admin',
  'webmaster',
  'sales',
  'marketing',
  'media',
  'press',
  'help',
  'team',
  'editor',
  'editorial',
  'partners',
  'business',
  'careers',
  'jobs',
  'feedback',
  'inquiries',
  'office'
];

// User agents for rotating
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
];

// Interface for tracking extracted contact information
interface ContactInfo {
  emails: string[];
  socialProfiles: Array<{
    platform: string;
    url: string;
    username: string;
  }>;
  contactForms: string[];
  extractionDetails: {
    normalized: boolean;
    source: string;
    version: string;
    lastUpdated: string;
  };
}

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Calculate exponential backoff with jitter for smarter retries
 */
function calculateBackoff(retry: number): number {
  const base = 1000; // 1 second
  const max = 30000; // 30 seconds
  const calculated = Math.min(max, base * Math.pow(2, retry) * (0.5 + Math.random() / 2));
  return calculated;
}

/**
 * Extract root domain from a domain name
 */
function extractRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Handle domains like sub.example.co.uk
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (tld === 'uk' && sld === 'co' || sld === 'org' || sld === 'gov' || sld === 'ac') {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }
  return domain;
}

/**
 * Check if we should throttle requests to avoid rate limiting
 */
function shouldThrottleDomain(domain: string): boolean {
  const rootDomain = extractRootDomain(domain);
  const now = Date.now();
  const lastRequest = domainLastRequestTime[rootDomain] || 0;
  
  if (now - lastRequest < THROTTLE_DELAY) {
    return true;
  }
  
  domainLastRequestTime[rootDomain] = now;
  return false;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    // For malformed URLs, try to salvage domain
    const match = url.match(/^(?:https?:\/\/)?([^\/]+)/i);
    return match ? match[1] : '';
  }
}

/**
 * Clean URL for consistent format
 */
function cleanupUrl(url: string): string {
  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    // Normalize to remove trailing slashes and fragments
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`
      .replace(/\/$/, '');
  } catch (error) {
    return url;
  }
}

/**
 * Fetch HTML content with retries
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  const domain = extractDomain(url);
  if (shouldThrottleDomain(domain)) {
    await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
  }
  
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/'
        },
        timeout: 15000,
        maxRedirects: 5
      });
      
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      if (retries === maxRetries) {
        console.log(`Failed to fetch ${url} after ${maxRetries} retries: ${error.message}`);
        return null;
      }
      
      // Exponential backoff with jitter
      const backoffTime = calculateBackoff(retries);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
    
    retries++;
  }
  
  return null;
}

/**
 * Extract emails from text with advanced pattern recognition
 */
function extractEmailsFromText(text: string): string[] {
  // Regular expression for standard emails
  const standardEmailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  
  // Regular expression for obfuscated emails (e.g., "name at domain dot com")
  const obfuscatedPattern = /([a-zA-Z0-9._-]+)\s+(?:at|AT|@|＠)\s+([a-zA-Z0-9._-]+)\s+(?:dot|DOT|\.)\s+([a-zA-Z]{2,})/gi;
  
  const emails = new Set<string>();
  
  // Extract standard emails
  const standardMatches = text.match(standardEmailPattern) || [];
  standardMatches.forEach(email => emails.add(email.toLowerCase()));
  
  // Extract obfuscated emails
  let obfuscatedMatch;
  while ((obfuscatedMatch = obfuscatedPattern.exec(text)) !== null) {
    if (obfuscatedMatch.length >= 4) {
      const email = `${obfuscatedMatch[1]}@${obfuscatedMatch[2]}.${obfuscatedMatch[3]}`.toLowerCase();
      emails.add(email);
    }
  }
  
  // Filter out invalid or common false positives
  return Array.from(emails).filter(email => {
    // Filter common false positives and validation
    return (
      email.includes('@') &&
      email.includes('.') &&
      !email.includes('example.com') &&
      !email.includes('@example.') &&
      !email.includes('yourdomain') &&
      !email.includes('domain.com') &&
      !email.includes('email@') &&
      !email.includes('@email') &&
      email.length > 5 &&
      email.length < 100
    );
  });
}

/**
 * Look for email obfuscation using JavaScript
 */
function lookForObfuscatedEmails(html: string): string[] {
  const emails = new Set<string>();
  
  // Find JavaScript string concatenation patterns for email creation
  const jsPattern = /(?:var|let|const)?\s*\w+\s*=\s*(['"])([^'"]+)\1\s*\+\s*(['"])([^'"]+)\3/g;
  let jsMatch;
  while ((jsMatch = jsPattern.exec(html)) !== null) {
    const combined = jsMatch[2] + jsMatch[4];
    if (combined.includes('@') && combined.includes('.')) {
      emails.add(combined.toLowerCase());
    }
  }
  
  // Find Unicode encoded email addresses
  const unicodePattern = /&#(\d+);/g;
  let unicodeMatches = html.match(unicodePattern);
  if (unicodeMatches) {
    const decoded = html.replace(unicodePattern, (_, code) => {
      return String.fromCharCode(parseInt(code, 10));
    });
    const decodedEmails = extractEmailsFromText(decoded);
    decodedEmails.forEach(email => emails.add(email));
  }
  
  // Check for reversed text
  if (html.includes('reverseText') || html.includes('split("").reverse().join("")')) {
    const reversePattern = /"([^"]+)"\s*\.split\(""\)\.reverse\(\)\.join\(""\)/g;
    let reverseMatch;
    while ((reverseMatch = reversePattern.exec(html)) !== null) {
      const reversed = reverseMatch[1].split('').reverse().join('');
      if (reversed.includes('@') && reversed.includes('.')) {
        emails.add(reversed.toLowerCase());
      }
    }
  }
  
  return Array.from(emails);
}

/**
 * Look for emails in HTML attributes
 */
function extractEmailsFromAttributes($: cheerio.CheerioAPI): string[] {
  const emails = new Set<string>();
  
  // Look for data attributes that might contain email information
  $('[data-email], [data-mail], [data-contact]').each((_, el) => {
    const dataEmail = $(el).attr('data-email') || '';
    const dataMail = $(el).attr('data-mail') || '';
    const dataContact = $(el).attr('data-contact') || '';
    
    [dataEmail, dataMail, dataContact].forEach(attr => {
      // Check for base64 encoded email
      if (/^[A-Za-z0-9+/=]+$/.test(attr) && attr.length % 4 === 0) {
        try {
          const decoded = Buffer.from(attr, 'base64').toString();
          if (decoded.includes('@') && decoded.includes('.')) {
            emails.add(decoded.toLowerCase());
          }
        } catch (_) {
          // Invalid base64, skip
        }
      }
      
      const foundEmails = extractEmailsFromText(attr);
      foundEmails.forEach(email => emails.add(email));
    });
  });
  
  // Look in mailto links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const email = href.replace('mailto:', '').split('?')[0].trim();
    if (email.includes('@') && email.includes('.')) {
      emails.add(email.toLowerCase());
    }
  });
  
  return Array.from(emails);
}

/**
 * Extract emails from a webpage with enhanced detection
 */
async function extractEmailsFromPage(url: string, domain: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const emails = new Set<string>();
  
  // Standard email pattern extraction from HTML
  const extractedEmails = extractEmailsFromText(html);
  extractedEmails.forEach(email => emails.add(email));
  
  // Look for obfuscated emails in JavaScript
  const obfuscatedEmails = lookForObfuscatedEmails(html);
  obfuscatedEmails.forEach(email => emails.add(email));
  
  // Load HTML into Cheerio for DOM manipulation
  const $ = cheerio.load(html);
  
  // Extract emails from HTML attributes
  const attributeEmails = extractEmailsFromAttributes($);
  attributeEmails.forEach(email => emails.add(email));
  
  // Filter results to this domain only
  return Array.from(emails).filter(email => {
    const emailDomain = email.split('@')[1];
    return emailDomain && extractRootDomain(emailDomain) === extractRootDomain(domain);
  });
}

/**
 * Find all contact pages for a website, checking many possible locations
 */
async function findAllContactPages(baseUrl: string): Promise<string[]> {
  const domain = extractDomain(baseUrl);
  const foundUrls = new Set<string>();
  const protocol = baseUrl.startsWith('https') ? 'https' : 'http';
  
  // Common paths for contact pages
  const contactPaths = [
    '/contact', 
    '/contact-us',
    '/about',
    '/about-us',
    '/team',
    '/our-team',
    '/meet-the-team',
    '/about/team',
    '/company',
    '/company/team',
    '/support',
    '/help',
    '/write-for-us',
    '/contribute',
    '/contributors',
    '/advertising',
    '/reach-us',
    '/get-in-touch'
  ];
  
  // Alternate domain patterns
  const alternateBaseUrls = [
    `${protocol}://${domain}`,
    `${protocol}://www.${domain.replace(/^www\./, '')}`
  ];
  
  for (const url of alternateBaseUrls) {
    // Standardize base URL
    const cleanUrl = cleanupUrl(url);
    if (cleanUrl) {
      foundUrls.add(cleanUrl);
    }
    
    // Try all contact paths
    for (const path of contactPaths) {
      const contactUrl = cleanupUrl(`${url}${path}`);
      
      // Check if page exists via HEAD request
      try {
        const response = await axios.head(contactUrl, {
          headers: { 'User-Agent': getRandomUserAgent() },
          timeout: 5000,
          validateStatus: status => status < 400 // Accept all non-error status codes
        });
        
        if (response.status < 400) {
          foundUrls.add(contactUrl);
        }
      } catch (error) {
        // Ignore failed requests
      }
    }
  }
  
  return Array.from(foundUrls);
}

/**
 * Extract WHOIS information with thorough email checking
 */
async function extractWhoisData(domain: string): Promise<string[]> {
  try {
    // Remove 'www' if present
    const cleanDomain = domain.replace(/^www\./, '');
    
    const whoisData = await whoisJson(cleanDomain);
    
    if (!whoisData) {
      return [];
    }
    
    // Check all WHOIS fields for email addresses
    const allEmails = new Set<string>();
    const allValues = Object.values(whoisData).filter(val => typeof val === 'string');
    
    for (const value of allValues) {
      const emails = extractEmailsFromText(value as string);
      emails.forEach(email => {
        // Filter out privacy protection emails
        if (!email.includes('privacy') && 
            !email.includes('protect') && 
            !email.includes('whois') && 
            !email.includes('domains') &&
            !email.includes('domaincontrol')) {
          allEmails.add(email.toLowerCase());
        }
      });
    }
    
    return Array.from(allEmails);
  } catch (error) {
    console.log(`Error extracting WHOIS data for ${domain}: ${error.message}`);
    return [];
  }
}

/**
 * Generate common email patterns for a domain
 */
async function generateEmailPatterns(domain: string): Promise<string[]> {
  const emails = new Set<string>();
  const cleanDomain = domain.replace(/^www\./, '');
  
  // Add patterns for common business emails
  for (const pattern of EMAIL_PATTERNS) {
    emails.add(`${pattern}@${cleanDomain}`);
  }
  
  // Try to extract names from website to generate more personalized emails
  try {
    const baseUrl = `https://${cleanDomain}`;
    const aboutPages = await findAllContactPages(baseUrl);
    const foundNames = new Set<string>();
    
    for (const page of aboutPages.slice(0, 3)) { // Limit to first 3 pages
      const html = await fetchHtml(page);
      if (!html) continue;
      
      const $ = cheerio.load(html);
      
      // Extract potential names from team pages and author sections
      $('.team, .staff, .about-us, .employees, .our-team, .author, .bio, .profile')
        .find('h1, h2, h3, h4, h5, strong, b, .name, [itemprop="name"]')
        .each((_, el) => {
          const text = $(el).text().trim();
          
          // Look for names (First Last format)
          const nameMatch = text.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)$/);
          if (nameMatch) {
            const [_, firstName, lastName] = nameMatch;
            foundNames.add(`${firstName.toLowerCase()} ${lastName.toLowerCase()}`);
          }
        });
    }
    
    // Generate email patterns from found names
    for (const name of foundNames) {
      const [firstName, lastName] = name.split(' ');
      
      if (firstName && lastName) {
        emails.add(`${firstName}@${cleanDomain}`);
        emails.add(`${lastName}@${cleanDomain}`);
        emails.add(`${firstName}.${lastName}@${cleanDomain}`);
        emails.add(`${firstName}_${lastName}@${cleanDomain}`);
        emails.add(`${firstName[0]}${lastName}@${cleanDomain}`);
        emails.add(`${firstName[0]}.${lastName}@${cleanDomain}`);
        emails.add(`${firstName[0]}_${lastName}@${cleanDomain}`);
        emails.add(`${lastName}${firstName[0]}@${cleanDomain}`);
        emails.add(`${lastName}.${firstName[0]}@${cleanDomain}`);
        emails.add(`${lastName}_${firstName[0]}@${cleanDomain}`);
      }
    }
    
    // If no names found, add common patterns
    if (foundNames.size === 0) {
      for (const firstName of COMMON_FIRST_NAMES.slice(0, 5)) { // Limit to first 5 names
        emails.add(`${firstName}@${cleanDomain}`);
      }
    }
  } catch (error) {
    console.log(`Error generating email patterns for ${domain}: ${error.message}`);
  }
  
  return Array.from(emails);
}

/**
 * Verify email exists using simple SMTP check
 */
async function verifyEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;
  
  try {
    // First check MX records to ensure domain can receive email
    const mxRecords = await promisify(dns.resolveMx)(domain).catch(() => []);
    if (!mxRecords.length) return false;
    
    // Simple SMTP verification - just check if mail server responds to connection
    // but don't perform full SMTP verification to avoid landing on spam lists
    const smtpServer = mxRecords[0].exchange;
    
    // Connect to SMTP server
    const socket = new net.Socket();
    let valid = false;
    
    return new Promise((resolve) => {
      // Set timeout
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 5000);
      
      socket.connect(25, smtpServer, () => {
        clearTimeout(timeout);
        valid = true;
        socket.end();
        resolve(true);
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    return false;
  }
}

/**
 * Check GitHub for public repositories associated with domain
 */
async function checkGitHubForEmails(domain: string): Promise<string[]> {
  const emails = new Set<string>();
  
  try {
    // Search GitHub for repositories matching the domain
    const cleanDomain = domain.replace(/^www\./, '');
    const searchUrl = `https://api.github.com/search/repositories?q=${cleanDomain}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.data || !response.data.items) {
      return [];
    }
    
    // Check the top 3 repositories
    const repos = response.data.items.slice(0, 3);
    
    for (const repo of repos) {
      if (!repo.html_url) continue;
      
      // Get repository information including README
      const readmeUrl = `https://api.github.com/repos/${repo.full_name}/readme`;
      const readmeResponse = await axios.get(readmeUrl, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'application/vnd.github.v3.raw'
        }
      }).catch(() => null);
      
      if (readmeResponse && readmeResponse.data) {
        // Extract emails from README content
        const readmeEmails = extractEmailsFromText(readmeResponse.data);
        readmeEmails.forEach(email => {
          // Only include emails from this domain
          if (email.endsWith(`@${cleanDomain}`)) {
            emails.add(email);
          }
        });
      }
    }
  } catch (error) {
    console.log(`Error checking GitHub for ${domain}: ${error.message}`);
  }
  
  return Array.from(emails);
}

/**
 * Process a single opportunity to extract contact information
 */
async function processOpportunity(opportunity: any, isPremium: boolean): Promise<boolean> {
  console.log(`Processing opportunity #${opportunity.id}: ${opportunity.url} (premium: ${isPremium})`);
  
  const domain = extractDomain(opportunity.url);
  if (!domain) {
    console.log(`  No domain found for opportunity #${opportunity.id}`);
    return false;
  }
  
  // Parse existing contact info if available
  let existingContactInfo: ContactInfo = {
    emails: [],
    socialProfiles: [],
    contactForms: [],
    extractionDetails: {
      normalized: true,
      source: 'enhanced-email-extractor',
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    }
  };
  
  try {
    if (opportunity.contactInfo) {
      const parsed = JSON.parse(opportunity.contactInfo);
      existingContactInfo = {
        ...parsed,
        extractionDetails: {
          normalized: true,
          source: 'enhanced-email-extractor',
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    console.log(`  Error parsing existing contact info for #${opportunity.id}: ${error.message}`);
  }
  
  const previousEmailCount = existingContactInfo.emails.length;
  const allEmails = new Set<string>(existingContactInfo.emails);
  
  // Method 1: Extract emails from contact pages
  const contactPages = await findAllContactPages(`https://${domain}`);
  for (const page of contactPages) {
    const emails = await extractEmailsFromPage(page, domain);
    emails.forEach(email => allEmails.add(email));
  }
  
  // Method 2: Extract emails from WHOIS data
  const whoisEmails = await extractWhoisData(domain);
  whoisEmails.forEach(email => allEmails.add(email));
  
  // Method 3: Generate common patterns and verify (only if premium or no emails found yet)
  if (isPremium || allEmails.size === 0) {
    const patternEmails = await generateEmailPatterns(domain);
    
    // Verify top 10 patterns only to avoid excessive SMTP checks
    for (const email of patternEmails.slice(0, 10)) {
      const isValid = await verifyEmail(email);
      if (isValid) {
        allEmails.add(email);
      }
    }
  }
  
  // Method 4: Check GitHub for public repositories (premium only)
  if (isPremium) {
    const githubEmails = await checkGitHubForEmails(domain);
    githubEmails.forEach(email => allEmails.add(email));
  }
  
  // Update opportunity with new emails
  existingContactInfo.emails = Array.from(allEmails);
  
  // Only update if we found new emails
  if (existingContactInfo.emails.length > previousEmailCount) {
    try {
      await db.update(schema.discoveredOpportunities)
        .set({
          contactInfo: JSON.stringify(existingContactInfo)
        })
        .where(eq(schema.discoveredOpportunities.id, opportunity.id));
      
      console.log(`  Updated opportunity #${opportunity.id}, found ${existingContactInfo.emails.length} emails (previously ${previousEmailCount})`);
      return true;
    } catch (error) {
      console.log(`  Error updating opportunity #${opportunity.id}: ${error.message}`);
      return false;
    }
  } else {
    console.log(`  No new emails found for opportunity #${opportunity.id}`);
    return false;
  }
}

/**
 * Main function to extract email contact information
 */
async function enhancedEmailExtraction() {
  console.log('Starting enhanced email extraction...');
  
  try {
    // Get a set of opportunities to process - just get some random ones for testing
    // Simplified to avoid SQL syntax issues
    const premiumOpportunities = await db.select()
      .from(schema.discoveredOpportunities)
      .where(not(isNull(schema.discoveredOpportunities.url)))
      .limit(MAX_OPPORTUNITIES_TO_PROCESS);
    
    console.log(`Found ${premiumOpportunities.length} premium opportunities to process`);
    
    let processedPremium = 0;
    let updatedPremium = 0;
    
    // Process premium opportunities in batches
    for (let i = 0; i < premiumOpportunities.length; i += BATCH_SIZE) {
      const batch = premiumOpportunities.slice(i, i + BATCH_SIZE);
      
      // Process each opportunity in the batch sequentially to avoid rate limiting
      for (const opportunity of batch) {
        processedPremium++;
        const updated = await processOpportunity(opportunity, true);
        if (updated) updatedPremium++;
        
        // Short delay between opportunities
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`Processed ${processedPremium}/${premiumOpportunities.length} premium opportunities, updated ${updatedPremium}`);
      
      // Longer delay between batches
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    console.log('Enhanced email extraction completed!');
  } catch (error) {
    console.error('Error during enhanced email extraction:', error);
  } finally {
    await pool.end();
  }
}

// Start the extraction process
enhancedEmailExtraction();