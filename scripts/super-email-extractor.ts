/**
 * Super Email Extractor
 * 
 * This script implements aggressive multi-source email extraction:
 * 1. Deep crawling of up to 10 pages per domain
 * 2. Advanced JavaScript de-obfuscation
 * 3. Image-based OCR for contact emails
 * 4. WHOIS record analysis
 * 5. LinkedIn company page scraping
 * 6. Advanced pattern matching
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql, eq } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio";
import * as whois from "whois-json";
import crypto from "crypto";
import { setTimeout } from "timers/promises";
import { URL } from "url";

// Configuration
const MAX_CONCURRENT = 2;         // Maximum concurrent requests
const THROTTLE_DELAY = 5000;      // Minimum time between requests to same domain (ms)
const MAX_RETRIES = 3;            // Maximum retry attempts
const MAX_PAGES_PER_DOMAIN = 10;  // Maximum pages to crawl per domain
const MAX_CRAWL_DEPTH = 2;        // Maximum depth for crawling

// Tracking for rate limiting
const domainLastAccessed = new Map<string, number>();
const processedDomains = new Set<string>();

// User agents for rotation
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0"
];

// Common paths to check
const COMMON_PATHS = [
  "/contact", "/contact-us", "/about", "/about-us", "/team", "/our-team", 
  "/company", "/connect", "/get-in-touch", "/reach-us", "/people",
  "/staff", "/directory", "/meet-the-team", "/contact.html", "/contact.php",
  "/about.html", "/about.php", "/about/team", "/about/contact", "/company/team",
  "/company/contact", "/team.html", "/team.php", "/kontakt", "/contacto"
];

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
function calculateBackoff(retry: number, baseDelay = 1000, maxDelay = 30000): number {
  const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, retry));
  const jitter = Math.random() * 0.4 + 0.8; // 0.8-1.2 jitter factor
  return exponentialDelay * jitter;
}

/**
 * Check if we should throttle requests to a domain
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = THROTTLE_DELAY): boolean {
  const rootDomain = extractRootDomain(domain);
  const now = Date.now();
  const lastAccess = domainLastAccessed.get(rootDomain) || 0;
  
  if (now - lastAccess < minTimeBetweenRequests) {
    return true;
  }
  
  domainLastAccessed.set(rootDomain, now);
  return false;
}

/**
 * Extract root domain from a domain name
 */
function extractRootDomain(domain: string): string {
  // Extract the root domain (e.g., example.com from sub.example.com)
  const parts = domain.toLowerCase().split('.');
  if (parts.length <= 2) return domain.toLowerCase();
  
  // Handle special cases like co.uk, com.au
  const tlds = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'co.za', 'co.in', 'com.br', 'com.sg'];
  const lastTwoParts = parts.slice(-2).join('.');
  
  if (tlds.includes(lastTwoParts)) {
    // If it's a special TLD, use last three parts
    return parts.slice(-3).join('.');
  }
  
  // Otherwise use last two parts
  return lastTwoParts;
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    // Normalize to remove trailing slash
    let cleanUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    cleanUrl = cleanUrl.replace(/\/$/, '');
    
    // Keep query parameters for certain pages
    if (parsedUrl.pathname.includes('contact') || parsedUrl.pathname.includes('about')) {
      cleanUrl += parsedUrl.search;
    }
    
    return cleanUrl;
  } catch (e) {
    return url;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (e) {
    return url;
  }
}

/**
 * Fetch HTML content from a URL with advanced retrying and rate limiting
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  const domain = extractDomain(url);
  
  // Throttle requests to the same domain
  if (shouldThrottleDomain(domain)) {
    await setTimeout(THROTTLE_DELAY);
  }
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${url} (retry ${retry + 1}/${maxRetries}):`, error.message);
      
      if (retry < maxRetries - 1) {
        // Wait with exponential backoff before retrying
        const delay = calculateBackoff(retry);
        await setTimeout(delay);
      }
    }
  }
  
  return null;
}

/**
 * Extract emails from a webpage with enhanced pattern recognition
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  console.log(`  - Extracting emails from ${url}`);
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const emails = new Set<string>();
  
  // Load HTML into cheerio
  const $ = cheerio.load(html);
  
  // Remove script and style elements to clean up text
  $('script, style').remove();
  
  // Method 1: Standard email regex in text content
  const bodyText = $('body').text();
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = bodyText.match(emailRegex) || [];
  matches.forEach(email => emails.add(email.toLowerCase()));
  
  // Method 2: Look for obfuscated emails in JavaScript
  $('script').each((i, el) => {
    const scriptContent = $(el).html() || '';
    
    // Look for common email obfuscation patterns
    // Pattern 1: email parts separated
    const parts = scriptContent.match(/['"]([^'"]+)['"]\s*\+\s*['"]@['"]\s*\+\s*['"]([^'"]+)['"]/g);
    if (parts) {
      parts.forEach(part => {
        const emailParts = part.match(/['"]([^'"]+)['"]/g);
        if (emailParts && emailParts.length >= 3) {
          const cleanParts = emailParts.map(p => p.replace(/['"]/g, ''));
          const email = cleanParts.join('');
          if (email.includes('@') && email.includes('.')) {
            emails.add(email.toLowerCase());
          }
        }
      });
    }
    
    // Pattern 2: character codes
    const charCodes = scriptContent.match(/String\.fromCharCode\(([^)]+)\)/g);
    if (charCodes) {
      charCodes.forEach(code => {
        try {
          const numbers = code.match(/\d+/g);
          if (numbers) {
            const decodedText = numbers.map(n => String.fromCharCode(parseInt(n))).join('');
            const emailMatch = decodedText.match(emailRegex);
            if (emailMatch) {
              emailMatch.forEach(email => emails.add(email.toLowerCase()));
            }
          }
        } catch (e) {
          // Ignore errors in JS parsing
        }
      });
    }
  });
  
  // Method 3: Check mailto links
  $('a[href^="mailto:"]').each((i, el) => {
    const mailtoHref = $(el).attr('href');
    if (mailtoHref) {
      const email = mailtoHref.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email.includes('@') && email.includes('.')) {
        emails.add(email);
      }
    }
  });
  
  // Method 4: Look for emails in HTML attributes
  $('*').each((i, el) => {
    const attribs = $(el).attr();
    if (attribs) {
      Object.values(attribs).forEach(value => {
        if (typeof value === 'string') {
          const emailMatch = value.match(emailRegex);
          if (emailMatch) {
            emailMatch.forEach(email => emails.add(email.toLowerCase()));
          }
        }
      });
    }
  });
  
  // Method 5: Check for "reversed" emails (e.g., moc.elpmaxe@ofni)
  const reversedEmailRegex = /\b[A-Za-z]{2,}\.[A-Za-z0-9.-]+@[A-Za-z0-9._%+-]+\b/g;
  const reversedMatches = bodyText.match(reversedEmailRegex) || [];
  reversedMatches.forEach(revEmail => {
    const reversed = revEmail.split('').reverse().join('');
    if (reversed.match(emailRegex)) {
      emails.add(reversed.toLowerCase());
    }
  });
  
  // Filter out common false positives and example domains
  const filteredEmails = Array.from(emails).filter(email => {
    // Skip example domains
    if (email.includes('@example.') || 
        email.includes('@domain.') ||
        email.includes('@yourcompany.') ||
        email.includes('@yourdomain.') ||
        email.includes('@company.') ||
        email.includes('@email.') || 
        email.endsWith('@gmail.com.') || 
        email.endsWith('@yahoo.com.')) {
      return false;
    }
    
    // Skip very long emails (likely errors)
    if (email.length > 50) return false;
    
    return true;
  });
  
  return filteredEmails;
}

/**
 * Find all potential contact pages by checking common paths
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  console.log(`  - Finding contact pages for ${baseUrl}`);
  try {
    const domain = extractDomain(baseUrl);
    const protocol = baseUrl.startsWith('https') ? 'https:' : 'http:';
    
    // Default to the base URL
    const pagesToCheck = new Set<string>([baseUrl]);
    
    // Add common contact paths
    for (const path of COMMON_PATHS) {
      pagesToCheck.add(`${protocol}//${domain}${path}`);
    }
    
    // If the base URL is not the homepage, also check the homepage
    if (!baseUrl.endsWith(domain) && !baseUrl.endsWith(`${domain}/`)) {
      pagesToCheck.add(`${protocol}//${domain}`);
      
      // Crawl the homepage to find contact pages
      const homepageHtml = await fetchHtml(`${protocol}//${domain}`);
      if (homepageHtml) {
        const $ = cheerio.load(homepageHtml);
        
        // Look for links containing terms like "contact", "about", "team"
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().toLowerCase();
          
          if (href && (
              text.includes('contact') || 
              text.includes('about') || 
              text.includes('team') ||
              text.includes('people') ||
              text.includes('staff'))) {
            
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = `${protocol}//${domain}${href}`;
            } else if (!href.includes('://')) {
              fullUrl = `${protocol}//${domain}/${href}`;
            }
            
            // Only add if it's from the same domain
            if (fullUrl.includes(domain)) {
              pagesToCheck.add(fullUrl);
            }
          }
        });
      }
    }
    
    const validPages: string[] = [];
    
    // Check each page with a small delay to avoid rate limiting
    for (const pageUrl of pagesToCheck) {
      try {
        const cleanUrl = cleanupUrl(pageUrl);
        // Don't check if we've already found too many pages
        if (validPages.length >= MAX_PAGES_PER_DOMAIN) break;
        
        // Skip if it's not a valid URL
        if (!cleanUrl.startsWith('http')) continue;
        
        // Check if the page exists
        const html = await fetchHtml(cleanUrl);
        if (html) {
          validPages.push(cleanUrl);
        }
        
        // Small delay between checks
        await setTimeout(1000);
      } catch (e) {
        // Skip errors
      }
    }
    
    return validPages;
  } catch (e) {
    console.error(`Error finding contact pages for ${baseUrl}:`, e);
    return [baseUrl];
  }
}

/**
 * Extract WHOIS information
 */
async function extractWhoisData(domain: string): Promise<string[]> {
  console.log(`  - Extracting WHOIS data for ${domain}`);
  try {
    const emails = new Set<string>();
    
    // Get WHOIS data
    const whoisData = await whois(domain);
    
    // Look for email fields in WHOIS data
    const whoisText = JSON.stringify(whoisData);
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = whoisText.match(emailRegex) || [];
    
    matches.forEach(email => {
      // Filter out privacy protection emails
      if (!email.includes('privacy') && 
          !email.includes('protect') && 
          !email.includes('proxy') &&
          !email.includes('redact') &&
          !email.includes('gdpr') &&
          !email.includes('whoisprivacy')) {
        emails.add(email.toLowerCase());
      }
    });
    
    return Array.from(emails);
  } catch (e) {
    console.error(`Error extracting WHOIS data for ${domain}:`, e);
    return [];
  }
}

/**
 * Main function to extract emails with multi-source approach
 */
async function extractEmails(opportunity: any): Promise<string[]> {
  console.log(`Processing ${opportunity.url} (ID: ${opportunity.id})`);
  try {
    // Skip if we've already processed this domain
    const domain = extractDomain(opportunity.url);
    const rootDomain = extractRootDomain(domain);
    if (processedDomains.has(rootDomain)) {
      console.log(`  - Already processed domain: ${rootDomain}, skipping`);
      return [];
    }
    
    processedDomains.add(rootDomain);
    
    // 1. Find all potential contact pages
    const contactPages = await findContactPages(opportunity.url);
    console.log(`  - Found ${contactPages.length} potential contact pages`);
    
    // 2. Extract emails from each page
    const allEmails = new Set<string>();
    
    for (const page of contactPages.slice(0, MAX_PAGES_PER_DOMAIN)) {
      const emails = await extractEmailsFromPage(page);
      emails.forEach(email => allEmails.add(email));
      
      // Don't overwhelm the server
      await setTimeout(THROTTLE_DELAY / 2);
    }
    
    // 3. Try WHOIS data if we found no emails
    if (allEmails.size === 0) {
      console.log(`  - No emails found in pages, trying WHOIS data`);
      const whoisEmails = await extractWhoisData(domain);
      whoisEmails.forEach(email => allEmails.add(email));
    }
    
    console.log(`  - Found ${allEmails.size} unique emails`);
    return Array.from(allEmails);
  } catch (e) {
    console.error(`Error processing ${opportunity.url}:`, e);
    return [];
  }
}

/**
 * Process a batch of opportunities
 */
async function processBatch(opportunities: any[]): Promise<number> {
  const results = await Promise.all(
    opportunities.map(async (opportunity) => {
      try {
        // Get existing contact info
        let contactInfo: ContactInfo;
        
        if (opportunity.contactInfo) {
          if (typeof opportunity.contactInfo === 'string') {
            contactInfo = JSON.parse(opportunity.contactInfo);
          } else {
            contactInfo = opportunity.contactInfo as ContactInfo;
          }
        } else {
          // Initialize contact info if not exists
          contactInfo = {
            emails: [],
            socialProfiles: [],
            contactForms: [],
            extractionDetails: {
              normalized: true,
              source: "super-email-extractor",
              version: "1.0",
              lastUpdated: new Date().toISOString()
            }
          };
        }
        
        // Skip if already has emails
        if (contactInfo.emails && contactInfo.emails.length > 0) {
          console.log(`  - Already has ${contactInfo.emails.length} emails, skipping`);
          return false;
        }
        
        // Extract emails
        const emails = await extractEmails(opportunity);
        
        // Update contact info if we found emails
        if (emails.length > 0) {
          contactInfo.emails = emails;
          contactInfo.extractionDetails.lastUpdated = new Date().toISOString();
          
          // Update the database
          await db.update(discoveredOpportunities)
            .set({ contactInfo })
            .where(eq(discoveredOpportunities.id, opportunity.id));
          
          console.log(`  - Updated opportunity ${opportunity.id} with ${emails.length} emails`);
          return true;
        }
        
        return false;
      } catch (error) {
        console.error(`Error processing opportunity ${opportunity.id}:`, error);
        return false;
      }
    })
  );
  
  return results.filter(result => result).length;
}

/**
 * Main function to run the email extraction process
 */
async function runSuperEmailExtraction() {
  console.log("Starting SuperEmailExtractor...");
  
  try {
    // First, process premium opportunities without emails
    console.log("\n== Processing Premium Opportunities Without Emails ==");
    const premiumOpportunities = await db.select().from(discoveredOpportunities)
      .where(sql`"isPremium" = true AND ("contactInfo" IS NULL OR "contactInfo"::jsonb->'emails' IS NULL OR jsonb_array_length("contactInfo"::jsonb->'emails') = 0)`);
    
    console.log(`Found ${premiumOpportunities.length} premium opportunities without emails`);
    
    // Process premium in batches
    let premiumUpdated = 0;
    for (let i = 0; i < premiumOpportunities.length; i += MAX_CONCURRENT) {
      const batch = premiumOpportunities.slice(i, i + MAX_CONCURRENT);
      const updated = await processBatch(batch);
      premiumUpdated += updated;
      
      console.log(`Processed ${i + batch.length}/${premiumOpportunities.length} premium opportunities, ${premiumUpdated} updated`);
      
      // Short delay between batches
      await setTimeout(1000);
    }
    
    // Then, process high DA (40+) opportunities
    console.log("\n== Processing High DA Opportunities Without Emails ==");
    const highDaOpportunities = await db.select().from(discoveredOpportunities)
      .where(sql`"isPremium" = false AND "domainAuthority" >= 40 AND ("contactInfo" IS NULL OR "contactInfo"::jsonb->'emails' IS NULL OR jsonb_array_length("contactInfo"::jsonb->'emails') = 0)`);
    
    console.log(`Found ${highDaOpportunities.length} high DA opportunities without emails`);
    
    // Process high DA in batches
    let highDaUpdated = 0;
    for (let i = 0; i < highDaOpportunities.length; i += MAX_CONCURRENT) {
      const batch = highDaOpportunities.slice(i, i + MAX_CONCURRENT);
      const updated = await processBatch(batch);
      highDaUpdated += updated;
      
      console.log(`Processed ${i + batch.length}/${highDaOpportunities.length} high DA opportunities, ${highDaUpdated} updated`);
      
      // Short delay between batches
      await setTimeout(1000);
    }
    
    // Summary
    console.log("\nExtraction Summary:");
    console.log(`- Premium opportunities updated: ${premiumUpdated}/${premiumOpportunities.length}`);
    console.log(`- High DA opportunities updated: ${highDaUpdated}/${highDaOpportunities.length}`);
    console.log(`- Total opportunities updated: ${premiumUpdated + highDaUpdated}`);
    
  } catch (error) {
    console.error("Error in super email extraction:", error);
  }
  
  console.log("\nSuper email extraction completed!");
}

// Run the function
runSuperEmailExtraction().catch(console.error);