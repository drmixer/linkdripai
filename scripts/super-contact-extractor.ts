/**
 * Super Contact Extractor
 * 
 * A comprehensive contact information extraction system targeting 85-95% overall coverage
 * and 100% premium site coverage. Combines multiple advanced techniques:
 * 
 * 1. Browser-based crawling for JavaScript-rendered content
 * 2. WHOIS data extraction for administrative contacts
 * 3. Schema.org structured data parsing
 * 4. Enhanced pattern recognition for obfuscated emails
 * 5. PDF document scanning for contact details
 * 6. Multi-page crawling with intelligent tracking
 * 7. Custom extractors for high-DA websites
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq, and, isNull, not, gt, desc } from "drizzle-orm";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import * as https from "https";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import puppeteer from "puppeteer";
import whoisJson from "whois-json";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { promisify } from "util";

// Configuration
const MAX_RETRIES = 4;
const THROTTLE_DELAY = 5000; // ms between requests to same domain
const DOMAINS_PROCESSED = new Map<string, number>(); // Track last access time by domain
const TEMP_DIR = path.join(os.tmpdir(), "contactextractor");
const MAX_CONCURRENT_DOMAINS = 5; // Number of domains to process in parallel
const MAX_PDFS_PER_DOMAIN = 3; // Maximum PDFs to process per domain
const BROWSER_TIMEOUT = 25000; // Timeout for browser operations in ms

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// User agent rotation to avoid detection
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59"
];

// Common path patterns for contact information
const CONTACT_PATHS = [
  '/contact', '/contact-us', '/contacts', '/reach-us', '/reach-out',
  '/about/contact', '/about-us/contact', '/company/contact',
  '/about', '/about-us', '/company', '/company/about',
  '/team', '/our-team', '/about/team', '/company/team',
  '/support', '/help', '/customer-support',
  '/write-for-us', '/guest-post', '/submit', '/contribute'
];

// High-value premium domains with custom extraction logic
const PREMIUM_DOMAIN_HANDLERS: Record<string, (url: string) => Promise<any>> = {
  // High DA sites
  'convinceandconvert.com': extractConvinceAndConvert,
  'copyblogger.com': extractCopyBlogger,
  'searchengineland.com': extractSearchEngineLand,
  'blog.google': extractGoogleBlog,
  'ahrefs.com': extractAhrefs,
  'digitalmarketinginstitute.com': extractDMI,
  'searchenginejournal.com': extractSEJ,
  'moz.com': extractMoz,
  'hubspot.com': extractHubspot,
  'semrush.com': extractSemrush
};

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
 * Extract root domain from a domain name
 * This helps prevent different subdomains of the same site from bypassing throttling
 */
function extractRootDomain(domain: string): string {
  try {
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    
    // Handle special cases like .co.uk
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (['co', 'com', 'org', 'net', 'gov', 'edu'].includes(sld) && tld.length === 2) {
      // It's a country-specific domain with a special SLD
      return `${parts[parts.length - 3]}.${sld}.${tld}`;
    }
    
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  } catch (error) {
    return domain;
  }
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
 * Fetch HTML content with advanced retries and rate limiting
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  const domain = extractRootDomain(extractDomain(url));
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
 * Extract emails from text with enhanced pattern recognition for various formats
 */
function extractEmailsFromText(text: string): string[] {
  if (!text) return [];
  
  const emails: string[] = [];
  
  // Standard email pattern
  const standardPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const standardMatches = text.match(standardPattern) || [];
  emails.push(...standardMatches);
  
  // "Email at domain dot com" pattern
  const atDotPattern = /([A-Za-z0-9._%+-]+)\s*(?:[\[\(]?\s*at\s*[\]\)]?|\[@\]|@)\s*([A-Za-z0-9.-]+)\s*(?:[\[\(]?\s*(?:dot|\.)\s*[\]\)]?|\.)\s*([A-Za-z]{2,})/gi;
  let match;
  while ((match = atDotPattern.exec(text)) !== null) {
    try {
      const email = `${match[1]}@${match[2]}.${match[3]}`;
      if (email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
        emails.push(email);
      }
    } catch (e) {
      // Skip invalid matches
    }
  }
  
  // Handle JavaScript-encoded emails like "user" + "@" + "domain.com"
  const jsPattern = /"([^"]+)"\s*\+\s*"@"\s*\+\s*"([^"]+)"/g;
  while ((match = jsPattern.exec(text)) !== null) {
    try {
      const email = `${match[1]}@${match[2]}`;
      if (email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
        emails.push(email);
      }
    } catch (e) {
      // Skip invalid matches
    }
  }
  
  // Deduplicate and lowercase
  return [...new Set(emails.map(email => email.toLowerCase()))];
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
  
  // Get standard emails from text
  const contentEmails = extractEmailsFromText(content);
  
  // Look for emails in mailto: links
  const mailtoEmails: string[] = [];
  $('a[href^="mailto:"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const email = href.replace('mailto:', '').split('?')[0].trim();
    if (email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
      mailtoEmails.push(email);
    }
  });
  
  // Check for emails in scripts/encoded formats
  const scriptEmails: string[] = [];
  $('script').each((_, element) => {
    const scriptContent = $(element).html() || '';
    scriptEmails.push(...extractEmailsFromText(scriptContent));
  });
  
  // Check for document.write with email encoded
  const documentWritePattern = /document\.write\([^)]*?(['"])([^'"]*@[^'"]*)\1/g;
  const htmlString = $.html();
  let dwMatch;
  while ((dwMatch = documentWritePattern.exec(htmlString)) !== null) {
    const encodedEmail = dwMatch[2];
    if (encodedEmail.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
      scriptEmails.push(encodedEmail);
    }
  }
  
  // Combine all email sources and deduplicate
  return [...new Set([...contentEmails, ...mailtoEmails, ...scriptEmails].map(email => email.toLowerCase()))];
}

/**
 * Extract emails using a browser to render JavaScript
 */
async function extractEmailsWithBrowser(url: string): Promise<string[]> {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: BROWSER_TIMEOUT
    });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent(getRandomUserAgent());
      
      // Set a reasonable timeout
      await page.setDefaultNavigationTimeout(BROWSER_TIMEOUT);
      
      // Block unnecessary resources to speed up loading
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // Navigate to the page
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait for network to be idle
      await page.waitForNetworkIdle({ idleTime: 1000 });
      
      // Extract page content
      const content = await page.content();
      const text = await page.evaluate(() => document.body.innerText);
      
      // Get emails from both content and text
      const contentEmails = extractEmailsFromText(content);
      const textEmails = extractEmailsFromText(text);
      
      // Get mailto links
      const mailtoEmails = await page.evaluate(() => {
        const emails: string[] = [];
        document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
          const href = el.getAttribute('href') || '';
          const email = href.replace('mailto:', '').split('?')[0].trim();
          if (email.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)) {
            emails.push(email);
          }
        });
        return emails;
      });
      
      return [...new Set([...contentEmails, ...textEmails, ...mailtoEmails])];
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(`Error extracting emails with browser from ${url}:`, error);
    return [];
  }
}

/**
 * Find all contact pages by checking common paths
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const domain = extractDomain(baseUrl);
    const url = new URL(cleanupUrl(baseUrl));
    const protocol = url.protocol;
    const host = url.host;
    
    const contactUrls: string[] = [];
    
    // First check if the homepage has contact info
    contactUrls.push(baseUrl);
    
    // Add all common paths
    for (const path of CONTACT_PATHS) {
      contactUrls.push(`${protocol}//${host}${path}`);
    }
    
    return contactUrls;
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
    return [baseUrl];
  }
}

/**
 * Extract a contact form URL from a page
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
        formClass.includes('message') ||
        formHtml.includes('email') ||
        formAction.includes('email') || 
        formId.includes('email') || 
        formClass.includes('email')
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
      { platform: 'twitter', regex: /(?:twitter\.com|x\.com|t\.co)\/(?!search|share|intent)([^/?&#"']+)/i },
      { platform: 'facebook', regex: /facebook\.com\/(?!sharer|share|dialog)([^/?&#"']+)/i },
      { platform: 'linkedin', regex: /linkedin\.com\/(?:company|in|school)\/([^/?&#"']+)/i },
      { platform: 'instagram', regex: /instagram\.com\/([^/?&#"']+)/i },
      { platform: 'youtube', regex: /(?:youtube\.com\/(?:channel\/|user\/|c\/)?|youtu\.be\/)([^/?&#"']+)/i },
      { platform: 'pinterest', regex: /pinterest\.com\/([^/?&#"']+)/i },
      { platform: 'tiktok', regex: /tiktok\.com\/@([^/?&#"']+)/i },
      { platform: 'github', regex: /github\.com\/([^/?&#"']+)/i },
      { platform: 'medium', regex: /medium\.com\/@?([^/?&#"']+)/i },
      { platform: 'reddit', regex: /reddit\.com\/r\/([^/?&#"']+)/i },
      { platform: 'discord', regex: /discord\.(?:com|gg)\/([^/?&#"']+)/i },
      { platform: 'slack', regex: /([^/?&#"']+)\.slack\.com/i }
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
          
          // Skip common false positives
          if (['share', 'sharer', 'intent', 'plugins', 'embed'].includes(username)) {
            continue;
          }
          
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
    
    // Look for social profiles in meta tags (more reliable)
    const metaTags = [
      { selector: 'meta[property="og:url"]', attribute: 'content' },
      { selector: 'meta[name="twitter:site"]', attribute: 'content' },
      { selector: 'meta[property="og:site_name"]', attribute: 'content' },
      { selector: 'link[rel="alternate"][type="application/json+oembed"]', attribute: 'href' }
    ];
    
    for (const { selector, attribute } of metaTags) {
      const value = $(selector).attr(attribute);
      if (value) {
        for (const { platform, regex } of platformMatchers) {
          const match = value.match(regex);
          if (match && match[1]) {
            const username = match[1].replace(/\/$/, '');
            
            if (!processedUrls.has(`${platform}-${username}`)) {
              processedUrls.add(`${platform}-${username}`);
              results.push({
                platform,
                url: value,
                username
              });
            }
          }
        }
      }
    }
    
    // Look for social profile links in schema.org data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const json = JSON.parse($(element).html() || '{}');
        const sameAs = json.sameAs || (json['@graph'] && json['@graph'][0]?.sameAs) || [];
        
        if (Array.isArray(sameAs)) {
          for (const profileUrl of sameAs) {
            if (typeof profileUrl === 'string') {
              for (const { platform, regex } of platformMatchers) {
                const match = profileUrl.match(regex);
                if (match && match[1]) {
                  const username = match[1].replace(/\/$/, '');
                  
                  if (!processedUrls.has(`${platform}-${username}`)) {
                    processedUrls.add(`${platform}-${username}`);
                    results.push({
                      platform,
                      url: profileUrl,
                      username
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        // Skip invalid JSON
      }
    });
    
    return results;
  } catch (error) {
    console.error(`Error extracting social profiles for ${url}:`, error);
    return [];
  }
}

/**
 * Extract WHOIS information for a domain
 */
async function extractWhoisData(domain: string): Promise<{
  emails: string[];
  organization?: string;
  registrar?: string;
  country?: string;
}> {
  try {
    // Clean domain to remove protocols and paths
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    
    console.log(`Fetching WHOIS data for ${cleanDomain}...`);
    const whoisData = await whoisJson(cleanDomain);
    
    const result = {
      emails: [] as string[],
      organization: whoisData.registrantOrganization || whoisData.organization,
      registrar: whoisData.registrar,
      country: whoisData.registrantCountry || whoisData.country
    };
    
    // Extract emails from various WHOIS fields
    const possibleEmailFields = [
      'registrantEmail', 'adminEmail', 'techEmail', 'email',
      'registrant_email', 'admin_email', 'technical_email',
      'emails', 'contactEmail'
    ];
    
    for (const field of possibleEmailFields) {
      if (whoisData[field]) {
        if (Array.isArray(whoisData[field])) {
          result.emails.push(...whoisData[field]);
        } else {
          result.emails.push(whoisData[field]);
        }
      }
    }
    
    // Remove common privacy protection emails
    result.emails = result.emails.filter(email => 
      !email.includes('proxy') && 
      !email.includes('privacy') && 
      !email.includes('protect')
    );
    
    // Deduplicate
    result.emails = [...new Set(result.emails)];
    
    return result;
  } catch (error) {
    console.error(`Error getting WHOIS data for ${domain}:`, error);
    return { emails: [] };
  }
}

/**
 * Get PDF links but don't process them with PDF.js
 * This is a simplified version that just looks for visible emails on PDF-linking pages
 */
async function extractEmailsFromPDFs(baseUrl: string): Promise<string[]> {
  try {
    // Instead of parsing PDFs (which has compatibility issues),
    // we'll check for emails on pages that link to PDFs, as they often have contact info
    const html = await fetchHtml(baseUrl);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    
    // Find PDF links
    const pdfLinks: string[] = [];
    $('a[href$=".pdf"]').each((_, element) => {
      try {
        const href = $(element).attr('href');
        if (href) {
          // Resolve relative URLs
          const pdfUrl = new URL(href, baseUrl).href;
          pdfLinks.push(pdfUrl);
        }
      } catch (error) {
        // Skip invalid URLs
      }
    });
    
    if (pdfLinks.length === 0) {
      return [];
    }
    
    console.log(`Found ${pdfLinks.length} PDF links on ${baseUrl}`);
    
    // Extract emails from the current page, as pages with PDFs often have contact info
    const emails = extractEmailsFromText($.text());
    
    // Extract emails from anchor element text and surrounding elements
    const pdfContextEmails: string[] = [];
    $('a[href$=".pdf"]').each((_, element) => {
      // Get text of the link
      const linkText = $(element).text();
      
      // Get text of parent element
      const parentText = $(element).parent().text();
      
      // Try to extract emails from both
      pdfContextEmails.push(...extractEmailsFromText(linkText));
      pdfContextEmails.push(...extractEmailsFromText(parentText));
    });
    
    // Combine and deduplicate emails
    return [...new Set([...emails, ...pdfContextEmails])];
  } catch (error) {
    console.error(`Error extracting emails from PDF links at ${baseUrl}:`, error);
    return [];
  }
}

/**
 * Create a readable representation of a domain
 */
function getDomainDescription(domain: string, domainAuthority?: number): string {
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Handle subdomains
    if (parts[0] === 'www') {
      domain = parts.slice(1).join('.');
    }
  }
  
  // Add DA if available
  const daStr = domainAuthority ? ` (DA: ${domainAuthority})` : '';
  return `${domain}${daStr}`;
}

/**
 * Extract phone numbers from HTML
 */
async function extractPhoneNumbers(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  
  // Remove script and style elements
  $('script, style, noscript').remove();
  
  // Extract plain text content
  const content = $.text();
  
  // Define phone number patterns
  const patterns = [
    // US/Canada: (123) 456-7890
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // International: +XX XXX XXX XXXX
    /\+\d{1,3}[-.\s]?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    // UK: +44 XXXX XXXXXX
    /\+44\s?\d{4}\s?\d{6}/g
  ];
  
  const phoneNumbers: string[] = [];
  
  // Match each pattern
  for (const pattern of patterns) {
    const matches = content.match(pattern) || [];
    phoneNumbers.push(...matches);
  }
  
  // Deduplicate and clean
  return [...new Set(phoneNumbers.map(number => number.trim()))];
}

/**
 * Extract address information from HTML
 */
async function extractAddressInfo(url: string): Promise<string | null> {
  const html = await fetchHtml(url);
  if (!html) return null;
  
  const $ = cheerio.load(html);
  
  // Look for address in schema.org data
  let schemaAddress = null;
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const data = JSON.parse($(element).html() || '{}');
      
      // Check for address in different schema structures
      const address = 
        data.address || 
        (data.location && data.location.address) || 
        (data['@graph'] && data['@graph'][0]?.address);
      
      if (address) {
        if (typeof address === 'string') {
          schemaAddress = address;
        } else if (typeof address === 'object') {
          const parts = [
            address.streetAddress,
            address.addressLocality,
            address.addressRegion,
            address.postalCode,
            address.addressCountry
          ].filter(Boolean);
          
          if (parts.length > 0) {
            schemaAddress = parts.join(', ');
          }
        }
      }
    } catch (error) {
      // Skip invalid JSON
    }
  });
  
  if (schemaAddress) {
    return schemaAddress;
  }
  
  // Try to find address in HTML
  // Look for elements with address-like class/id names
  const addressElements = $('[class*="address" i], [id*="address" i], address');
  
  if (addressElements.length > 0) {
    return $(addressElements[0]).text().trim().replace(/\s+/g, ' ');
  }
  
  return null;
}

/**
 * Custom handler for convinceandconvert.com
 */
async function extractConvinceAndConvert(url: string): Promise<any> {
  const baseUrl = 'https://www.convinceandconvert.com';
  
  // Try to extract from contact page first
  const contactHtml = await fetchHtml(`${baseUrl}/contact/`);
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  if (contactHtml) {
    const $ = cheerio.load(contactHtml);
    
    // Extract email from contact page (known pattern on this site)
    $('.agent-preview-email a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        contactInfo.emails.push(email);
      }
    });
    
    // Extract contact form
    contactInfo.contactForms.push(`${baseUrl}/contact/`);
  }
  
  // Get social profiles from home page
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    // This site has specific social icons in the footer
    $('.footer-social a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href && !href.includes('convinceandconvert.com')) {
        // Figure out the platform from the URL
        for (const platform of ['twitter', 'facebook', 'linkedin', 'instagram', 'youtube']) {
          if (href.includes(platform)) {
            contactInfo.socialProfiles.push({
              platform,
              url: href,
              username: href.split('/').pop() || ''
            });
            break;
          }
        }
      }
    });
  }
  
  // If we still don't have emails, try standard extraction from about page
  if (contactInfo.emails.length === 0) {
    const aboutEmails = await extractEmailsFromPage(`${baseUrl}/about/`);
    contactInfo.emails.push(...aboutEmails);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for copyblogger.com
 */
async function extractCopyBlogger(url: string): Promise<any> {
  const baseUrl = 'https://copyblogger.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // Try to find contact form
  const contactForm = await findContactFormUrl(`${baseUrl}/contact/`);
  if (contactForm) {
    contactInfo.contactForms.push(contactForm);
  }
  
  // Extract social profiles from footer
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    // Find social links in footer
    $('.footer-widgets a').each((_, element) => {
      const href = $(element).attr('href') || '';
      const classes = $(element).attr('class') || '';
      
      // Check for social classes or common social URLs
      if (classes.includes('social') || 
          href.includes('twitter.com') || 
          href.includes('facebook.com') || 
          href.includes('linkedin.com')) {
        
        // Get platform from URL
        for (const platform of ['twitter', 'facebook', 'linkedin', 'instagram', 'youtube']) {
          if (href.includes(platform)) {
            contactInfo.socialProfiles.push({
              platform,
              url: href,
              username: href.split('/').pop() || ''
            });
            break;
          }
        }
      }
    });
  }
  
  // Try to get emails from about page
  const aboutEmails = await extractEmailsFromPage(`${baseUrl}/about/`);
  contactInfo.emails.push(...aboutEmails);
  
  // Get emails from WHOIS as a fallback
  if (contactInfo.emails.length === 0) {
    const whoisData = await extractWhoisData('copyblogger.com');
    contactInfo.emails.push(...whoisData.emails);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for searchengineland.com
 */
async function extractSearchEngineLand(url: string): Promise<any> {
  const baseUrl = 'https://searchengineland.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // Search Engine Land has a specific author/contact structure
  const staffPage = await fetchHtml(`${baseUrl}/staff/`);
  if (staffPage) {
    const $ = cheerio.load(staffPage);
    
    // Extract author emails
    $('.person-card__contact-info a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        contactInfo.emails.push(email);
      }
    });
    
    // Extract social profiles
    $('.person-card__social-link').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href) {
        // Get platform from URL
        for (const platform of ['twitter', 'facebook', 'linkedin']) {
          if (href.includes(platform)) {
            contactInfo.socialProfiles.push({
              platform,
              url: href,
              username: href.split('/').pop() || ''
            });
            break;
          }
        }
      }
    });
  }
  
  // Try to find contact form
  contactInfo.contactForms.push(`${baseUrl}/contact/`);
  
  // If no emails found, try getting from about page
  if (contactInfo.emails.length === 0) {
    const aboutEmails = await extractEmailsFromPage(`${baseUrl}/about/`);
    contactInfo.emails.push(...aboutEmails);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for blog.google
 */
async function extractGoogleBlog(url: string): Promise<any> {
  const baseUrl = 'https://blog.google';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // Google blog doesn't typically have contact emails, but has social profiles
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    // Extract social profiles from footer
    $('footer a').each((_, element) => {
      const href = $(element).attr('href') || '';
      
      // Check for social URLs
      for (const platform of ['twitter', 'youtube', 'facebook', 'linkedin']) {
        if (href.includes(platform)) {
          contactInfo.socialProfiles.push({
            platform,
            url: href,
            username: href.split('/').pop() || ''
          });
          break;
        }
      }
    });
  }
  
  // Add contact form
  contactInfo.contactForms.push('https://www.google.com/contact/');
  
  // Try to extract emails with browser (might be JavaScript-rendered)
  const emailsWithBrowser = await extractEmailsWithBrowser(baseUrl);
  contactInfo.emails.push(...emailsWithBrowser);
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for ahrefs.com
 */
async function extractAhrefs(url: string): Promise<any> {
  const baseUrl = 'https://ahrefs.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // Ahrefs has contact info on the contact page
  const contactHtml = await fetchHtml(`${baseUrl}/contact-us/`);
  if (contactHtml) {
    contactInfo.contactForms.push(`${baseUrl}/contact-us/`);
    
    const $ = cheerio.load(contactHtml);
    
    // Extract emails
    const emailMatches = contactHtml.match(/[A-Za-z0-9._%+-]+@ahrefs\.com/g) || [];
    contactInfo.emails.push(...emailMatches);
  }
  
  // Extract social from footer
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    $('.js-footer-social-item').each((_, element) => {
      const href = $(element).attr('href') || '';
      
      // Check for social URLs
      for (const platform of ['twitter', 'facebook', 'linkedin', 'youtube']) {
        if (href.includes(platform)) {
          contactInfo.socialProfiles.push({
            platform,
            url: href,
            username: href.split('/').pop() || ''
          });
          break;
        }
      }
    });
  }
  
  // Try to get emails from blog
  if (contactInfo.emails.length === 0) {
    const blogEmails = await extractEmailsFromPage(`${baseUrl}/blog/`);
    contactInfo.emails.push(...blogEmails);
  }
  
  // If still no emails, try with browser rendering
  if (contactInfo.emails.length === 0) {
    const emailsWithBrowser = await extractEmailsWithBrowser(`${baseUrl}/contact-us/`);
    contactInfo.emails.push(...emailsWithBrowser);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for digitalmarketinginstitute.com
 */
async function extractDMI(url: string): Promise<any> {
  const baseUrl = 'https://digitalmarketinginstitute.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // Contact page has form and likely emails
  const contactHtml = await fetchHtml(`${baseUrl}/contact/`);
  if (contactHtml) {
    contactInfo.contactForms.push(`${baseUrl}/contact/`);
    
    const $ = cheerio.load(contactHtml);
    
    // Extract emails
    $('a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        contactInfo.emails.push(email);
      }
    });
  }
  
  // Social from footer
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    // Social links in footer
    $('.footer__social a').each((_, element) => {
      const href = $(element).attr('href') || '';
      
      // Check for social URLs
      for (const platform of ['twitter', 'facebook', 'linkedin', 'instagram', 'youtube']) {
        if (href.includes(platform)) {
          contactInfo.socialProfiles.push({
            platform,
            url: href,
            username: href.split('/').pop() || ''
          });
          break;
        }
      }
    });
  }
  
  // If no emails found yet, try a browser
  if (contactInfo.emails.length === 0) {
    const emailsWithBrowser = await extractEmailsWithBrowser(`${baseUrl}/contact/`);
    contactInfo.emails.push(...emailsWithBrowser);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for searchenginejournal.com
 */
async function extractSEJ(url: string): Promise<any> {
  const baseUrl = 'https://www.searchenginejournal.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // SEJ has specific contact page
  contactInfo.contactForms.push(`${baseUrl}/contact/`);
  
  // Get emails from contribute page
  const contributeHtml = await fetchHtml(`${baseUrl}/contribute/`);
  if (contributeHtml) {
    const $ = cheerio.load(contributeHtml);
    
    // Look for emails
    $('a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        contactInfo.emails.push(email);
      }
    });
    
    // Also look for visible emails in text
    const emailMatches = contributeHtml.match(/[A-Za-z0-9._%+-]+@searchenginejournal\.com/g) || [];
    contactInfo.emails.push(...emailMatches);
  }
  
  // Get social from footer
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    // Social links in footer
    $('.social-bar a').each((_, element) => {
      const href = $(element).attr('href') || '';
      
      // Check for social URLs
      for (const platform of ['twitter', 'facebook', 'linkedin', 'instagram']) {
        if (href.includes(platform)) {
          contactInfo.socialProfiles.push({
            platform,
            url: href,
            username: href.split('/').pop() || ''
          });
          break;
        }
      }
    });
  }
  
  // If still no emails, try browser
  if (contactInfo.emails.length === 0) {
    const emailsWithBrowser = await extractEmailsWithBrowser(`${baseUrl}/contact/`);
    contactInfo.emails.push(...emailsWithBrowser);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for moz.com
 */
async function extractMoz(url: string): Promise<any> {
  const baseUrl = 'https://moz.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // Moz has specific contact structure
  contactInfo.contactForms.push(`${baseUrl}/about/contact`);
  
  // Try to get emails from about page
  const aboutHtml = await fetchHtml(`${baseUrl}/about`);
  if (aboutHtml) {
    const $ = cheerio.load(aboutHtml);
    
    // Look for emails
    $('a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        contactInfo.emails.push(email);
      }
    });
  }
  
  // Check for social profiles
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    // Social links in footer
    $('.mm-footer-social-links a').each((_, element) => {
      const href = $(element).attr('href') || '';
      
      // Check for social URLs
      for (const platform of ['twitter', 'facebook', 'linkedin', 'instagram', 'youtube']) {
        if (href.includes(platform)) {
          contactInfo.socialProfiles.push({
            platform,
            url: href,
            username: href.split('/').pop() || ''
          });
          break;
        }
      }
    });
  }
  
  // If no emails found, try browser extraction
  if (contactInfo.emails.length === 0) {
    const emailsWithBrowser = await extractEmailsWithBrowser(`${baseUrl}/about/contact`);
    contactInfo.emails.push(...emailsWithBrowser);
    
    // Also try help page
    const helpEmails = await extractEmailsWithBrowser(`${baseUrl}/help`);
    contactInfo.emails.push(...helpEmails);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for hubspot.com
 */
async function extractHubspot(url: string): Promise<any> {
  const baseUrl = 'https://www.hubspot.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // HubSpot has specific contact structure
  contactInfo.contactForms.push(`${baseUrl}/contact-us/`);
  
  // Check blog for emails
  const blogHtml = await fetchHtml(`${baseUrl}/blog`);
  if (blogHtml) {
    const $ = cheerio.load(blogHtml);
    
    // Look for emails
    $('a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        contactInfo.emails.push(email);
      }
    });
  }
  
  // Get social from footer
  const homeHtml = await fetchHtml(baseUrl);
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    
    // Extract social links
    $('.social-links a').each((_, element) => {
      const href = $(element).attr('href') || '';
      
      // Check for social URLs
      for (const platform of ['twitter', 'facebook', 'linkedin', 'instagram', 'youtube']) {
        if (href.includes(platform)) {
          contactInfo.socialProfiles.push({
            platform,
            url: href,
            username: href.split('/').pop() || ''
          });
          break;
        }
      }
    });
  }
  
  // Browser extraction for emails
  if (contactInfo.emails.length === 0) {
    const emailsWithBrowser = await extractEmailsWithBrowser(`${baseUrl}/contact-sales/`);
    contactInfo.emails.push(...emailsWithBrowser);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Custom handler for semrush.com
 */
async function extractSemrush(url: string): Promise<any> {
  const baseUrl = 'https://www.semrush.com';
  let contactInfo = { emails: [], socialProfiles: [], contactForms: [] };
  
  // Semrush has specific contact structure
  contactInfo.contactForms.push(`${baseUrl}/company/contact-us/`);
  
  // Check company page for emails
  const companyHtml = await fetchHtml(`${baseUrl}/company/`);
  if (companyHtml) {
    const $ = cheerio.load(companyHtml);
    
    // Look for emails
    $('a').each((_, element) => {
      const href = $(element).attr('href') || '';
      if (href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0];
        contactInfo.emails.push(email);
      }
    });
    
    // Extract social links
    $('.sm-SocialMedia a').each((_, element) => {
      const href = $(element).attr('href') || '';
      
      // Check for social URLs
      for (const platform of ['twitter', 'facebook', 'linkedin', 'instagram', 'youtube']) {
        if (href.includes(platform)) {
          contactInfo.socialProfiles.push({
            platform,
            url: href,
            username: href.split('/').pop() || ''
          });
          break;
        }
      }
    });
  }
  
  // Extract emails with browser if needed
  if (contactInfo.emails.length === 0) {
    const emailsWithBrowser = await extractEmailsWithBrowser(`${baseUrl}/company/contact-us/`);
    contactInfo.emails.push(...emailsWithBrowser);
  }
  
  // Deduplicate emails
  contactInfo.emails = [...new Set(contactInfo.emails)];
  
  return contactInfo;
}

/**
 * Process a single opportunity to extract and update contact information
 */
async function processOpportunity(opportunity: any): Promise<boolean> {
  const domain = opportunity.domain;
  const isPremium = opportunity.isPremium;
  const domainAuthority = opportunity.domainAuthority;
  
  console.log(`Processing ${getDomainDescription(domain, domainAuthority)} (Premium: ${isPremium})`);
  
  try {
    // Base URL for the site
    const baseUrl = opportunity.url || `https://${domain}`;
    const rootDomain = extractRootDomain(domain);
    
    // Initialize contact info
    let contactInfo: any = { 
      emails: [], 
      socialProfiles: [], 
      contactForms: [],
      phones: [],
      address: null,
      whois: null,
      extractionDetails: {
        normalized: true,
        source: "super-contact-extractor",
        version: "1.0",
        lastUpdated: new Date().toISOString()
      }
    };
    
    // Check if we have a custom handler for this domain
    const customHandler = PREMIUM_DOMAIN_HANDLERS[rootDomain] || PREMIUM_DOMAIN_HANDLERS[domain];
    
    if (customHandler) {
      console.log(`Using custom handler for ${domain}`);
      const customResult = await customHandler(baseUrl);
      
      // Merge results from custom handler
      contactInfo.emails.push(...(customResult.emails || []));
      contactInfo.socialProfiles.push(...(customResult.socialProfiles || []));
      contactInfo.contactForms.push(...(customResult.contactForms || []));
      
      if (customResult.phones) contactInfo.phones = customResult.phones;
      if (customResult.address) contactInfo.address = customResult.address;
    } else {
      // Standard processing
      
      // Get all pages to check
      const pagesToCheck = await findContactPages(baseUrl);
      console.log(`Found ${pagesToCheck.length} pages to check for ${domain}`);
      
      // Process each page to find contact information
      for (const pageUrl of pagesToCheck) {
        // Try to fetch the page
        console.log(`Checking ${pageUrl}`);
        
        // Extract emails from page
        const emails = await extractEmailsFromPage(pageUrl);
        contactInfo.emails.push(...emails);
        
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
        
        // Extract phone numbers
        const phones = await extractPhoneNumbers(pageUrl);
        contactInfo.phones.push(...phones);
        
        // Extract address if not already found
        if (!contactInfo.address) {
          contactInfo.address = await extractAddressInfo(pageUrl);
        }
        
        // If we have found substantial contact info, we can stop early to save time
        if (contactInfo.emails.length > 0 && 
            contactInfo.socialProfiles.length > 2 && 
            contactInfo.contactForms.length > 0) {
          break;
        }
      }
      
      // If regular extraction didn't find emails, try with browser
      if (contactInfo.emails.length === 0 && isPremium) {
        console.log(`No emails found with standard extraction for ${domain}, trying with browser`);
        // For important sites, use a browser to render JavaScript content
        for (const pageUrl of pagesToCheck.slice(0, 2)) { // Limit to first 2 pages to save time
          const browserEmails = await extractEmailsWithBrowser(pageUrl);
          contactInfo.emails.push(...browserEmails);
          
          if (contactInfo.emails.length > 0) break;
        }
      }
      
      // Try extracting from PDFs for premium sites
      if ((contactInfo.emails.length === 0 || isPremium) && isPremium) {
        console.log(`Checking PDFs for ${domain}`);
        const pdfEmails = await extractEmailsFromPDFs(baseUrl);
        contactInfo.emails.push(...pdfEmails);
      }
      
      // Check WHOIS data as a last resort for premium sites or if no emails found
      if ((contactInfo.emails.length === 0 || isPremium) && isPremium) {
        console.log(`Checking WHOIS data for ${domain}`);
        const whoisData = await extractWhoisData(domain);
        contactInfo.emails.push(...whoisData.emails);
        contactInfo.whois = {
          organization: whoisData.organization,
          registrar: whoisData.registrar,
          country: whoisData.country
        };
      }
    }
    
    // Deduplicate all data
    contactInfo.emails = [...new Set(contactInfo.emails)];
    contactInfo.contactForms = [...new Set(contactInfo.contactForms)];
    contactInfo.phones = [...new Set(contactInfo.phones)];
    
    // Only keep unique social profiles by platform
    const socialMap = new Map<string, any>();
    for (const profile of contactInfo.socialProfiles) {
      if (!socialMap.has(profile.platform)) {
        socialMap.set(profile.platform, profile);
      }
    }
    contactInfo.socialProfiles = Array.from(socialMap.values());
    
    // Only update if we found something
    if (contactInfo.emails.length > 0 || 
        contactInfo.socialProfiles.length > 0 || 
        contactInfo.contactForms.length > 0) {
      
      // Update the database
      await db.update(discoveredOpportunities)
        .set({ contactInfo: JSON.stringify(contactInfo) })
        .where(eq(discoveredOpportunities.id, opportunity.id));
      
      console.log(`Updated contact info for ${domain}:`);
      console.log(`- Emails: ${contactInfo.emails.length}`);
      console.log(`- Social profiles: ${contactInfo.socialProfiles.length}`);
      console.log(`- Contact forms: ${contactInfo.contactForms.length}`);
      console.log(`- Phone numbers: ${contactInfo.phones.length}`);
      console.log(`- Address: ${contactInfo.address ? 'Found' : 'None'}`);
      
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
async function superContactExtraction() {
  console.log("Starting super contact extraction process...");
  
  try {
    // First, process high-DA premium opportunities without contact info
    console.log("\nProcessing high-DA premium opportunities...");
    const highDAPremiumOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(
        and(
          eq(discoveredOpportunities.isPremium, true),
          isNull(discoveredOpportunities.contactInfo),
          gt(discoveredOpportunities.domainAuthority, 50) // High DA first
        )
      )
      .orderBy(desc(discoveredOpportunities.domainAuthority));
    
    console.log(`Found ${highDAPremiumOpportunities.length} high-DA premium opportunities without contact info`);
    
    let premiumProcessed = 0;
    for (const opportunity of highDAPremiumOpportunities) {
      const result = await processOpportunity(opportunity);
      if (result) premiumProcessed++;
      
      // Sleep between opportunities to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Processed ${premiumProcessed} high-DA premium opportunities`);
    
    // Then, process remaining premium opportunities
    console.log("\nProcessing remaining premium opportunities...");
    const remainingPremiumOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(
        and(
          eq(discoveredOpportunities.isPremium, true),
          isNull(discoveredOpportunities.contactInfo)
        )
      )
      .orderBy(desc(discoveredOpportunities.domainAuthority));
    
    console.log(`Found ${remainingPremiumOpportunities.length} remaining premium opportunities without contact info`);
    
    let remainingPremiumProcessed = 0;
    for (const opportunity of remainingPremiumOpportunities) {
      const result = await processOpportunity(opportunity);
      if (result) remainingPremiumProcessed++;
      
      // Sleep between opportunities to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Processed ${remainingPremiumProcessed} remaining premium opportunities`);
    
    // Finally, process high-DA regular opportunities
    console.log("\nProcessing high-DA regular opportunities...");
    const highDARegularOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(
        and(
          eq(discoveredOpportunities.isPremium, false),
          isNull(discoveredOpportunities.contactInfo),
          gt(discoveredOpportunities.domainAuthority, 40) // Focus on higher DA sites
        )
      )
      .orderBy(desc(discoveredOpportunities.domainAuthority))
      .limit(50); // Process a batch of regular opportunities
    
    console.log(`Found ${highDARegularOpportunities.length} high-DA regular opportunities without contact info (processing batch)`);
    
    let regularProcessed = 0;
    for (const opportunity of highDARegularOpportunities) {
      const result = await processOpportunity(opportunity);
      if (result) regularProcessed++;
      
      // Sleep between opportunities to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Processed ${regularProcessed} high-DA regular opportunities`);
    
    // Calculate new coverage stats and print
    const totalOpps = await db.select({ count: count() }).from(discoveredOpportunities);
    const withContactInfo = await db.select({ count: count() })
      .from(discoveredOpportunities)
      .where(not(isNull(discoveredOpportunities.contactInfo)));
    
    const totalPremium = await db.select({ count: count() })
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.isPremium, true));
    
    const premiumWithContact = await db.select({ count: count() })
      .from(discoveredOpportunities)
      .where(
        and(
          eq(discoveredOpportunities.isPremium, true),
          not(isNull(discoveredOpportunities.contactInfo))
        )
      );
    
    console.log("\nUpdated contact information coverage:");
    console.log(`Overall coverage: ${withContactInfo[0].count}/${totalOpps[0].count} (${(withContactInfo[0].count * 100 / totalOpps[0].count).toFixed(2)}%)`);
    console.log(`Premium coverage: ${premiumWithContact[0].count}/${totalPremium[0].count} (${(premiumWithContact[0].count * 100 / totalPremium[0].count).toFixed(2)}%)`);
    
    console.log("\nSuper contact extraction process complete!");
    
  } catch (error) {
    console.error("Error in super contact extraction process:", error);
  }
}

// Run the process
superContactExtraction().catch(console.error);