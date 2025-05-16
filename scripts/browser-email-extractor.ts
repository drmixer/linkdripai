/**
 * Browser-Powered Email Extractor
 * 
 * This script uses Puppeteer to perform browser-based crawling for more effective
 * email extraction from modern websites with JavaScript, obfuscation, and protection.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, not, isNull, sql, or } from 'drizzle-orm';
import * as schema from '../shared/schema';
import ws from 'ws';
import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dns from 'dns';
import { setTimeout } from 'timers/promises';

// Promisify functions
const dnsResolveMx = promisify(dns.resolveMx);
const execPromise = promisify(exec);

// Configure neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

// Constants
const CONCURRENCY_LIMIT = 3; // Lower concurrency for browser automation
const RATE_LIMIT_DELAY = 2000; // Longer delay between requests
const BATCH_SIZE = 10;
const BROWSER_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const WHOIS_TIMEOUT = 10000; // 10 seconds

// Common paths that often contain contact information
const CONTACT_PATHS = [
  '/contact', '/contact-us', '/about/contact', '/contact/index.html',
  '/about', '/about-us', '/team', '/our-team', '/about/team',
  '/company', '/support', '/help'
];

// Track processing domains
const domainLastAccess: Record<string, number> = {};
const processingDomains = new Set<string>();
let currentConcurrency = 0;

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const cleanedUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    return cleanedUrl.split('/')[0].toLowerCase();
  } catch (error) {
    console.error('Error extracting domain:', error);
    return url;
  }
}

/**
 * Clean up and standardize URL
 */
function cleanUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Check if request to domain should be throttled
 */
function shouldThrottleDomain(domain: string): boolean {
  const now = Date.now();
  const lastAccess = domainLastAccess[domain] || 0;
  
  if (now - lastAccess < RATE_LIMIT_DELAY) {
    return true;
  }
  
  domainLastAccess[domain] = now;
  return false;
}

/**
 * Extract emails using a headless browser
 * This can handle JavaScript-rendered content and complex obfuscation
 */
async function extractEmailsWithBrowser(url: string, retries = 0): Promise<string[]> {
  if (retries >= MAX_RETRIES) {
    console.log(`Maximum retries reached for ${url}`);
    return [];
  }
  
  const domain = extractDomain(url);
  
  if (shouldThrottleDomain(domain)) {
    console.log(`Rate limiting ${domain}, waiting...`);
    await setTimeout(RATE_LIMIT_DELAY);
    return extractEmailsWithBrowser(url, retries);
  }
  
  console.log(`Browser crawling: ${url}`);
  let browser;
  
  try {
    // Launch browser with timeout and other options
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: BROWSER_TIMEOUT
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Set request timeout and abort resource types that aren't needed
    await page.setDefaultNavigationTimeout(BROWSER_TIMEOUT);
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Navigate to URL with timeout
    await Promise.race([
      page.goto(url, { waitUntil: 'networkidle2' }),
      new Promise((_, reject) => setTimeout(BROWSER_TIMEOUT).then(() => reject(new Error('Navigation timeout'))))
    ]);
    
    // Wait for any lazy-loaded content
    await page.waitForTimeout(2000);
    
    // Extract emails from the page content
    const emails = await page.evaluate(() => {
      const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
      const content = document.body.innerText;
      return Array.from(new Set(content.match(emailRegex) || []));
    });
    
    // Look for mailto links (these often have different formats)
    const mailtoEmails = await page.evaluate(() => {
      const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
      return mailtoLinks.map(link => {
        const href = link.getAttribute('href');
        if (href) {
          const email = href.replace('mailto:', '').split('?')[0].trim();
          return email;
        }
        return null;
      }).filter(email => email !== null);
    });
    
    // Check for other common patterns
    const extraEmails = await page.evaluate(() => {
      // Look for elements with data-email attribute
      const dataEmailElements = Array.from(document.querySelectorAll('[data-email]'));
      const dataEmails = dataEmailElements.map(el => el.getAttribute('data-email')).filter(Boolean);
      
      // Look for Cloudflare protected emails (simplification)
      const cfEmails = [];
      const cfElements = Array.from(document.querySelectorAll('[data-cfemail]'));
      
      // Combine all sources
      return [...dataEmails, ...cfEmails];
    });
    
    // Combine all discovered emails
    const allEmails = new Set([...emails, ...mailtoEmails, ...extraEmails]);
    
    // Clean up emails
    const cleanedEmails = [...allEmails].map(email => {
      if (typeof email === 'string') {
        return email.toLowerCase().trim();
      }
      return null;
    }).filter(Boolean) as string[];
    
    return cleanedEmails;
  } catch (error) {
    console.error(`Error browsing ${url}:`, error.message);
    await setTimeout(1000 * (retries + 1)); // Exponential backoff
    return extractEmailsWithBrowser(url, retries + 1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Find and analyze contact pages
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  // Ensure baseUrl has correct format
  const baseUrlClean = cleanUrl(baseUrl);
  const domain = extractDomain(baseUrl);
  const contactUrls = [];
  
  // First try common contact paths
  for (const path of CONTACT_PATHS) {
    contactUrls.push(`${baseUrlClean}${path}`);
  }
  
  // Try to analyze the homepage to find contact page links
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: BROWSER_TIMEOUT
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Abort image/font/media requests to speed things up
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Navigate to the homepage
    await page.goto(baseUrlClean, { waitUntil: 'networkidle2', timeout: BROWSER_TIMEOUT });
    
    // Find contact page links
    const contactLinks = await page.evaluate((domain) => {
      const links = Array.from(document.querySelectorAll('a'));
      const contactKeywords = ['contact', 'about', 'team', 'get in touch', 'support', 'help'];
      
      return links.filter(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.toLowerCase() || '';
        
        // Skip if no href or it's an external link or hash/javascript link
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          return false;
        }
        
        // Check if it's a contact-related link based on text
        const isContactLink = contactKeywords.some(keyword => text.includes(keyword));
        
        // Check if href is internal link (relative or same domain)
        const isInternalLink = href.startsWith('/') || 
                              !href.startsWith('http') || 
                              href.includes(domain);
        
        return isContactLink && isInternalLink;
      }).map(link => {
        const href = link.getAttribute('href');
        if (href?.startsWith('http')) {
          return href;
        } else if (href?.startsWith('/')) {
          return `${window.location.origin}${href}`;
        } else {
          return `${window.location.origin}/${href}`;
        }
      });
    }, domain);
    
    // Add found links to our contact URLs
    contactLinks.forEach(link => contactUrls.push(link));
    
    await browser.close();
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrlClean}:`, error.message);
  }
  
  // Remove duplicates and return
  return [...new Set(contactUrls)];
}

/**
 * Get WHOIS data (used as a fallback when website scraping fails)
 */
async function getWhoisEmails(domain: string): Promise<string[]> {
  try {
    console.log(`Getting WHOIS data for ${domain}`);
    const { stdout } = await execPromise(`whois ${domain}`, { timeout: WHOIS_TIMEOUT });
    
    // Extract emails from WHOIS data
    const emails = new Set<string>();
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = stdout.match(emailPattern) || [];
    
    matches.forEach(email => {
      // Filter out privacy protection emails
      if (!email.includes('privacyprotect') && 
          !email.includes('privacy') && 
          !email.includes('protect') &&
          !email.includes('proxy')) {
        emails.add(email.toLowerCase());
      }
    });
    
    return [...emails];
  } catch (error) {
    console.error(`Error getting WHOIS data for ${domain}:`, error);
    return [];
  }
}

/**
 * Check if domain has email servers
 */
async function hasEmailServers(domain: string): Promise<boolean> {
  try {
    const records = await dnsResolveMx(domain);
    return records.length > 0;
  } catch (error) {
    console.error(`Error checking MX records for ${domain}:`, error);
    return false;
  }
}

/**
 * Generate common email patterns for domains with email servers
 */
async function generateCommonEmails(domain: string): Promise<string[]> {
  // Check if domain has email servers first
  const hasMx = await hasEmailServers(domain);
  if (!hasMx) {
    return [];
  }
  
  // Common email patterns
  const patterns = [
    'info',
    'contact',
    'hello',
    'support',
    'sales',
    'marketing',
    'help',
    'admin',
    'team',
    'media'
  ];
  
  return patterns.map(pattern => `${pattern}@${domain}`);
}

/**
 * Process a single opportunity
 */
async function processOpportunity(opportunity: any): Promise<string[]> {
  try {
    console.log(`Processing opportunity: ${opportunity.domain} (ID: ${opportunity.id})`);
    const allEmails = new Set<string>();
    const domain = extractDomain(opportunity.url);
    
    // 1. Extract emails from the main page using browser
    const mainPageEmails = await extractEmailsWithBrowser(opportunity.url);
    mainPageEmails.forEach(email => allEmails.add(email));
    
    // 2. Find and extract emails from contact pages
    const contactPages = await findContactPages(opportunity.url);
    for (const contactUrl of contactPages.slice(0, 3)) { // Limit to 3 contact pages
      const contactEmails = await extractEmailsWithBrowser(contactUrl);
      contactEmails.forEach(email => allEmails.add(email));
      
      // Stop if we found emails
      if (contactEmails.length > 0) {
        break;
      }
    }
    
    // 3. Try WHOIS as a fallback
    if (allEmails.size === 0) {
      const whoisEmails = await getWhoisEmails(domain);
      whoisEmails.forEach(email => allEmails.add(email));
    }
    
    // 4. Generate common emails if we still don't have any
    if (allEmails.size === 0) {
      const generatedEmails = await generateCommonEmails(domain);
      generatedEmails.forEach(email => allEmails.add(email));
    }
    
    return [...allEmails];
  } catch (error) {
    console.error(`Error processing opportunity ${opportunity.domain}:`, error);
    return [];
  }
}

/**
 * Update the opportunity with the extracted emails
 */
async function updateOpportunityEmails(id: number, emails: string[]): Promise<void> {
  try {
    // Get the current contact info
    const [opportunity] = await db
      .select({ contactInfo: schema.discoveredOpportunities.contactInfo })
      .from(schema.discoveredOpportunities)
      .where(eq(schema.discoveredOpportunities.id, id));
    
    if (!opportunity) {
      console.error(`Opportunity with ID ${id} not found`);
      return;
    }
    
    // Parse existing contact info or create new structure
    let contactInfo;
    try {
      if (typeof opportunity.contactInfo === 'string') {
        contactInfo = JSON.parse(opportunity.contactInfo);
      } else {
        contactInfo = opportunity.contactInfo || {};
      }
    } catch (e) {
      console.error(`Error parsing contact info for ID ${id}:`, e);
      contactInfo = {};
    }
    
    // Ensure the contactInfo has the expected structure
    if (!contactInfo.emails) contactInfo.emails = [];
    if (!contactInfo.socialProfiles) contactInfo.socialProfiles = [];
    if (!contactInfo.contactForms) contactInfo.contactForms = [];
    if (!contactInfo.extractionDetails) {
      contactInfo.extractionDetails = {
        normalized: true,
        source: 'browser-email-extractor',
        version: '1.0',
        lastUpdated: new Date().toISOString()
      };
    } else {
      contactInfo.extractionDetails.lastUpdated = new Date().toISOString();
      if (contactInfo.extractionDetails.source !== 'browser-email-extractor') {
        contactInfo.extractionDetails.source = 'browser-email-extractor+' + contactInfo.extractionDetails.source;
      }
    }
    
    // Add the extracted emails (avoid duplicates)
    contactInfo.emails = [...new Set([...contactInfo.emails, ...emails])];
    
    // Update the database
    await db.update(schema.discoveredOpportunities)
      .set({ contactInfo: contactInfo })
      .where(eq(schema.discoveredOpportunities.id, id));
    
    console.log(`Updated opportunity ${id} with ${emails.length} emails`);
  } catch (error) {
    console.error(`Error updating opportunity ${id}:`, error);
  }
}

/**
 * Process a batch of opportunities
 */
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
      await setTimeout(200);
    }
    
    // Track concurrency
    currentConcurrency++;
    processingDomains.add(domain);
    
    // Process opportunity
    const promise = (async () => {
      try {
        const emails = await processOpportunity(opportunity);
        console.log(`Found ${emails.length} emails for ${opportunity.domain}`);
        
        if (emails.length > 0) {
          await updateOpportunityEmails(opportunity.id, emails);
        }
      } catch (error) {
        console.error(`Error processing ${opportunity.domain}:`, error);
      } finally {
        // Cleanup tracking
        currentConcurrency--;
        processingDomains.delete(domain);
      }
    })();
    
    concurrentPromises.push(promise);
    
    // Stagger requests
    await setTimeout(500);
  }
  
  // Wait for all promises to complete
  await Promise.all(concurrentPromises);
}

/**
 * Main function to run the browser-based email extraction
 */
async function runBrowserEmailExtractor(
  batchSize = BATCH_SIZE,
  processPremiumOnly = false
) {
  try {
    console.log(`Starting browser-based email extractor (${processPremiumOnly ? 'premium only' : 'all opportunities'})`);
    
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
    
    // Filter for premium only if requested
    if (processPremiumOnly) {
      query = query.where(sql`${schema.discoveredOpportunities.domainAuthority}::float >= 40`);
    }
    
    const opportunities = await query.limit(batchSize);
    
    console.log(`Found ${opportunities.length} opportunities to process`);
    
    if (opportunities.length === 0) {
      console.log('No opportunities to process, exiting');
      return;
    }
    
    // Process all opportunities
    await processBatch(opportunities);
    
    console.log('Browser-based email extraction completed');
  } catch (error) {
    console.error('Error running browser email extractor:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const batchSizeArg = args.find(arg => arg.startsWith('--batch='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : BATCH_SIZE;
const premiumOnly = args.includes('--premium-only');

// Run the extractor
runBrowserEmailExtractor(batchSize, premiumOnly);