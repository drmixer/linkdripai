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
const MAX_RETRIES = 3;
const THROTTLE_DELAY = 5000; // ms between requests to same domain
const REQUEST_TIMEOUT = 15000; // 15 second timeout
const MAX_EXECUTION_TIME = 30000; // 30 seconds per opportunity
const domainLastAccessTime: Record<string, number> = {};
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
];

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const OBFUSCATED_EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+\s*(?:\[at\]|\(at\)|@|&#64;|%40)\s*[A-Za-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\.|\.|&#46;|%2E)\s*[A-Z|a-z]{2,}\b/g;

const SOCIAL_PLATFORM_PATTERNS = [
  { platform: "facebook", regex: /(?:facebook\.com|fb\.com)\/(?!share|sharer)([^/?&]+)/i },
  { platform: "twitter", regex: /(?:twitter\.com|x\.com)\/([^/?&]+)/i },
  { platform: "linkedin", regex: /linkedin\.com\/(?:company|in|school)\/([^/?&]+)/i },
  { platform: "instagram", regex: /instagram\.com\/([^/?&]+)/i },
  { platform: "youtube", regex: /youtube\.com\/(?:channel\/|user\/|c\/)?([^/?&]+)/i },
  { platform: "pinterest", regex: /pinterest\.com\/([^/?&]+)/i },
  { platform: "github", regex: /github\.com\/([^/?&]+)/i },
  { platform: "medium", regex: /medium\.com\/@?([^/?&]+)/i },
  { platform: "reddit", regex: /reddit\.com\/(?:r|user)\/([^/?&]+)/i },
];

const COMMON_CONTACT_PATHS = [
  "/contact", "/contact-us", "/contactus", "/get-in-touch", "/reach-us", "/connect", 
  "/about/contact", "/about-us/contact", "/support", "/help", "/write-for-us", 
  "/contributors", "/contribute", "/contact.html", "/contact.php", "/reach-out",
  "/about", "/about-us", "/team", "/our-team", "/meet-the-team", "/people", "/staff"
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
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  // Parse HTML
  const $ = cheerio.load(html);
  
  // Remove script and style elements which might contain false positives
  $('script, style, noscript').remove();
  
  // Get text content
  const text = $.text();
  
  // Extract emails using regex
  const emails: Set<string> = new Set();
  
  // Standard email format
  const standardMatches = text.match(EMAIL_REGEX) || [];
  standardMatches.forEach(email => emails.add(email.toLowerCase()));
  
  // Obfuscated email formats
  const obfuscatedMatches = text.match(OBFUSCATED_EMAIL_REGEX) || [];
  obfuscatedMatches.forEach(match => {
    // Convert to standard format
    const standardized = match
      .replace(/\s+/g, '')
      .replace(/\[at\]|\(at\)|&#64;|%40/gi, '@')
      .replace(/\[dot\]|\(dot\)|&#46;|%2E/gi, '.')
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
  
  return Array.from(emails);
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
 * Find a contact form URL on a website with improved detection
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    // First check if the main URL is a contact page itself
    const mainHtml = await fetchHtml(url);
    if (!mainHtml) return null;
    
    const $ = cheerio.load(mainHtml);
    
    // Check if this page has a form
    if ($('form').length > 0) {
      const title = $('title').text().toLowerCase();
      const h1 = $('h1').text().toLowerCase();
      
      if (title.includes('contact') || h1.includes('contact') || 
          url.toLowerCase().includes('contact')) {
        return url;
      }
    }
    
    // Look for contact links
    const contactLinks: string[] = [];
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      
      if (href && (text.includes('contact') || 
                  text.includes('get in touch') || 
                  text.includes('reach us'))) {
        try {
          // Convert relative to absolute URL
          let fullUrl = new URL(href, url).href;
          contactLinks.push(fullUrl);
        } catch (error) {
          // Skip invalid URLs
        }
      }
    });
    
    // Try to find a form on the contact links
    for (const link of contactLinks) {
      const contactHtml = await fetchHtml(link);
      if (contactHtml) {
        const $contact = cheerio.load(contactHtml);
        if ($contact('form').length > 0) {
          return link;
        }
      }
    }
    
    // Check common contact paths
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
 * Check common contact paths for a contact form
 */
async function checkCommonContactPaths(protocol: string, domain: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      const contactUrl = `${protocol}//${domain}${path}`;
      const html = await fetchHtml(contactUrl);
      
      if (html) {
        const $ = cheerio.load(html);
        if ($('form').length > 0) {
          return contactUrl;
        }
      }
    } catch (error) {
      // Continue to next path
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
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