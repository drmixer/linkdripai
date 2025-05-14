/**
 * Focus Premium Contact Extractor
 * 
 * This script targets the remaining premium opportunities without contact
 * information, prioritizing them for extraction to reach 100% coverage.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio";
import * as whois from "whois-json";
import * as fs from "fs";
import * as path from "path";

// Constants for extraction control
const MAX_RETRIES = 5;
const THROTTLE_DELAY = 1500; // ms between requests to same domain
const DOMAIN_REQUEST_TIMES: { [domain: string]: number } = {};
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:99.0) Gecko/20100101 Firefox/99.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36",
];

// Contact info structure
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
 * Calculate exponential backoff for retries
 */
function calculateBackoff(retry: number): number {
  const baseDelay = 1000;
  const maxDelay = 10000;
  const delay = Math.min(maxDelay, baseDelay * Math.pow(2, retry));
  // Add jitter to avoid thundering herd
  return delay * (0.5 + Math.random());
}

/**
 * Extract root domain from a domain name
 */
function extractRootDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  
  // Check for common TLDs with 2 parts (co.uk, com.au, etc.)
  const secondLevelDomains = ["co", "com", "org", "net", "ac", "gov", "edu"];
  const tld = parts[parts.length - 1];
  const potentialSLD = parts[parts.length - 2];
  
  if (secondLevelDomains.includes(potentialSLD) && parts.length > 2) {
    return parts[parts.length - 3] + "." + potentialSLD + "." + tld;
  }
  
  return parts[parts.length - 2] + "." + parts[parts.length - 1];
}

/**
 * Check if we should throttle requests to avoid rate limiting
 */
function shouldThrottleDomain(domain: string): boolean {
  const rootDomain = extractRootDomain(domain);
  const now = Date.now();
  const lastRequestTime = DOMAIN_REQUEST_TIMES[rootDomain] || 0;
  
  if (now - lastRequestTime < THROTTLE_DELAY) {
    return true;
  }
  
  DOMAIN_REQUEST_TIMES[rootDomain] = now;
  return false;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

/**
 * Clean URL for consistent format
 */
function cleanupUrl(url: string): string {
  if (!url.startsWith("http")) {
    url = "https://" + url;
  }
  return url;
}

/**
 * Fetch HTML content with retries
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const domain = extractDomain(url);
      
      // Throttle requests to the same domain
      if (shouldThrottleDomain(domain)) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
      }
      
      const response = await axios.get(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          "Accept": "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 15000,
        validateStatus: status => status < 400,
      });
      
      if (response.status === 200 && response.data) {
        return response.data;
      }
      
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.error(`Failed to fetch ${url} after ${maxRetries} attempts`);
        return null;
      }
      
      const backoff = calculateBackoff(retryCount);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  
  return null;
}

/**
 * Extract emails from text
 */
function extractEmailsFromText(text: string): string[] {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const matches = text.match(emailRegex) || [];
  return [...new Set(matches)];
}

/**
 * Extract emails from a webpage
 */
async function extractEmailsFromPage(url: string, domain: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    
    // Remove script and style elements to avoid false positives
    $("script, style").remove();
    
    const bodyText = $("body").text();
    let emails = extractEmailsFromText(bodyText);
    
    // Check for contact-specific links
    $("a[href^='mailto:']").each((_, element) => {
      const href = $(element).attr("href") || "";
      const email = href.replace("mailto:", "").split("?")[0].trim();
      if (email && email.includes("@")) {
        emails.push(email);
      }
    });
    
    // Filter out common "noise" emails
    const domainRoot = extractRootDomain(domain).replace(/^www\./, "");
    
    // Prioritize emails that match the domain
    return [...new Set(emails)].filter(email => {
      // Filter out common service emails unless they match the root domain
      const isFromSameDomain = email.endsWith("@" + domainRoot);
      const isCommonServiceEmail = email.includes("example.com") || 
                                  email.includes("yourdomain") ||
                                  email.includes("domain.com");
      
      return isFromSameDomain || !isCommonServiceEmail;
    });
  } catch (error) {
    console.error(`Error extracting emails from ${url}:`, error);
    return [];
  }
}

/**
 * Find contact pages for a website
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const contactPaths = [
      "/contact", 
      "/contact-us", 
      "/about", 
      "/about-us", 
      "/team",
      "/support",
      "/help"
    ];
    
    const html = await fetchHtml(baseUrl);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const contactPages: string[] = [];
    
    // Look for contact links in the navigation
    $("a").each((_, element) => {
      const href = $(element).attr("href") || "";
      const text = $(element).text().toLowerCase();
      
      if (text.includes("contact") || 
          text.includes("get in touch") || 
          text.includes("reach us") ||
          text.includes("about us") ||
          text.includes("team")) {
        try {
          const url = new URL(href, baseUrl).href;
          contactPages.push(url);
        } catch (e) {
          // Invalid URL, skip
        }
      }
    });
    
    // Also check common contact paths
    for (const path of contactPaths) {
      try {
        contactPages.push(new URL(path, baseUrl).href);
      } catch (e) {
        // Invalid URL, skip
      }
    }
    
    return [...new Set(contactPages)];
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
    return [];
  }
}

/**
 * Find contact form URLs
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    
    // Check for forms
    const hasForm = $("form").length > 0;
    
    // Look for contact-related words in the content
    const pageText = $("body").text().toLowerCase();
    const hasContactKeywords = 
      pageText.includes("contact") || 
      pageText.includes("message") || 
      pageText.includes("get in touch") ||
      pageText.includes("reach out");
    
    // If the page has both a form and contact keywords, it's likely a contact form
    if (hasForm && hasContactKeywords) {
      return url;
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding contact form for ${url}:`, error);
    return null;
  }
}

/**
 * Extract social media profiles
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string}>> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const profiles: Array<{platform: string, url: string, username: string}> = [];
    
    // Define patterns for social media URLs
    const socialPatterns = [
      { platform: "twitter", regex: /twitter\.com\/([^\/\?"]+)/ },
      { platform: "facebook", regex: /facebook\.com\/([^\/\?"]+)/ },
      { platform: "linkedin", regex: /linkedin\.com\/(?:company|in)\/([^\/\?"]+)/ },
      { platform: "instagram", regex: /instagram\.com\/([^\/\?"]+)/ },
      { platform: "youtube", regex: /youtube\.com\/(?:channel|user)\/([^\/\?"]+)/ },
      { platform: "pinterest", regex: /pinterest\.com\/([^\/\?"]+)/ },
    ];
    
    // Extract from link tags
    $("a").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      
      for (const { platform, regex } of socialPatterns) {
        const match = href.match(regex);
        if (match && match[1]) {
          const username = match[1];
          profiles.push({
            platform,
            url: href,
            username
          });
          break;
        }
      }
    });
    
    return [...new Set(profiles.map(p => JSON.stringify(p)))].map(p => JSON.parse(p));
  } catch (error) {
    console.error(`Error extracting social profiles from ${url}:`, error);
    return [];
  }
}

/**
 * Extract WHOIS information
 */
async function extractWhoisData(domain: string): Promise<{
  emails: string[],
  organization?: string,
  registrar?: string
}> {
  try {
    // Clean domain - remove www and any protocol
    const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "");
    
    // Look up WHOIS data
    const data = await whois(cleanDomain);
    
    const emails: string[] = [];
    
    // Check various fields where emails might appear
    const emailFields = [
      'administrativeContactEmail',
      'registrantEmail', 
      'techContactEmail',
      'contactEmail',
      'email'
    ];
    
    for (const field of emailFields) {
      if (data[field] && typeof data[field] === 'string') {
        const email = data[field].trim();
        if (email.includes('@') && !emails.includes(email)) {
          emails.push(email);
        }
      }
    }
    
    // Also collect organization name if available
    const organization = data.registrantOrganization || 
                        data.organization || 
                        data.org;
    
    // Get registrar info
    const registrar = data.registrar;
    
    return {
      emails,
      organization: organization,
      registrar: registrar
    };
  } catch (error) {
    console.error(`Error extracting WHOIS data for ${domain}:`, error);
    return { emails: [] };
  }
}

/**
 * Process a single premium opportunity to extract contact information
 */
async function processOpportunity(opportunity: any): Promise<boolean> {
  console.log(`\nProcessing premium opportunity: ${opportunity.domain} (ID: ${opportunity.id})`);
  
  try {
    let url = opportunity.url || `https://${opportunity.domain}`;
    url = cleanupUrl(url);
    const domain = extractDomain(url);
    
    // Initialize contact info structure
    const contactInfo: ContactInfo = {
      emails: [],
      socialProfiles: [],
      contactForms: [],
      extractionDetails: {
        normalized: true,
        source: "focus-premium-extractor",
        version: "1.0",
        lastUpdated: new Date().toISOString()
      }
    };
    
    // 1. Extract emails from the main page
    console.log(`  - Checking main page for emails: ${url}`);
    const mainPageEmails = await extractEmailsFromPage(url, domain);
    contactInfo.emails.push(...mainPageEmails);
    
    // 2. Find and check contact pages
    console.log(`  - Looking for contact pages`);
    const contactPages = await findContactPages(url);
    for (const contactPage of contactPages) {
      console.log(`  - Checking contact page: ${contactPage}`);
      const contactPageEmails = await extractEmailsFromPage(contactPage, domain);
      contactInfo.emails.push(...contactPageEmails);
      
      // Check for contact forms on these pages
      const contactFormUrl = await findContactFormUrl(contactPage);
      if (contactFormUrl) {
        contactInfo.contactForms.push(contactFormUrl);
      }
    }
    
    // 3. Extract social profiles
    console.log(`  - Extracting social profiles`);
    const socialProfiles = await extractSocialProfiles(url);
    contactInfo.socialProfiles.push(...socialProfiles);
    
    // 4. Try WHOIS data as a last resort if we don't have emails
    if (contactInfo.emails.length === 0) {
      console.log(`  - No emails found, trying WHOIS data for ${domain}`);
      const whoisData = await extractWhoisData(domain);
      contactInfo.emails.push(...whoisData.emails);
    }
    
    // Deduplicate all arrays
    contactInfo.emails = [...new Set(contactInfo.emails)];
    contactInfo.contactForms = [...new Set(contactInfo.contactForms)];
    
    // If we have contact information, update the database
    const hasContact = 
      contactInfo.emails.length > 0 || 
      contactInfo.socialProfiles.length > 0 || 
      contactInfo.contactForms.length > 0;
    
    if (hasContact) {
      console.log(`  - Found contact info: ${contactInfo.emails.length} emails, ${contactInfo.socialProfiles.length} social profiles, ${contactInfo.contactForms.length} contact forms`);
      
      await db.update(discoveredOpportunities)
        .set({ contactInfo: JSON.stringify(contactInfo) })
        .where(sql`id = ${opportunity.id}`);
      
      return true;
    } else {
      console.log(`  - No contact information found for ${domain}`);
      return false;
    }
    
  } catch (error) {
    console.error(`Error processing opportunity ${opportunity.id}:`, error);
    return false;
  }
}

/**
 * Main function to extract contact information for premium opportunities
 */
async function focusPremiumContactExtraction() {
  console.log("Starting focused premium contact extraction...");
  
  try {
    // Get all premium opportunities without contact info
    const premiumOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"isPremium" = true AND "contactInfo" IS NULL`);
    
    console.log(`Found ${premiumOpportunities.length} premium opportunities without contact information`);
    
    let successCount = 0;
    
    // Process each opportunity
    for (const opportunity of premiumOpportunities) {
      const success = await processOpportunity(opportunity);
      if (success) successCount++;
      
      // Add a small delay between opportunities
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\nExtraction Results:`);
    console.log(`- Premium opportunities processed: ${premiumOpportunities.length}`);
    console.log(`- Successfully extracted contact info: ${successCount}`);
    console.log(`- Success rate: ${((successCount / Math.max(premiumOpportunities.length, 1)) * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error("Error in focused premium contact extraction:", error);
  }
  
  console.log("\nFocused premium contact extraction completed!");
}

// Run the function
focusPremiumContactExtraction().catch(console.error);