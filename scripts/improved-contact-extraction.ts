/**
 * Contact Improvement Script
 * 
 * This script focuses on extracting contact information from high-value opportunities
 * that are still missing it, prioritizing premium opportunities to reach
 * our coverage targets (65-80% overall, 90-95% premium)
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq, and, isNull, not } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import * as https from "https";

// Configuration
const MAX_RETRIES = 4;
const THROTTLE_DELAY = 5000; // ms between requests to same domain
const DOMAINS_PROCESSED = new Map<string, number>(); // Track last access time by domain

// User agent rotation to avoid detection
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59"
];

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
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return exponentialDelay + jitter;
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = THROTTLE_DELAY): boolean {
  const now = Date.now();
  const lastAccess = DOMAINS_PROCESSED.get(domain) || 0;
  
  if (now - lastAccess < minTimeBetweenRequests) {
    return true;
  }
  
  // Update last access time
  DOMAINS_PROCESSED.set(domain, now);
  return false;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (error) {
    try {
      const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '');
      return cleanUrl.split('/')[0];
    } catch (error) {
      return url;
    }
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
 * Fetch HTML content with retries and rate limiting
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  const domain = extractDomain(url);
  let retries = 0;
  
  // Throttle requests to the same domain
  if (shouldThrottleDomain(domain)) {
    const waitTime = THROTTLE_DELAY;
    console.log(`Throttling request to ${domain}, waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  while (retries <= maxRetries) {
    try {
      const agent = new https.Agent({
        rejectUnauthorized: false, // Allow self-signed certificates
        timeout: 15000
      });
      
      const response = await axios.get(cleanupUrl(url), {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        timeout: 20000,
        httpsAgent: agent,
        maxRedirects: 5
      });
      
      // Update domain access time after successful request
      DOMAINS_PROCESSED.set(domain, Date.now());
      
      return response.data;
    } catch (error) {
      retries++;
      
      if (retries <= maxRetries) {
        const backoff = calculateBackoff(retries);
        console.log(`Fetch error for ${url}, retrying in ${Math.round(backoff / 1000)}s... (Attempt ${retries} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        // console.error(`Failed to fetch ${url} after ${maxRetries} retries:`, error);
        return null;
      }
    }
  }
  
  return null;
}

/**
 * Extract emails from a webpage with enhanced pattern recognition
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  
  // Remove script and style elements
  $('script, style, noscript').remove();
  
  // Extract plain text content
  const content = $.text();
  
  // Standard email pattern
  const standardEmails = content.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  
  // Look for obfuscated emails (e.g., "email at domain dot com")
  const textPatterns = content.match(/[A-Za-z0-9._%+-]+\s*[@\[\(]at[\)\]]\s*[A-Za-z0-9.-]+\s*[\.[\(]dot[\)\]]\s*[A-Za-z]{2,}/gi) || [];
  
  // Look for emails in mailto: links
  const mailtoEmails: string[] = [];
  $('a[href^="mailto:"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const email = href.replace('mailto:', '').split('?')[0].trim();
    if (email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
      mailtoEmails.push(email);
    }
  });
  
  // Combine all email sources, normalize, and deduplicate
  const allEmails = [...standardEmails, ...mailtoEmails];
  
  // Process the text patterns (e.g. "email at domain dot com") into actual emails
  textPatterns.forEach(pattern => {
    try {
      const processed = pattern
        .replace(/\s*[@\[\(]at[\)\]]\s*/i, '@')
        .replace(/\s*[\.[\(]dot[\)\]]\s*/gi, '.');
      if (processed.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
        allEmails.push(processed);
      }
    } catch (error) {
      // Skip invalid patterns
    }
  });
  
  // Deduplicate and lowercase
  return [...new Set(allEmails.map(email => email.toLowerCase()))];
}

/**
 * Find contact pages by checking common paths
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const domain = extractDomain(baseUrl);
    const url = new URL(cleanupUrl(baseUrl));
    const protocol = url.protocol;
    const host = url.host;
    
    // Common paths where contact information might be found
    const commonPaths = [
      '/contact', '/contact-us', '/about/contact', '/about-us/contact', 
      '/about', '/about-us', '/about/about-us', '/company/about',
      '/company', '/team', '/about/team', '/company/team',
      '/support'
    ];
    
    const contactUrls: string[] = [];
    
    // First check if the homepage has contact info
    contactUrls.push(baseUrl);
    
    // Add all common paths
    for (const path of commonPaths) {
      contactUrls.push(`${protocol}//${host}${path}`);
    }
    
    return contactUrls;
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
    return [baseUrl];
  }
}

/**
 * Extract a specific contact form URL
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    // First, try to find a contact form on the current page
    const html = await fetchHtml(url);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    
    // Look for contact form markers
    const formElements = $('form').filter((_, element) => {
      const formHtml = $(element).html()?.toLowerCase() || '';
      const formAction = $(element).attr('action')?.toLowerCase() || '';
      const formId = $(element).attr('id')?.toLowerCase() || '';
      const formClass = $(element).attr('class')?.toLowerCase() || '';
      
      return (
        formHtml.includes('contact') || 
        formAction.includes('contact') || 
        formId.includes('contact') || 
        formClass.includes('contact') ||
        formHtml.includes('message') || 
        formAction.includes('message') || 
        formId.includes('message') || 
        formClass.includes('message')
      );
    });
    
    if (formElements.length > 0) {
      return url; // Contact form found on this page
    }
    
    // Look for links to contact pages
    const contactLinks = $('a').filter((_, element) => {
      const href = $(element).attr('href') || '';
      const text = $(element).text().toLowerCase();
      
      return (text.includes('contact') || 
              text.includes('get in touch') || 
              href.includes('contact')) && 
             !href.startsWith('mailto:');
    });
    
    if (contactLinks.length > 0) {
      const contactHref = $(contactLinks[0]).attr('href');
      if (contactHref) {
        try {
          // Handle relative URLs
          const contactUrl = new URL(contactHref, url).href;
          return contactUrl;
        } catch (error) {
          return null;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding contact form for ${url}:`, error);
    return null;
  }
}

/**
 * Extract social media profiles from a page with enhanced detection
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string}>> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    
    // Platform matchers with capturing groups for username
    const platformMatchers = [
      { platform: 'twitter', regex: /(?:twitter\.com|x\.com)\/(?!search|share|intent)([^/?&#"']+)/i },
      { platform: 'facebook', regex: /facebook\.com\/(?!sharer|share|dialog)([^/?&#"']+)/i },
      { platform: 'linkedin', regex: /linkedin\.com\/(?:company|in|school)\/([^/?&#"']+)/i },
      { platform: 'instagram', regex: /instagram\.com\/([^/?&#"']+)/i },
      { platform: 'youtube', regex: /youtube\.com\/(?:channel\/|user\/|c\/)?([^/?&#"']+)/i },
      { platform: 'pinterest', regex: /pinterest\.com\/([^/?&#"']+)/i },
      { platform: 'tiktok', regex: /tiktok\.com\/@([^/?&#"']+)/i },
      { platform: 'github', regex: /github\.com\/([^/?&#"']+)/i },
    ];
    
    const results: Array<{platform: string, url: string, username: string}> = [];
    const processedUrls = new Set<string>();
    
    // Extract from all links
    $('a').each((_, element) => {
      let href = $(element).attr('href');
      if (!href) return;
      
      // Handle relative URLs
      try {
        href = new URL(href, url).href;
      } catch (error) {
        return;
      }
      
      // Check each platform pattern
      for (const { platform, regex } of platformMatchers) {
        const match = href.match(regex);
        if (match && match[1]) {
          const username = match[1].replace(/\/$/, ''); // Remove trailing slash
          
          if (!processedUrls.has(`${platform}-${username}`)) {
            processedUrls.add(`${platform}-${username}`);
            results.push({
              platform,
              url: href,
              username
            });
          }
        }
      }
    });
    
    return results;
  } catch (error) {
    console.error(`Error extracting social profiles for ${url}:`, error);
    return [];
  }
}

/**
 * Process an opportunity to extract and update contact information
 */
async function processOpportunity(opportunity: any) {
  console.log(`Processing ${opportunity.domain} (Premium: ${opportunity.isPremium})`);
  
  try {
    const baseUrl = cleanupUrl(opportunity.url || `https://${opportunity.domain}`);
    const domain = extractDomain(baseUrl);
    let contactInfo: any = { emails: [], socialProfiles: [], contactForms: [] };
    
    // Get all pages to check
    const pagesToCheck = await findContactPages(baseUrl);
    
    // Process each page to find contact information
    for (const pageUrl of pagesToCheck) {
      // Extract emails
      const emails = await extractEmailsFromPage(pageUrl);
      contactInfo.emails = [...new Set([...contactInfo.emails, ...emails])];
      
      // Extract social profiles
      const socialProfiles = await extractSocialProfiles(pageUrl);
      // Merge with existing profiles
      const existingPlatforms = new Set(contactInfo.socialProfiles.map((p: any) => p.platform));
      for (const profile of socialProfiles) {
        if (!existingPlatforms.has(profile.platform)) {
          contactInfo.socialProfiles.push(profile);
          existingPlatforms.add(profile.platform);
        }
      }
      
      // Find contact form
      if (contactInfo.contactForms.length === 0) {
        const contactForm = await findContactFormUrl(pageUrl);
        if (contactForm) {
          contactInfo.contactForms.push(contactForm);
        }
      }
      
      // If we have found substantial contact info, we can stop early
      if (contactInfo.emails.length > 0 && 
          contactInfo.socialProfiles.length > 0 && 
          contactInfo.contactForms.length > 0) {
        break;
      }
    }
    
    // Only update if we found something
    if (contactInfo.emails.length > 0 || 
        contactInfo.socialProfiles.length > 0 || 
        contactInfo.contactForms.length > 0) {
      
      // Update the database
      await db.update(discoveredOpportunities)
        .set({ contactInfo: JSON.stringify(contactInfo) })
        .where(eq(discoveredOpportunities.id, opportunity.id));
      
      console.log(`Updated contact info for ${domain}: ${contactInfo.emails.length} emails, ${contactInfo.socialProfiles.length} social profiles, ${contactInfo.contactForms.length} contact forms`);
      return true;
    } else {
      console.log(`No contact info found for ${domain}`);
      return false;
    }
  } catch (error) {
    console.error(`Error processing opportunity ${opportunity.id}:`, error);
    return false;
  }
}

/**
 * Main function to improve contact information coverage
 */
async function improveContactCoverage() {
  console.log("Starting contact information improvement process...");

  try {
    // First, process premium opportunities
    console.log("Processing premium opportunities...");
    const premiumOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(
        and(
          eq(discoveredOpportunities.isPremium, true),
          isNull(discoveredOpportunities.contactInfo)
        )
      )
      .orderBy(discoveredOpportunities.domainAuthority, "desc");
    
    console.log(`Found ${premiumOpportunities.length} premium opportunities without contact info`);
    
    let premiumProcessed = 0;
    for (const opportunity of premiumOpportunities) {
      const result = await processOpportunity(opportunity);
      if (result) premiumProcessed++;
      
      // Sleep between opportunities to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Processed ${premiumProcessed} premium opportunities`);
    
    // Then, process regular opportunities
    console.log("Processing regular opportunities...");
    const regularOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(
        and(
          eq(discoveredOpportunities.isPremium, false),
          isNull(discoveredOpportunities.contactInfo)
        )
      )
      .orderBy(discoveredOpportunities.domainAuthority, "desc")
      .limit(50); // Process a limited batch of regular opportunities
    
    console.log(`Found ${regularOpportunities.length} regular opportunities without contact info (processing 50)`);
    
    let regularProcessed = 0;
    for (const opportunity of regularOpportunities) {
      const result = await processOpportunity(opportunity);
      if (result) regularProcessed++;
      
      // Sleep between opportunities to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`Processed ${regularProcessed} regular opportunities`);
    console.log("Contact information improvement process completed!");
    
  } catch (error) {
    console.error("Error in contact improvement process:", error);
  }
}

// Run the process
improveContactCoverage().catch(console.error);