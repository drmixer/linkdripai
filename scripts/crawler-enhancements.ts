/**
 * Crawler Enhancements for Contact Collection
 * 
 * Improves the existing crawler to better collect contact information
 * during the initial discovery process.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio";
import { setTimeout } from "timers/promises";

// Configuration
const MAX_CONCURRENT = 3;         // Maximum concurrent requests
const THROTTLE_DELAY = 5000;      // Minimum time between requests to same domain
const MAX_RETRIES = 3;            // Maximum retry attempts
const MAX_DEPTH = 2;              // Maximum depth for contact page crawling

// Contact page keywords (expanded list)
const CONTACT_PAGE_KEYWORDS = [
  'contact', 'about', 'team', 'staff', 'people', 'crew', 'company', 
  'connect', 'reach', 'touch', 'email', 'mail', 'write', 'message',
  'kontakt', 'contacto', 'contatto', 'связаться', '联系', 'お問い合わせ'
];

// Common contact page paths (expanded)
const COMMON_CONTACT_PATHS = [
  '/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team', 
  '/company', '/connect', '/get-in-touch', '/reach-us', '/people',
  '/staff', '/directory', '/meet-the-team', '/contact.html', '/contact.php',
  '/about.html', '/about.php', '/about/team', '/about/contact', '/company/team',
  '/company/contact', '/team.html', '/team.php', '/kontakt', '/contacto',
  '/write-to-us', '/email-us', '/say-hello', '/lets-talk', '/feedback'
];

// User agent rotation
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
];

// Domain access tracking for rate limiting
const domainLastAccessed = new Map<string, number>();

// Helper functions
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function shouldThrottleDomain(domain: string): boolean {
  const now = Date.now();
  const lastAccess = domainLastAccessed.get(domain) || 0;
  
  if (now - lastAccess < THROTTLE_DELAY) {
    return true;
  }
  
  domainLastAccessed.set(domain, now);
  return false;
}

function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (e) {
    return url;
  }
}

function cleanupUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch (e) {
    return url;
  }
}

/**
 * Improved fetch with error handling and retries
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
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      return response.data;
    } catch (error) {
      if (retry < maxRetries - 1) {
        // Exponential backoff
        const delay = Math.pow(2, retry) * 1000;
        await setTimeout(delay);
      }
    }
  }
  
  return null;
}

/**
 * Find contact pages through intelligent crawling
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  const visitedUrls = new Set<string>();
  const contactPages = new Set<string>();
  const queue: Array<{url: string, depth: number}> = [{url: baseUrl, depth: 0}];
  
  const domain = extractDomain(baseUrl);
  
  while (queue.length > 0 && contactPages.size < 5) {
    const {url, depth} = queue.shift()!;
    
    if (visitedUrls.has(url) || depth > MAX_DEPTH) {
      continue;
    }
    
    visitedUrls.add(url);
    
    try {
      // Check if this might be a contact page based on URL
      const lowerUrl = url.toLowerCase();
      const isLikelyContactPage = CONTACT_PAGE_KEYWORDS.some(keyword => 
        lowerUrl.includes(keyword));
      
      const html = await fetchHtml(url);
      if (!html) continue;
      
      const $ = cheerio.load(html);
      
      // Add to contact pages if it looks like a contact page
      if (isLikelyContactPage || containsContactInfo($)) {
        contactPages.add(url);
      }
      
      // Only continue crawling if we're not at max depth
      if (depth < MAX_DEPTH) {
        // Find links to potential contact pages
        $('a').each((_, element) => {
          const href = $(element).attr('href');
          if (!href) return;
          
          try {
            // Make absolute URL
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = new URL(href, baseUrl).toString();
            } else if (!href.includes('://')) {
              fullUrl = new URL(href, baseUrl).toString();
            }
            
            // Skip external domains and non-HTTP protocols
            if (!extractDomain(fullUrl).includes(domain) || 
                !(fullUrl.startsWith('http://') || fullUrl.startsWith('https://'))) {
              return;
            }
            
            // Prioritize potential contact pages
            const linkText = $(element).text().toLowerCase();
            const isContactLink = CONTACT_PAGE_KEYWORDS.some(keyword => 
              linkText.includes(keyword) || fullUrl.toLowerCase().includes(keyword));
            
            if (isContactLink) {
              queue.unshift({url: fullUrl, depth: depth + 1});
            } else {
              queue.push({url: fullUrl, depth: depth + 1});
            }
          } catch (e) {
            // Skip invalid URLs
          }
        });
      }
      
      // Small delay to avoid overloading the server
      await setTimeout(500);
      
    } catch (e) {
      console.error(`Error processing ${url}:`, e);
    }
  }
  
  // Also check common contact page paths
  for (const path of COMMON_CONTACT_PATHS) {
    try {
      const potentialUrl = new URL(path, baseUrl).toString();
      if (visitedUrls.has(potentialUrl)) continue;
      
      visitedUrls.add(potentialUrl);
      
      const html = await fetchHtml(potentialUrl);
      if (html) {
        const $ = cheerio.load(html);
        if (containsContactInfo($)) {
          contactPages.add(potentialUrl);
        }
      }
      
      // Small delay between requests
      await setTimeout(300);
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  return Array.from(contactPages);
}

/**
 * Check if a page contains contact information
 */
function containsContactInfo($: cheerio.CheerioAPI): boolean {
  // Check for common contact page indicators
  const bodyText = $('body').text().toLowerCase();
  
  // Check for contact keywords in headings
  let hasContactHeadings = false;
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (CONTACT_PAGE_KEYWORDS.some(keyword => text.includes(keyword))) {
      hasContactHeadings = true;
      return false; // Break the loop
    }
  });
  
  // Check for email addresses
  const hasEmails = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(bodyText);
  
  // Check for contact forms
  const hasContactForm = $('form').length > 0 && 
    (bodyText.includes('contact') || bodyText.includes('message') || 
     bodyText.includes('email') || bodyText.includes('send'));
  
  // Check for mailto links
  const hasMailtoLinks = $('a[href^="mailto:"]').length > 0;
  
  // Check for phone numbers
  const hasPhoneNumbers = /(\+\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/.test(bodyText);
  
  return hasContactHeadings || hasEmails || hasContactForm || hasMailtoLinks || hasPhoneNumbers;
}

/**
 * Extract emails from a page with advanced methods
 */
async function extractEmails(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const emails = new Set<string>();
  const $ = cheerio.load(html);
  
  // Method 1: Standard email regex
  const bodyText = $('body').text();
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = bodyText.match(emailRegex) || [];
  matches.forEach(email => emails.add(email.toLowerCase()));
  
  // Method 2: Check mailto links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email.includes('@') && email.includes('.')) {
        emails.add(email);
      }
    }
  });
  
  // Method 3: Look in data attributes and other attributes
  $('*').each((_, el) => {
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
  
  // Method 4: Look for obfuscated emails in scripts
  $('script').each((_, el) => {
    const scriptContent = $(el).html() || '';
    
    // Look for common email obfuscation patterns
    const obfuscatedPatterns = [
      // Pattern: parts joined with +
      /['"]([^'"]+)['"]\s*\+\s*['"]@['"]\s*\+\s*['"]([^'"]+)['"]/g,
      // Pattern: character codes
      /String\.fromCharCode\(([^)]+)\)/g
    ];
    
    for (const pattern of obfuscatedPatterns) {
      const matches = scriptContent.match(pattern);
      if (matches) {
        // Try to deobfuscate and check if it's an email
        matches.forEach(match => {
          try {
            // For character codes
            if (match.includes('fromCharCode')) {
              const numbers = match.match(/\d+/g);
              if (numbers) {
                const decodedText = numbers.map(n => String.fromCharCode(parseInt(n))).join('');
                const emailMatch = decodedText.match(emailRegex);
                if (emailMatch) {
                  emailMatch.forEach(email => emails.add(email.toLowerCase()));
                }
              }
            } 
            // For concatenated strings
            else {
              const parts = match.match(/['"]([^'"]+)['"]/g);
              if (parts) {
                const cleaned = parts.map(p => p.replace(/['"]/g, '')).join('');
                if (cleaned.includes('@') && cleaned.includes('.')) {
                  emails.add(cleaned.toLowerCase());
                }
              }
            }
          } catch (e) {
            // Ignore errors in deobfuscation
          }
        });
      }
    }
  });
  
  // Filter out common false positives
  return Array.from(emails).filter(email => {
    return !email.includes('example.com') && 
           !email.includes('domain.com') &&
           !email.includes('yoursite.com') &&
           email.length < 50; // Skip very long emails (likely errors)
  });
}

/**
 * Extract social profiles from a page
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string}>> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const socialProfiles = new Set<string>();
  const profiles: Array<{platform: string, url: string, username: string}> = [];
  
  const $ = cheerio.load(html);
  
  // Common social media domains
  const socialDomains = [
    { domain: 'twitter.com', platform: 'Twitter' },
    { domain: 'x.com', platform: 'Twitter' },
    { domain: 'facebook.com', platform: 'Facebook' },
    { domain: 'linkedin.com', platform: 'LinkedIn' },
    { domain: 'instagram.com', platform: 'Instagram' },
    { domain: 'youtube.com', platform: 'YouTube' },
    { domain: 'pinterest.com', platform: 'Pinterest' },
    { domain: 'github.com', platform: 'GitHub' },
    { domain: 'medium.com', platform: 'Medium' },
    { domain: 'reddit.com', platform: 'Reddit' },
    { domain: 'tiktok.com', platform: 'TikTok' }
  ];
  
  // Find social links
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    
    // Check if this is a social media link
    for (const { domain, platform } of socialDomains) {
      if (href.includes(domain)) {
        // Skip if we already found this URL
        if (socialProfiles.has(href)) continue;
        
        socialProfiles.add(href);
        
        // Extract username from URL
        let username = '';
        try {
          const urlObj = new URL(href.startsWith('http') ? href : `https://${href}`);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          if (pathParts.length > 0) {
            username = pathParts[0];
          }
        } catch (e) {
          // Use a default format if we can't parse the URL
          username = href.split('/').pop() || '';
        }
        
        profiles.push({
          platform,
          url: href.startsWith('http') ? href : `https://${href}`,
          username
        });
        
        break;
      }
    }
  });
  
  return profiles;
}

/**
 * Find contact forms on a page
 */
async function findContactForms(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const contactForms = new Set<string>();
  const $ = cheerio.load(html);
  
  // Check for forms on the current page
  $('form').each((_, el) => {
    const formId = $(el).attr('id') || '';
    const formClass = $(el).attr('class') || '';
    const formAction = $(el).attr('action') || '';
    const formHtml = $(el).html() || '';
    
    // Check if it seems like a contact form
    const isContactForm = 
      formId.toLowerCase().includes('contact') ||
      formClass.toLowerCase().includes('contact') ||
      formAction.toLowerCase().includes('contact') ||
      formHtml.toLowerCase().includes('name') && 
      formHtml.toLowerCase().includes('email') && 
      (formHtml.toLowerCase().includes('message') || formHtml.toLowerCase().includes('comment'));
    
    if (isContactForm) {
      contactForms.add(url);
    }
  });
  
  // Check for links to contact forms
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().toLowerCase();
    
    if (href && (
      text.includes('contact') || 
      text.includes('message') || 
      text.includes('reach out') ||
      text.includes('get in touch')
    )) {
      try {
        // Make absolute URL
        let formUrl = href;
        if (href.startsWith('/')) {
          formUrl = new URL(href, url).toString();
        } else if (!href.includes('://')) {
          formUrl = new URL(href, url).toString();
        }
        
        // Only add if it's the same domain
        if (extractDomain(formUrl).includes(extractDomain(url))) {
          contactForms.add(formUrl);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
  });
  
  return Array.from(contactForms);
}

/**
 * Process a batch of opportunities to enhance contact information
 */
async function processBatch(opportunities: any[]): Promise<number> {
  const results = await Promise.all(
    opportunities.map(async (opportunity) => {
      try {
        console.log(`Processing ${opportunity.url} (ID: ${opportunity.id})`);
        
        // Skip if already has sufficient contact info
        if (opportunity.contactInfo) {
          let contactInfo: any;
          if (typeof opportunity.contactInfo === 'string') {
            contactInfo = JSON.parse(opportunity.contactInfo);
          } else {
            contactInfo = opportunity.contactInfo;
          }
          
          // If it already has emails and is fully normalized, skip
          if (contactInfo.emails?.length > 0 && 
              contactInfo.extractionDetails?.normalized === true) {
            console.log(`  - Already has comprehensive contact info, skipping`);
            return false;
          }
        }
        
        // Initialize contact info structure if not exists
        let contactInfo = opportunity.contactInfo ? 
          (typeof opportunity.contactInfo === 'string' ? 
            JSON.parse(opportunity.contactInfo) : opportunity.contactInfo) : {
          emails: [],
          socialProfiles: [],
          contactForms: [],
          extractionDetails: {
            normalized: true,
            source: "enhanced-crawler",
            version: "1.0",
            lastUpdated: new Date().toISOString()
          }
        };
        
        // Find potential contact pages
        const contactPages = await findContactPages(opportunity.url);
        console.log(`  - Found ${contactPages.length} potential contact pages`);
        
        // Process each contact page
        for (const page of contactPages) {
          // Extract emails
          const emails = await extractEmails(page);
          if (emails.length > 0) {
            console.log(`  - Found ${emails.length} emails on ${page}`);
            // Merge with existing emails
            const existingEmails = new Set(contactInfo.emails || []);
            emails.forEach(email => existingEmails.add(email));
            contactInfo.emails = Array.from(existingEmails);
          }
          
          // Extract social profiles
          const socialProfiles = await extractSocialProfiles(page);
          if (socialProfiles.length > 0) {
            console.log(`  - Found ${socialProfiles.length} social profiles on ${page}`);
            // Merge with existing profiles
            const existingProfiles = new Map();
            (contactInfo.socialProfiles || []).forEach((profile: any) => {
              existingProfiles.set(profile.url, profile);
            });
            
            socialProfiles.forEach(profile => {
              existingProfiles.set(profile.url, profile);
            });
            
            contactInfo.socialProfiles = Array.from(existingProfiles.values());
          }
          
          // Find contact forms
          const contactForms = await findContactForms(page);
          if (contactForms.length > 0) {
            console.log(`  - Found ${contactForms.length} contact forms on ${page}`);
            // Merge with existing forms
            const existingForms = new Set(contactInfo.contactForms || []);
            contactForms.forEach(form => existingForms.add(form));
            contactInfo.contactForms = Array.from(existingForms);
          }
          
          // Small delay between pages
          await setTimeout(500);
        }
        
        // Update extraction details
        contactInfo.extractionDetails = {
          normalized: true,
          source: "enhanced-crawler",
          version: "1.0",
          lastUpdated: new Date().toISOString()
        };
        
        // Update the database
        await db.update(discoveredOpportunities)
          .set({ contactInfo })
          .where(eq(discoveredOpportunities.id, opportunity.id));
        
        console.log(`  - Updated contact info for opportunity ${opportunity.id}`);
        
        // Return true if we made any updates
        return true;
      } catch (error) {
        console.error(`Error processing opportunity ${opportunity.id}:`, error);
        return false;
      }
    })
  );
  
  return results.filter(result => result).length;
}

/**
 * Main function to enhance contact information during crawling
 */
export async function enhanceCrawlerContactCollection() {
  console.log("Starting crawler enhancements for contact collection...");
  
  try {
    // First process premium opportunities
    console.log("\n== Processing Premium Opportunities ==");
    const premiumOpportunities = await db.select().from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.isPremium, true));
    
    console.log(`Found ${premiumOpportunities.length} premium opportunities`);
    
    // Process premium in batches
    let premiumUpdated = 0;
    for (let i = 0; i < premiumOpportunities.length; i += MAX_CONCURRENT) {
      const batch = premiumOpportunities.slice(i, i + MAX_CONCURRENT);
      const updated = await processBatch(batch);
      premiumUpdated += updated;
      
      console.log(`Processed ${i + batch.length}/${premiumOpportunities.length} premium opportunities, ${premiumUpdated} updated`);
      
      // Small delay between batches
      await setTimeout(1000);
    }
    
    // Then process high DA (40+) opportunities
    console.log("\n== Processing High DA Opportunities ==");
    const highDaOpportunities = await db.select().from(discoveredOpportunities)
      .where(sql`"isPremium" = false AND "domainAuthority" >= 40`);
    
    console.log(`Found ${highDaOpportunities.length} high DA opportunities`);
    
    // Process high DA in batches
    let highDaUpdated = 0;
    for (let i = 0; i < highDaOpportunities.length; i += MAX_CONCURRENT) {
      const batch = highDaOpportunities.slice(i, i + MAX_CONCURRENT);
      const updated = await processBatch(batch);
      highDaUpdated += updated;
      
      console.log(`Processed ${i + batch.length}/${highDaOpportunities.length} high DA opportunities, ${highDaUpdated} updated`);
      
      // Small delay between batches
      await setTimeout(1000);
    }
    
    // Summary
    console.log("\nEnhancement Summary:");
    console.log(`- Premium opportunities updated: ${premiumUpdated}/${premiumOpportunities.length}`);
    console.log(`- High DA opportunities updated: ${highDaUpdated}/${highDaOpportunities.length}`);
    console.log(`- Total opportunities updated: ${premiumUpdated + highDaUpdated}`);
    
  } catch (error) {
    console.error("Error enhancing contact collection:", error);
  }
  
  console.log("\nCrawler enhancements completed!");
}

// Export the functions for use in other modules
export {
  findContactPages,
  extractEmails,
  extractSocialProfiles,
  findContactForms
};