/**
 * Email-Focused Contact Extractor
 * 
 * This script specifically targets email extraction for opportunities,
 * using more aggressive techniques to uncover emails that might be
 * hidden or obfuscated on websites.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio";
import * as whois from "whois-json";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Constants for extraction control
const MAX_RETRIES = 5;
const THROTTLE_DELAY = 2000; // ms between requests to same domain
const DOMAIN_REQUEST_TIMES: { [domain: string]: number } = {};
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:99.0) Gecko/20100101 Firefox/99.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.60 Safari/537.36",
];

// Additional paths to check specifically for contact emails
const CONTACT_PATHS = [
  "/contact", 
  "/contact-us", 
  "/about", 
  "/about-us", 
  "/team",
  "/support",
  "/help",
  "/write-for-us",
  "/contribute",
  "/advertise",
  "/advertising",
  "/work-with-us",
  "/partners",
  "/guest-post",
  "/guest-posting",
  "/guest-blogging",
  "/sponsored-post",
  "/sponsored-content",
  "/authors",
  "/editorial-team",
  "/editorial"
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
 * Extract emails from text with advanced pattern recognition
 */
function extractEmailsFromText(text: string): string[] {
  // Standard email regex
  const standardRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  
  // Advanced regex for emails with prefix text like "Email: user@example.com"
  const prefixRegex = /(?:email|contact|mail|e-mail|reach)(?:\s+(?:us|me|them|at|to))?\s*(?::|at|is|=)\s*([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  
  // Obfuscated email patterns with "at" and "dot" spelled out
  const obfuscatedRegex = /([a-zA-Z0-9._-]+)(?:\s+(?:at|@)\s+)([a-zA-Z0-9._-]+)(?:\s+(?:dot|\.)\s+)([a-zA-Z0-9]{2,})/gi;
  
  // Collect emails from all patterns
  const standardMatches = text.match(standardRegex) || [];
  
  const prefixMatches: string[] = [];
  let prefixMatch;
  while ((prefixMatch = prefixRegex.exec(text)) !== null) {
    if (prefixMatch[1]) {
      prefixMatches.push(prefixMatch[1]);
    }
  }
  
  const obfuscatedMatches: string[] = [];
  let obfuscatedMatch;
  while ((obfuscatedMatch = obfuscatedRegex.exec(text)) !== null) {
    if (obfuscatedMatch[1] && obfuscatedMatch[2] && obfuscatedMatch[3]) {
      obfuscatedMatches.push(`${obfuscatedMatch[1]}@${obfuscatedMatch[2]}.${obfuscatedMatch[3]}`);
    }
  }
  
  // Combine all matches and remove duplicates
  return [...new Set([...standardMatches, ...prefixMatches, ...obfuscatedMatches])];
}

/**
 * Look for email obfuscation using JavaScript
 */
function lookForObfuscatedEmails(html: string): string[] {
  const obfuscatedEmails: string[] = [];
  
  // Look for common email obfuscation patterns in JavaScript
  const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  for (const scriptBlock of scriptBlocks) {
    // Common patterns:
    
    // 1. Character code concatenation: String.fromCharCode(...)
    const charCodeMatches = scriptBlock.match(/String\.fromCharCode\(([0-9,\s]+)\)/gi) || [];
    for (const match of charCodeMatches) {
      try {
        const codes = match.match(/\(([0-9,\s]+)\)/)?.[1] || '';
        const chars = codes.split(',').map(c => String.fromCharCode(parseInt(c.trim(), 10)));
        const text = chars.join('');
        const emails = extractEmailsFromText(text);
        obfuscatedEmails.push(...emails);
      } catch (e) {
        // Skip errors in parsing
      }
    }
    
    // 2. Array joining: ['user','@','example','.','com'].join('')
    const arrayJoinMatches = scriptBlock.match(/\[['"][^'"\]]+['"],['"][^'"\]]+['"].*?\]\.join\(['"]?['"]?\)/gi) || [];
    for (const match of arrayJoinMatches) {
      try {
        // Extract the array parts
        const arrayParts = match.match(/\[(.*?)\]/)?.[1] || '';
        // Simple parsing to extract the strings (will only work for simple cases)
        const parts = arrayParts.split(',').map(p => p.trim().replace(/^['"]|['"]$/g, ''));
        const text = parts.join('');
        const emails = extractEmailsFromText(text);
        obfuscatedEmails.push(...emails);
      } catch (e) {
        // Skip errors in parsing
      }
    }
    
    // 3. Look for hex or unicode encoded strings
    const hexMatches = scriptBlock.match(/\\x[0-9a-f]{2}/gi) || [];
    const unicodeMatches = scriptBlock.match(/\\u[0-9a-f]{4}/gi) || [];
    
    if (hexMatches.length > 10 || unicodeMatches.length > 10) {
      // Many hex or unicode escapes could be an obfuscated email
      try {
        // Try to unescape and look for emails
        const decoded = eval(`"${scriptBlock.replace(/</g, '\\x3C')}"`);
        const emails = extractEmailsFromText(decoded);
        obfuscatedEmails.push(...emails);
      } catch (e) {
        // Skip errors in parsing
      }
    }
  }
  
  return [...new Set(obfuscatedEmails)];
}

/**
 * Look for emails in HTML attributes
 */
function extractEmailsFromAttributes($: cheerio.CheerioAPI): string[] {
  const attributeEmails: string[] = [];
  
  // Check data attributes that might contain emails
  $("[data-email]").each((_, el) => {
    const email = $(el).attr("data-email");
    if (email && email.includes("@")) attributeEmails.push(email);
  });
  
  // Check custom attributes like data-contact, data-mail, etc.
  const dataAttrs = ["data-contact", "data-mail", "data-e-mail", "data-address"];
  for (const attr of dataAttrs) {
    $(`[${attr}]`).each((_, el) => {
      const value = $(el).attr(attr);
      if (value) {
        const emails = extractEmailsFromText(value);
        attributeEmails.push(...emails);
      }
    });
  }
  
  // Check for mailto: links with obfuscation
  $("a[href^='#']").each((_, el) => {
    const $el = $(el);
    const hasOnclick = $el.attr("onclick") || "";
    const hasDataHref = $el.attr("data-href") || "";
    
    // Check for onclick handlers or data-href attributes that might contain emails
    if (hasOnclick.includes("mailto:") || hasDataHref.includes("mailto:")) {
      const combined = hasOnclick + " " + hasDataHref;
      const matches = combined.match(/mailto:([^'"\\s&?]+)/i);
      if (matches && matches[1] && matches[1].includes("@")) {
        attributeEmails.push(matches[1]);
      }
    }
  });
  
  return [...new Set(attributeEmails)];
}

/**
 * Extract emails from a webpage with enhanced detection
 */
async function extractEmailsFromPage(url: string, domain: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    
    // Remove script and style elements to avoid false positives
    const scriptContents: string[] = [];
    $("script").each((_, el) => {
      scriptContents.push($(el).html() || "");
    });
    $("script, style").remove();
    
    const bodyText = $("body").text();
    let emails: string[] = [];
    
    // Standard email extraction from visible text
    emails = extractEmailsFromText(bodyText);
    
    // Check for emails in HTML attributes
    const attrEmails = extractEmailsFromAttributes($);
    emails = [...emails, ...attrEmails];
    
    // Check for obfuscated emails in JavaScript
    const scriptHtml = scriptContents.join("\n");
    const obfuscatedEmails = lookForObfuscatedEmails(scriptHtml);
    emails = [...emails, ...obfuscatedEmails];
    
    // Check for mailto: links
    $("a[href^='mailto:']").each((_, element) => {
      const href = $(element).attr("href") || "";
      const email = href.replace("mailto:", "").split("?")[0].trim();
      if (email && email.includes("@") && !emails.includes(email)) {
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
 * Find all contact pages for a website, checking many possible locations
 */
async function findAllContactPages(baseUrl: string): Promise<string[]> {
  try {
    const url = new URL(baseUrl);
    const protocol = url.protocol;
    const host = url.host;
    
    const contactUrls: string[] = [];
    
    // Add all the common contact paths
    for (const path of CONTACT_PATHS) {
      contactUrls.push(`${protocol}//${host}${path}`);
    }
    
    // Try to find contact links from the main page
    const html = await fetchHtml(baseUrl);
    if (html) {
      const $ = cheerio.load(html);
      
      // Look for contact-related links
      $("a").each((_, element) => {
        const href = $(element).attr("href");
        const text = $(element).text().toLowerCase();
        
        if (href && (
            text.includes("contact") || 
            text.includes("email") || 
            text.includes("reach") || 
            text.includes("write") ||
            text.includes("about") ||
            text.includes("team") ||
            text.includes("support") ||
            text.includes("contribute")
          )) {
          try {
            const absoluteUrl = new URL(href, baseUrl).href;
            contactUrls.push(absoluteUrl);
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });
    }
    
    return [...new Set(contactUrls)];
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
    return [];
  }
}

/**
 * Extract WHOIS information with thorough email checking
 */
async function extractWhoisData(domain: string): Promise<string[]> {
  try {
    // Clean domain - remove www and any protocol
    const cleanDomain = domain.replace(/^www\./, "").replace(/^https?:\/\//, "");
    
    // Look up WHOIS data
    const data = await whois(cleanDomain);
    
    const emails: string[] = [];
    
    // Check for emails in all WHOIS fields
    Object.values(data).forEach(value => {
      if (typeof value === 'string') {
        const foundEmails = extractEmailsFromText(value);
        emails.push(...foundEmails);
      }
    });
    
    return [...new Set(emails)];
  } catch (error) {
    console.error(`Error extracting WHOIS data for ${domain}:`, error);
    return [];
  }
}

/**
 * Process a single opportunity to extract email information
 */
async function processOpportunity(opportunity: any, isPremium: boolean): Promise<boolean> {
  console.log(`\nProcessing ${isPremium ? "premium" : "regular"} opportunity: ${opportunity.domain} (ID: ${opportunity.id})`);
  
  try {
    let url = opportunity.url || `https://${opportunity.domain}`;
    url = cleanupUrl(url);
    const domain = extractDomain(url);
    
    // Get existing contact info if available
    let existingContactInfo: ContactInfo = {
      emails: [],
      socialProfiles: [],
      contactForms: [],
      extractionDetails: {
        normalized: true,
        source: "email-focused-extractor",
        version: "1.0",
        lastUpdated: new Date().toISOString()
      }
    };
    
    if (opportunity.contactInfo) {
      try {
        if (typeof opportunity.contactInfo === 'string') {
          // Handle doubly-escaped JSON
          if (opportunity.contactInfo.startsWith('"') && opportunity.contactInfo.endsWith('"')) {
            const unquoted = opportunity.contactInfo.slice(1, -1);
            const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            existingContactInfo = JSON.parse(unescaped);
          } else {
            existingContactInfo = JSON.parse(opportunity.contactInfo);
          }
        } else {
          existingContactInfo = opportunity.contactInfo as ContactInfo;
        }
      } catch (e) {
        console.error(`Error parsing existing contact info for ${opportunity.id}:`, e);
      }
    }
    
    // Skip if we already have emails
    if (existingContactInfo.emails && existingContactInfo.emails.length > 0) {
      console.log(`  - Already has ${existingContactInfo.emails.length} emails, skipping`);
      return false;
    }
    
    // 1. Check the main page
    console.log(`  - Checking main page for emails: ${url}`);
    const mainPageEmails = await extractEmailsFromPage(url, domain);
    existingContactInfo.emails.push(...mainPageEmails);
    
    // 2. Check all possible contact pages
    console.log(`  - Looking for contact pages`);
    const contactPages = await findAllContactPages(url);
    for (const contactPage of contactPages) {
      console.log(`  - Checking contact page: ${contactPage}`);
      const contactPageEmails = await extractEmailsFromPage(contactPage, domain);
      existingContactInfo.emails.push(...contactPageEmails);
    }
    
    // 3. Try WHOIS as a last resort
    if (existingContactInfo.emails.length === 0) {
      console.log(`  - No emails found, trying WHOIS data`);
      const whoisEmails = await extractWhoisData(domain);
      existingContactInfo.emails.push(...whoisEmails);
    }
    
    // Deduplicate emails
    existingContactInfo.emails = [...new Set(existingContactInfo.emails)];
    
    // Update extraction details
    existingContactInfo.extractionDetails = {
      normalized: true,
      source: "email-focused-extractor",
      version: "1.0",
      lastUpdated: new Date().toISOString()
    };
    
    // Update the database if we found any new emails
    if (existingContactInfo.emails.length > 0) {
      console.log(`  - Found ${existingContactInfo.emails.length} emails for ${domain}`);
      
      await db.update(discoveredOpportunities)
        .set({ contactInfo: JSON.stringify(existingContactInfo) })
        .where(sql`id = ${opportunity.id}`);
      
      return true;
    } else {
      console.log(`  - No emails found for ${domain}`);
      return false;
    }
    
  } catch (error) {
    console.error(`Error processing opportunity ${opportunity.id}:`, error);
    return false;
  }
}

/**
 * Main function to extract email contact information
 */
async function emailFocusedExtraction() {
  console.log("Starting Email-Focused Contact Extraction...");
  
  try {
    // First process premium opportunities without any contact info
    console.log("\n== Processing Premium Opportunities Without Contact Info ==");
    const premiumWithoutContact = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"isPremium" = true AND "contactInfo" IS NULL`);
    
    console.log(`Found ${premiumWithoutContact.length} premium opportunities without contact information`);
    
    let premiumWithoutContactSuccess = 0;
    for (const opportunity of premiumWithoutContact) {
      const success = await processOpportunity(opportunity, true);
      if (success) premiumWithoutContactSuccess++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Next process premium opportunities with contact info but no emails
    console.log("\n== Processing Premium Opportunities Without Email ==");
    const premiumWithContactQuery = `
      SELECT * FROM "discoveredOpportunities" 
      WHERE "isPremium" = true 
      AND "contactInfo" IS NOT NULL 
      AND ("contactInfo"::jsonb->'emails' IS NULL 
           OR jsonb_array_length("contactInfo"::jsonb->'emails') = 0)
    `;
    const premiumWithContact = await db.execute(sql([premiumWithContactQuery]));
    
    console.log(`Found ${premiumWithContact.length} premium opportunities with contact info but no emails`);
    
    let premiumWithContactSuccess = 0;
    for (const opportunity of premiumWithContact) {
      const success = await processOpportunity(opportunity, true);
      if (success) premiumWithContactSuccess++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Process high domain authority non-premium opportunities
    console.log("\n== Processing High DA Non-Premium Opportunities ==");
    const highDaRegularQuery = `
      SELECT * FROM "discoveredOpportunities" 
      WHERE "isPremium" = false 
      AND "domainAuthority" >= 50
      AND ("contactInfo" IS NULL 
           OR "contactInfo"::jsonb->'emails' IS NULL 
           OR jsonb_array_length("contactInfo"::jsonb->'emails') = 0)
      ORDER BY "domainAuthority" DESC
      LIMIT 50
    `;
    const highDaRegular = await db.execute(sql([highDaRegularQuery]));
    
    console.log(`Found ${highDaRegular.length} high DA non-premium opportunities without emails`);
    
    let highDaSuccess = 0;
    for (const opportunity of highDaRegular) {
      const success = await processOpportunity(opportunity, false);
      if (success) highDaSuccess++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Print summary
    console.log("\n== Email Extraction Summary ==");
    console.log(`- Premium without contact: ${premiumWithoutContactSuccess}/${premiumWithoutContact.length} successful`);
    console.log(`- Premium without emails: ${premiumWithContactSuccess}/${premiumWithContact.length} successful`);
    console.log(`- High DA regular: ${highDaSuccess}/${highDaRegular.length} successful`);
    console.log(`- Total successful extractions: ${premiumWithoutContactSuccess + premiumWithContactSuccess + highDaSuccess}`);
    
  } catch (error) {
    console.error("Error in email-focused extraction:", error);
  }
  
  console.log("\nEmail-focused contact extraction completed!");
}

// Run the function
emailFocusedExtraction().catch(console.error);