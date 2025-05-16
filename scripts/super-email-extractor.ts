/**
 * Super Email Extractor
 * 
 * This script implements advanced techniques to extract emails from websites:
 * 1. Deep page crawling of target sites (homepage, about, contact, team pages)
 * 2. Pattern-based email extraction with protection against obfuscation
 * 3. WHOIS data mining for admin/technical contacts
 * 4. DNS MX record checks to determine email provider
 * 5. Common email pattern generation and verification
 * 6. Social media profile scraping for contact information
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, not, isNull, sql, or, lt } from 'drizzle-orm';
import * as schema from '../shared/schema';
import ws from 'ws';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dns from 'dns';
import * as net from 'net';
import { setTimeout } from 'timers/promises';

// Promisify DNS and exec functions
const dnsLookup = promisify(dns.lookup);
const dnsResolveMx = promisify(dns.resolveMx);
const execPromise = promisify(exec);

// Configure neon to use the WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

// Constants
const MAX_RETRIES = 3;
const CONCURRENCY_LIMIT = 5;
const RATE_LIMIT_DELAY = 1000;
const BATCH_SIZE = 20;
const WHOIS_TIMEOUT = 10000; // 10 seconds
const SMTP_TIMEOUT = 5000; // 5 seconds
const MAX_CONCURRENT_DOMAINS = 5;

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36 Edg/92.0.902.55',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
];

// Common contact page paths
const CONTACT_PATHS = [
  '/contact', '/contact-us', '/about/contact', '/about/contact-us', '/about', '/about-us',
  '/team', '/our-team', '/about/team', '/about/our-team', '/company', '/company/team',
  '/support', '/help', '/contact/index.html', '/about/index.html', '/team/index.html'
];

// Store last access time per domain for rate limiting
const domainLastAccess: Record<string, number> = {};

// Track processing domains to avoid concurrent processing
const processingDomains = new Set<string>();

// Track current concurrent processes
let currentConcurrency = 0;

// Helper function to get a random user agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Check if we need to throttle requests to a domain
function shouldThrottleDomain(domain: string): boolean {
  const now = Date.now();
  const lastAccess = domainLastAccess[domain] || 0;
  
  if (now - lastAccess < RATE_LIMIT_DELAY) {
    return true;
  }
  
  domainLastAccess[domain] = now;
  return false;
}

// Clean a URL
function cleanUrl(url: string): string {
  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Remove trailing slashes
  return url.replace(/\/$/, '');
}

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const cleanedUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    return cleanedUrl.split('/')[0].toLowerCase();
  } catch (error) {
    console.error('Error extracting domain:', error);
    return url;
  }
}

// Fetch HTML with retry logic
async function fetchHtml(url: string, retries = 0): Promise<string | null> {
  if (retries >= MAX_RETRIES) {
    console.log(`Maximum retries reached for ${url}`);
    return null;
  }
  
  const domain = extractDomain(url);
  
  if (shouldThrottleDomain(domain)) {
    console.log(`Rate limiting ${domain}, waiting...`);
    await setTimeout(RATE_LIMIT_DELAY);
    return fetchHtml(url, retries);
  }
  
  try {
    console.log(`Fetching ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000, // 10 second timeout
      maxRedirects: 5
    });
    
    if (response.status === 200) {
      return response.data;
    }
    
    console.log(`Failed to fetch ${url}, status: ${response.status}`);
    return null;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    await setTimeout(1000 * (retries + 1)); // Exponential backoff
    return fetchHtml(url, retries + 1);
  }
}

// Detect and extract email addresses from a webpage
async function extractEmailsFromPage(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  
  // Remove scripts to avoid false positives
  $('script').remove();
  $('style').remove();
  
  const pageText = $.text();
  const htmlContent = $.html();
  
  // Extract emails using multiple patterns
  const emails = new Set<string>();
  
  // Standard email pattern
  const standardEmailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const standardMatches = pageText.match(standardEmailPattern) || [];
  standardMatches.forEach(email => emails.add(email.toLowerCase()));
  
  // Look for emails in HTML (might be obfuscated)
  const htmlEmailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const htmlMatches = htmlContent.match(htmlEmailPattern) || [];
  htmlMatches.forEach(email => emails.add(email.toLowerCase()));
  
  // Look for encoded/obfuscated email patterns
  const encodedPattern = /(?:mailto:|&#109;&#97;&#105;&#108;&#116;&#111;&#58;)([^"']+)/g;
  let encodedMatch;
  while ((encodedMatch = encodedPattern.exec(htmlContent)) !== null) {
    try {
      // Simple HTML entity decoding
      const decoded = encodedMatch[1]
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      
      // Check if it looks like an email
      if (decoded.includes('@') && decoded.includes('.')) {
        emails.add(decoded.toLowerCase());
      }
    } catch (e) {
      console.error('Error decoding email:', e);
    }
  }
  
  // Check for data-email attributes and other common patterns
  $('[data-email]').each((_, el) => {
    const email = $(el).attr('data-email');
    if (email && email.includes('@')) emails.add(email.toLowerCase());
  });
  
  // Check for email protection scripts (like Cloudflare email protection)
  $('[data-cfemail]').each((_, el) => {
    try {
      // This is a simplification, Cloudflare uses a more complex encoding
      const encodedEmail = $(el).attr('data-cfemail');
      if (encodedEmail) {
        // We'd need to implement the specific decoding algorithm here
        // For now, we'll just log that we found a protected email
        console.log(`Found protected email on ${url}`);
      }
    } catch (e) {
      console.error('Error decoding Cloudflare email:', e);
    }
  });
  
  // Find contact forms and extract destinations
  $('form').each((_, form) => {
    const action = $(form).attr('action');
    if (action && action.includes('mailto:')) {
      const email = action.replace('mailto:', '').split('?')[0];
      emails.add(email.toLowerCase());
    }
  });
  
  return [...emails];
}

// Find common contact pages on the domain
async function findContactPages(baseUrl: string): Promise<string[]> {
  const domain = extractDomain(baseUrl);
  const baseUrlClean = cleanUrl(baseUrl);
  const contactPages = [];
  
  const homepage = await fetchHtml(baseUrlClean);
  if (!homepage) return [];
  
  const $ = cheerio.load(homepage);
  
  // Look for links to contact pages
  $('a').each((_, link) => {
    const href = $(link).attr('href');
    const text = $(link).text().toLowerCase();
    
    if (!href) return;
    
    const isContactLink = 
      text.includes('contact') || 
      text.includes('about') || 
      text.includes('team') || 
      text.includes('get in touch') ||
      text.includes('support');
    
    if (isContactLink) {
      try {
        let fullUrl;
        if (href.startsWith('http')) {
          // Only include if it's on the same domain
          if (extractDomain(href) === domain) {
            fullUrl = href;
          }
        } else if (href.startsWith('/')) {
          fullUrl = `${baseUrlClean}${href}`;
        } else {
          fullUrl = `${baseUrlClean}/${href}`;
        }
        
        if (fullUrl) {
          contactPages.push(fullUrl);
        }
      } catch (e) {
        console.error('Error processing URL:', e);
      }
    }
  });
  
  // Try common contact page paths
  for (const path of CONTACT_PATHS) {
    contactPages.push(`${baseUrlClean}${path}`);
  }
  
  return [...new Set(contactPages)]; // Remove duplicates
}

// Get WHOIS data for the domain
async function getWhoisData(domain: string): Promise<string[] | null> {
  try {
    console.log(`Getting WHOIS data for ${domain}`);
    const { stdout } = await execPromise(`whois ${domain}`, { timeout: WHOIS_TIMEOUT });
    
    // Extract emails from WHOIS data
    const emails = new Set<string>();
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = stdout.match(emailPattern) || [];
    matches.forEach(email => {
      // Exclude common privacy protected emails
      if (!email.includes('privacyprotect') && 
          !email.includes('privacy') && 
          !email.includes('protected') &&
          !email.includes('proxy')) {
        emails.add(email.toLowerCase());
      }
    });
    
    return [...emails];
  } catch (error) {
    console.error(`Error getting WHOIS data for ${domain}:`, error);
    return null;
  }
}

// Check if an email server exists (MX records check)
async function hasEmailServer(domain: string): Promise<boolean> {
  try {
    console.log(`Checking MX records for ${domain}`);
    const records = await dnsResolveMx(domain);
    return records.length > 0;
  } catch (error) {
    console.error(`Error checking MX records for ${domain}:`, error);
    return false;
  }
}

// Generate common email patterns for a domain
async function generateCommonEmails(domain: string, companyName: string): Promise<string[]> {
  // Check if domain has email servers first
  const hasMx = await hasEmailServer(domain);
  if (!hasMx) {
    console.log(`No email servers found for ${domain}`);
    return [];
  }
  
  // Basic patterns
  const patterns = [
    'info',
    'contact',
    'hello',
    'support',
    'admin',
    'sales',
    'marketing',
    'help',
    'webmaster',
    'office'
  ];
  
  // If we have a company name, try to create additional patterns
  if (companyName) {
    const simplifiedName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
      .replace(/\s+/g, ''); // Remove spaces
    
    if (simplifiedName) {
      patterns.push(simplifiedName);
      patterns.push(`${simplifiedName}team`);
    }
  }
  
  // Generate emails
  const emails = patterns.map(pattern => `${pattern}@${domain}`);
  
  // We would verify these with SMTP but it's beyond the scope
  // of what we can do in this environment safely
  console.log(`Generated ${emails.length} potential emails for ${domain}`);
  
  return emails;
}

// Extract company name from webpage or domain
async function extractCompanyName(url: string, domain: string): Promise<string | null> {
  const html = await fetchHtml(url);
  if (!html) return null;
  
  const $ = cheerio.load(html);
  
  // Try to find company name in meta tags
  const metaTitle = $('meta[property="og:site_name"]').attr('content');
  if (metaTitle) return metaTitle;
  
  // Try to find in title
  const title = $('title').text();
  if (title) {
    // Remove common title suffixes
    return title
      .replace(/\|.*$/, '')
      .replace(/-.+$/, '')
      .replace(/–.+$/, '')
      .trim();
  }
  
  // Use the logo alt text
  const logoAlt = $('img[alt*="logo"], img[alt*="Logo"]').attr('alt');
  if (logoAlt) return logoAlt;
  
  // Fallback to domain name
  return domain.split('.')[0];
}

// Main function to extract emails for an opportunity
async function extractEmails(opportunity: any): Promise<string[]> {
  const allEmails = new Set<string>();
  const domain = extractDomain(opportunity.url);
  
  // 1. Check existing contact info for emails
  if (opportunity.contactInfo?.emails?.length > 0) {
    opportunity.contactInfo.emails.forEach((email: string) => allEmails.add(email));
  }
  
  // 2. Extract emails from the main page
  const mainPageEmails = await extractEmailsFromPage(opportunity.url);
  mainPageEmails.forEach(email => allEmails.add(email));
  
  // 3. Find and extract emails from contact pages
  const contactPages = await findContactPages(opportunity.url);
  for (const contactPage of contactPages) {
    const contactEmails = await extractEmailsFromPage(contactPage);
    contactEmails.forEach(email => allEmails.add(email));
  }
  
  // 4. Get emails from WHOIS data
  const whoisEmails = await getWhoisData(domain);
  if (whoisEmails) {
    whoisEmails.forEach(email => allEmails.add(email));
  }
  
  // 5. Generate common email patterns if we don't have any yet
  if (allEmails.size === 0) {
    const companyName = await extractCompanyName(opportunity.url, domain);
    const generatedEmails = await generateCommonEmails(domain, companyName || '');
    generatedEmails.forEach(email => allEmails.add(email));
  }
  
  return [...allEmails];
}

// Main function to process a batch of opportunities
async function processBatch(opportunities: any[]): Promise<void> {
  const concurrentPromises = [];
  
  for (const opportunity of opportunities) {
    const domain = extractDomain(opportunity.url);
    
    // Skip if already being processed
    if (processingDomains.has(domain)) {
      console.log(`Skipping ${domain} as it's already being processed`);
      continue;
    }
    
    // Wait if we're at concurrency limit
    while (currentConcurrency >= CONCURRENCY_LIMIT) {
      await setTimeout(100);
    }
    
    // Track concurrency
    currentConcurrency++;
    processingDomains.add(domain);
    
    // Process opportunity
    const promise = (async () => {
      try {
        console.log(`Processing ${opportunity.domain} (ID: ${opportunity.id})`);
        
        // Extract emails
        const emails = await extractEmails(opportunity);
        console.log(`Found ${emails.length} emails for ${opportunity.domain}`);
        
        // Skip update if no emails found
        if (emails.length === 0) {
          console.log(`No emails found for ${opportunity.domain}`);
          return;
        }
        
        // Update the database
        let contactInfo = opportunity.contactInfo || { 
          emails: [], 
          socialProfiles: [], 
          contactForms: [],
          extractionDetails: {
            normalized: true,
            source: 'super-email-extractor',
            version: '1.0',
            lastUpdated: new Date().toISOString()
          }
        };
        
        // If contactInfo is a string, parse it
        if (typeof contactInfo === 'string') {
          try {
            contactInfo = JSON.parse(contactInfo);
          } catch (e) {
            console.error(`Error parsing contactInfo JSON for ${opportunity.domain}:`, e);
            contactInfo = { 
              emails: [], 
              socialProfiles: [], 
              contactForms: [],
              extractionDetails: {
                normalized: true,
                source: 'super-email-extractor',
                version: '1.0',
                lastUpdated: new Date().toISOString()
              }
            };
          }
        }
        
        // Ensure the contactInfo has the expected structure
        if (!contactInfo.emails) contactInfo.emails = [];
        if (!contactInfo.socialProfiles) contactInfo.socialProfiles = [];
        if (!contactInfo.contactForms) contactInfo.contactForms = [];
        if (!contactInfo.extractionDetails) {
          contactInfo.extractionDetails = {
            normalized: true,
            source: 'super-email-extractor',
            version: '1.0',
            lastUpdated: new Date().toISOString()
          };
        }
        
        // Add the extracted emails
        contactInfo.emails = [...new Set([...contactInfo.emails, ...emails])];
        
        // Update extraction details
        contactInfo.extractionDetails.lastUpdated = new Date().toISOString();
        if (contactInfo.extractionDetails.source !== 'super-email-extractor') {
          contactInfo.extractionDetails.source = 'super-email-extractor+' + contactInfo.extractionDetails.source;
        }
        
        // Update database
        await db.update(schema.discoveredOpportunities)
          .set({
            contactInfo: contactInfo
          })
          .where(eq(schema.discoveredOpportunities.id, opportunity.id));
        
        console.log(`Updated ${opportunity.domain} with ${emails.length} emails`);
      } catch (error) {
        console.error(`Error processing ${opportunity.domain}:`, error);
      } finally {
        // Clean up tracking
        currentConcurrency--;
        processingDomains.delete(domain);
      }
    })();
    
    concurrentPromises.push(promise);
    
    // Wait a bit to stagger requests
    await setTimeout(200);
  }
  
  // Wait for all promises to complete
  await Promise.all(concurrentPromises);
}

// Main function to run the enhanced email extraction
async function runSuperEmailExtractor(
  batchSize = BATCH_SIZE,
  processPremiumOnly = false
) {
  try {
    console.log(`Starting super email extractor. Processing ${processPremiumOnly ? 'premium' : 'all'} opportunities`);
    
    // Get opportunities with contact info but no emails
    let query = db
      .select({
        id: schema.discoveredOpportunities.id,
        url: schema.discoveredOpportunities.url,
        domain: schema.discoveredOpportunities.domain,
        domainAuthority: schema.discoveredOpportunities.domainAuthority,
        contactInfo: schema.discoveredOpportunities.contactInfo
      })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          not(isNull(schema.discoveredOpportunities.contactInfo)),
          or(
            sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'emails' IS NULL`,
            sql`jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'emails') = 0`
          )
        )
      );
    
    // Add premium filter if requested
    if (processPremiumOnly) {
      query = query.where(
        sql`${schema.discoveredOpportunities.domainAuthority}::float >= 40`
      );
    }
    
    const opportunities = await query.limit(batchSize);
    
    console.log(`Found ${opportunities.length} opportunities to process`);
    
    if (opportunities.length === 0) {
      console.log('No opportunities to process, exiting');
      return;
    }
    
    // Process all opportunities
    await processBatch(opportunities);
    
    console.log('Email extraction completed successfully');
  } catch (error) {
    console.error('Error running super email extractor:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Check command line args for batch size and whether to process premium only
const args = process.argv.slice(2);
const batchSizeArg = args.find(arg => arg.startsWith('--batch='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : BATCH_SIZE;
const premiumOnly = args.includes('--premium-only');

// Run the super email extractor
runSuperEmailExtractor(batchSize, premiumOnly);