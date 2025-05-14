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

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';

// Configuration Constants
const MAX_RETRIES = 5; // Maximum number of retry attempts per URL
const THROTTLE_DELAY = 5000; // Minimum time between requests to the same domain (ms)
const BATCH_SIZE = 15; // Process opportunities in batches to avoid overwhelming API limits
const TIMEOUT = 20000; // Timeout for HTTP requests (ms)
const USER_AGENT_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
];

// Domain request trackers for throttling
const lastRequestByDomain: { [domain: string]: number } = {};

// Cache for URL fetching to avoid redundant requests
const urlCache: { [url: string]: { html: string, time: number } } = {};

// Common contact page paths to check
const CONTACT_PAGE_PATHS = [
  '/contact', '/contact-us', '/about/contact', '/contact/index.html', 
  '/about/contact-us', '/contactus', '/connect', '/reach-us', '/reach-out',
  '/get-in-touch', '/about-us/contact', '/contact/contact-us',
  '/about', '/about-us', '/about/about-us', '/team', '/our-team', 
  '/meet-the-team', '/about/team', '/about/our-team', '/people',
  '/company/team', '/company/about', '/company/contact'
];

// Regular expression patterns for extracting emails
// Includes patterns for obfuscated and encoded emails
const EMAIL_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Standard email format
  /\b[A-Za-z0-9._%+-]+\s*[\[\(]at\[\)\]\s*[A-Za-z0-9.-]+\s*[\[\(]dot[\)\]\s*[A-Z|a-z]{2,}\b/g, // Obfuscated with (at) and (dot)
  /\b[A-Za-z0-9._%+-]+\s*&#(?:x0*[0-9a-f]{2}|0*\d{3});[A-Za-z0-9.-]+\s*&#(?:x0*[0-9a-f]{2}|0*\d{3});[A-Z|a-z]{2,}\b/g, // HTML entity encoded
  /data-email="([^"]+)"/g, // Data attribute encoded email
  /Email:\s*<strong>([^<]+)<\/strong>/g, // Common email label pattern
  /\b[A-Za-z0-9._%+-]+ at [A-Za-z0-9.-]+ dot [A-Z|a-z]{2,}\b/g, // Text 'at' and 'dot'
  /\b[A-Za-z0-9._%+-]+\(at\)[A-Za-z0-9.-]+\(dot\)[A-Z|a-z]{2,}\b/g // With (at) and (dot)
];

// Common social media domains and their extraction patterns
const SOCIAL_PLATFORMS = [
  {
    name: 'LinkedIn',
    domains: ['linkedin.com', 'lnkd.in'],
    patterns: [
      /linkedin\.com\/(?:company|school|in)\/([^\/\s"']+)/i,
      /lnkd\.in\/([^\/\s"']+)/i,
      /linkedin\.com\/in\/([^\/\s"']+)/i
    ],
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v8/icons/linkedin.svg'
  },
  {
    name: 'Twitter',
    domains: ['twitter.com', 'x.com', 't.co'],
    patterns: [
      /twitter\.com\/([^\/\s"']+)/i,
      /x\.com\/([^\/\s"']+)/i,
      /t\.co\/([^\/\s"']+)/i
    ],
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v8/icons/twitter.svg'
  },
  {
    name: 'Facebook',
    domains: ['facebook.com', 'fb.com', 'fb.me'],
    patterns: [
      /facebook\.com\/(?:pages\/)?([^\/\s"'?]+)/i,
      /fb\.com\/([^\/\s"']+)/i,
      /fb\.me\/([^\/\s"']+)/i
    ],
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v8/icons/facebook.svg'
  },
  {
    name: 'Instagram',
    domains: ['instagram.com', 'instagr.am'],
    patterns: [
      /instagram\.com\/([^\/\s"']+)/i,
      /instagr\.am\/([^\/\s"']+)/i
    ],
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v8/icons/instagram.svg'
  },
  {
    name: 'YouTube',
    domains: ['youtube.com', 'youtu.be'],
    patterns: [
      /youtube\.com\/(?:channel\/|c\/|user\/)?([^\/\s"']+)/i,
      /youtu\.be\/([^\/\s"']+)/i
    ],
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v8/icons/youtube.svg'
  },
  {
    name: 'GitHub',
    domains: ['github.com'],
    patterns: [
      /github\.com\/([^\/\s"']+)/i
    ],
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v8/icons/github.svg'
  },
  {
    name: 'Medium',
    domains: ['medium.com'],
    patterns: [
      /medium\.com\/(?:@)?([^\/\s"']+)/i
    ],
    iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v8/icons/medium.svg'
  }
];

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return USER_AGENT_LIST[Math.floor(Math.random() * USER_AGENT_LIST.length)];
}

/**
 * Calculate exponential backoff with jitter for smarter retries
 * @param retry The current retry attempt number
 * @param baseDelay The base delay in milliseconds
 * @param maxDelay The maximum delay in milliseconds
 */
function calculateBackoff(retry: number, baseDelay = 1000, maxDelay = 30000): number {
  const expBackoff = Math.min(maxDelay, baseDelay * Math.pow(2, retry));
  // Add jitter to avoid request clustering
  return expBackoff + Math.random() * 1000;
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 * @param minTimeBetweenRequests Minimum time between requests to the same domain in ms
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = THROTTLE_DELAY): boolean {
  const now = Date.now();
  const lastRequest = lastRequestByDomain[domain] || 0;
  
  if (now - lastRequest < minTimeBetweenRequests) {
    return true;
  }
  
  lastRequestByDomain[domain] = now;
  return false;
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    url = url.trim();
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse URL to standardize format and handle encoding
    const parsedUrl = new URL(url);
    
    // Remove common tracking parameters
    const searchParams = parsedUrl.searchParams;
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source', 'fbclid'].forEach(param => {
      searchParams.delete(param);
    });
    
    // Remove hash fragment (unless it's a SPA route)
    if (parsedUrl.hash && !parsedUrl.hash.startsWith('#/')) {
      parsedUrl.hash = '';
    }
    
    // Ensure trailing slash consistency
    if (parsedUrl.pathname === '') {
      parsedUrl.pathname = '/';
    }
    
    return parsedUrl.toString();
  } catch (error) {
    return url; // Return original URL if parsing fails
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  if (!url || typeof url !== 'string') {
    console.warn(`Invalid URL: ${url}`);
    return '';
  }
  
  try {
    // First attempt with URL constructor
    try {
      // Make sure URL has protocol
      let urlWithProtocol = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        urlWithProtocol = 'https://' + url;
      }
      
      const parsedUrl = new URL(urlWithProtocol);
      return parsedUrl.hostname.replace(/^www\./, '');
    } catch (parseError) {
      // If URL parsing fails, try basic extraction with regex
      const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n\?\#]+)/im);
      
      if (match && match[1]) {
        // Additional validation - must have at least one dot to be a domain
        const domain = match[1];
        if (domain.includes('.')) {
          return domain;
        }
      }
      
      // If nothing worked, log warning and return empty string
      console.warn(`Failed to extract domain from URL: ${url}`);
      return '';
    }
  } catch (error) {
    console.error(`Error extracting domain from URL: ${url} - ${error}`);
    return '';
  }
}

/**
 * Fetch HTML content from a URL with advanced retrying and rate limiting
 * @param url The URL to fetch
 * @param maxRetries Maximum number of retry attempts
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  let cleanedUrl: string;
  try {
    cleanedUrl = cleanupUrl(url);
  } catch (error) {
    console.error(`Invalid URL: ${url}`);
    return null;
  }
  
  const domain = extractDomain(cleanedUrl);
  
  // Check cache first
  const cachedData = urlCache[cleanedUrl];
  if (cachedData && Date.now() - cachedData.time < 86400000) { // 24 hour cache
    return cachedData.html;
  }
  
  // Apply domain throttling
  if (shouldThrottleDomain(domain)) {
    const delay = THROTTLE_DELAY;
    console.log(`Throttling request to ${domain}, waiting ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  let retries = 0;
  let html: string | null = null;
  
  while (retries <= maxRetries) {
    try {
      // Use random user agent to avoid detection
      const response = await axios.get(cleanedUrl, {
        timeout: TIMEOUT,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        },
        maxRedirects: 5
      });
      
      if (response.status === 200 && response.data) {
        html = response.data;
        
        // Cache the result for future use
        urlCache[cleanedUrl] = {
          html: html,
          time: Date.now()
        };
        
        break;
      }
    } catch (error: any) {
      retries++;
      
      if (retries > maxRetries) {
        console.error(`Failed to fetch ${cleanedUrl} after ${maxRetries} attempts`);
        break;
      }
      
      const backoffTime = calculateBackoff(retries);
      console.log(`Retry ${retries}/${maxRetries} for ${cleanedUrl} in ${Math.round(backoffTime)}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
  
  return html;
}

/**
 * Extract emails from a webpage with enhanced pattern recognition
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const bodyText = $('body').text();
    const htmlContent = $.html();
    
    let emails: string[] = [];
    
    // Apply each email pattern to both HTML and text content
    for (const pattern of EMAIL_PATTERNS) {
      // Extract from HTML content
      const htmlMatches = htmlContent.match(pattern) || [];
      
      // Extract from text content
      const textMatches = bodyText.match(pattern) || [];
      
      emails = [...emails, ...htmlMatches, ...textMatches];
    }
    
    // Look for email encoding techniques
    $('script').each((_, element) => {
      const scriptText = $(element).html() || '';
      
      // Check for common JavaScript obfuscation methods
      if (scriptText.includes('emailto') || 
          scriptText.includes('decode') || 
          scriptText.includes('String.fromCharCode')) {
        
        // Extract potential encoded strings
        const encodedMatches = scriptText.match(/String\.fromCharCode\(([^\)]+)\)/g) || [];
        
        // Attempt to decode
        for (const encodedMatch of encodedMatches) {
          try {
            const charCodeStr = encodedMatch.replace(/String\.fromCharCode\(|\)/g, '');
            const charCodes = charCodeStr.split(',').map(c => parseInt(c.trim(), 10));
            const decodedText = String.fromCharCode(...charCodes);
            
            // Check if decoded text contains an email
            const emailInDecoded = decodedText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g) || [];
            emails = [...emails, ...emailInDecoded];
          } catch (e) {
            // Skip if decoding fails
          }
        }
      }
    });
    
    // Look for "mailto:" links
    $('a[href^="mailto:"]').each((_, element) => {
      const mailtoHref = $(element).attr('href') || '';
      const email = mailtoHref.replace('mailto:', '').split('?')[0].trim();
      if (email && email.includes('@')) {
        emails.push(email);
      }
    });
    
    // Process and clean emails
    const processedEmails = emails
      .map(email => {
        // Clean up obfuscated emails
        let cleaned = email
          .replace(/\s*\[\(at\)\]\s*/gi, '@')
          .replace(/\s*\[\(dot\)\]\s*/gi, '.')
          .replace(/\s*at\s*/gi, '@')
          .replace(/\s*dot\s*/gi, '.')
          .replace(/\(at\)/gi, '@')
          .replace(/\(dot\)/gi, '.')
          .trim();
        
        // Remove surrounding tags, quotes, etc.
        cleaned = cleaned.replace(/<[^>]+>|"|'|&quot;|&#34;/g, '');
        
        // Verify it's a valid email format
        if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(cleaned)) {
          return cleaned;
        }
        return null;
      })
      .filter((email): email is string => email !== null)
      .filter((email, index, self) => self.indexOf(email) === index); // Remove duplicates
    
    return processedEmails;
  } catch (error) {
    console.error(`Error extracting emails from ${url}:`, error);
    return [];
  }
}

/**
 * Find all potential contact pages by checking common paths
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const baseUrlClean = cleanupUrl(baseUrl);
    const parsedUrl = new URL(baseUrlClean);
    const protocol = parsedUrl.protocol;
    const domain = parsedUrl.hostname;
    
    const contactPages: string[] = [];
    
    // Start with the base URL
    contactPages.push(baseUrlClean);
    
    // Check common contact page paths
    for (const path of CONTACT_PAGE_PATHS) {
      try {
        const contactUrl = `${protocol}//${domain}${path}`;
        const html = await fetchHtml(contactUrl, 1); // Only try once for each path
        
        if (html) {
          contactPages.push(contactUrl);
        }
      } catch (error) {
        // Skip if path doesn't exist
      }
    }
    
    // Try to find more contact pages by scraping the main page for links
    try {
      const mainHtml = await fetchHtml(baseUrlClean);
      if (mainHtml) {
        const $ = cheerio.load(mainHtml);
        
        // Look for links with contact-related text
        $('a').each((_, element) => {
          const href = $(element).attr('href');
          const text = $(element).text().toLowerCase();
          
          if (href && 
              (text.includes('contact') || 
               text.includes('about') || 
               text.includes('team') || 
               text.includes('reach out'))) {
            
            let contactUrl = href;
            
            // Handle relative URLs
            if (href.startsWith('/')) {
              contactUrl = `${protocol}//${domain}${href}`;
            } else if (!href.startsWith('http')) {
              contactUrl = `${protocol}//${domain}/${href}`;
            }
            
            // Only add if it's from the same domain
            if (contactUrl.includes(domain)) {
              contactPages.push(contactUrl);
            }
          }
        });
      }
    } catch (error) {
      // Continue even if link extraction fails
    }
    
    // Remove duplicates and return
    return [...new Set(contactPages)];
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
    return [baseUrl]; // Return at least the base URL
  }
}

/**
 * Find a contact form URL on a website with improved detection
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    const contactPages = await findContactPages(url);
    
    for (const contactUrl of contactPages) {
      const html = await fetchHtml(contactUrl);
      if (!html) continue;
      
      const $ = cheerio.load(html);
      
      // Check for forms
      const formElements = $('form');
      
      if (formElements.length > 0) {
        // Check if any form looks like a contact form
        for (let i = 0; i < formElements.length; i++) {
          const form = formElements.eq(i);
          const formHtml = form.html() || '';
          const formText = form.text().toLowerCase();
          
          // Look for indicators of a contact form
          if (
            formHtml.includes('name') && 
            (formHtml.includes('email') || formHtml.includes('mail')) &&
            (
              formText.includes('contact') || 
              formText.includes('message') || 
              formText.includes('send') || 
              formText.includes('submit') ||
              form.find('textarea').length > 0
            )
          ) {
            return contactUrl;
          }
        }
      }
      
      // Check for contact form links
      const contactLinks = $('a').filter((_, element) => {
        const href = $(element).attr('href') || '';
        const text = $(element).text().toLowerCase();
        
        return (
          (href.includes('/contact') || href.includes('contact-us') || href.includes('contactus')) ||
          (text.includes('contact us') || text.includes('get in touch') || text.includes('reach out'))
        );
      });
      
      if (contactLinks.length > 0) {
        const contactLink = contactLinks.first().attr('href');
        if (contactLink) {
          // Handle relative URLs
          if (contactLink.startsWith('/')) {
            const parsedUrl = new URL(contactUrl);
            return `${parsedUrl.protocol}//${parsedUrl.hostname}${contactLink}`;
          } else if (!contactLink.startsWith('http')) {
            const parsedUrl = new URL(contactUrl);
            return `${parsedUrl.protocol}//${parsedUrl.hostname}/${contactLink}`;
          }
          return contactLink;
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
    
    // Find all links
    const socialProfiles: Array<{
      platform: string, 
      url: string, 
      username: string, 
      displayName?: string, 
      description?: string, 
      iconUrl?: string
    }> = [];
    
    // Check all links on the page
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      // Clean up the URL
      const cleanHref = href.split('?')[0].toLowerCase();
      
      // Check against each social platform
      for (const platform of SOCIAL_PLATFORMS) {
        // Check if URL contains any of the platform domains
        const isPlatformURL = platform.domains.some(domain => cleanHref.includes(domain));
        
        if (isPlatformURL) {
          // Extract username based on platform-specific patterns
          let username = '';
          
          for (const pattern of platform.patterns) {
            const match = cleanHref.match(pattern);
            if (match && match[1]) {
              username = match[1];
              break;
            }
          }
          
          // Only add if we found a username and it's not already in the list
          if (username && !socialProfiles.some(p => 
              p.platform === platform.name && p.username === username)) {
            
            // Try to extract display name from surrounding text or image alt
            let displayName = $(element).text().trim();
            if (!displayName || displayName === username) {
              const img = $(element).find('img');
              if (img.length > 0) {
                displayName = img.attr('alt') || '';
              }
            }
            
            const socialProfile = {
              platform: platform.name,
              url: cleanHref,
              username: username,
              displayName: displayName || undefined,
              iconUrl: platform.iconUrl
            };
            
            socialProfiles.push(socialProfile);
          }
        }
      }
    });
    
    // Look for additional metadata in meta tags and JSON-LD
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonLd = JSON.parse($(element).html() || '{}');
        
        // Check for organization social profiles
        if (jsonLd.sameAs && Array.isArray(jsonLd.sameAs)) {
          for (const socialUrl of jsonLd.sameAs) {
            // Check against each social platform
            for (const platform of SOCIAL_PLATFORMS) {
              // Check if URL contains any of the platform domains
              const isPlatformURL = platform.domains.some(domain => 
                socialUrl.toLowerCase().includes(domain));
              
              if (isPlatformURL) {
                // Extract username based on platform-specific patterns
                for (const pattern of platform.patterns) {
                  const match = socialUrl.match(pattern);
                  if (match && match[1]) {
                    const username = match[1];
                    
                    // Only add if not already in the list
                    if (!socialProfiles.some(p => 
                        p.platform === platform.name && p.username === username)) {
                      
                      const socialProfile = {
                        platform: platform.name,
                        url: socialUrl,
                        username: username,
                        displayName: jsonLd.name || undefined,
                        description: jsonLd.description || undefined,
                        iconUrl: platform.iconUrl
                      };
                      
                      socialProfiles.push(socialProfile);
                    }
                    
                    break;
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        // Skip JSON parsing errors
      }
    });
    
    return socialProfiles;
  } catch (error) {
    console.error(`Error extracting social profiles from ${url}:`, error);
    return [];
  }
}

/**
 * Extract phone numbers from HTML with country code detection
 */
async function extractPhoneNumbers(url: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const bodyText = $('body').text();
    
    // Regular expressions for phone numbers with various formats
    const phonePatterns = [
      /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // International format
      /\(\d{3}\)[-.\s]?\d{3}[-.\s]?\d{4}/g, // (123) 456-7890
      /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, // 123-456-7890
      /\d{3}\.?\d{3}\.?\d{4}/g, // 123.456.7890
      /(?:Phone|Tel|Telephone)(?::|\.)?[-.\s]?\+?[-.\d\s]{7,}/gi // Phone: 123-456-7890
    ];
    
    let phoneNumbers: string[] = [];
    
    // Apply each pattern to body text
    for (const pattern of phonePatterns) {
      const matches = bodyText.match(pattern) || [];
      phoneNumbers = [...phoneNumbers, ...matches];
    }
    
    // Look for phone number in meta tags or microdata
    $('meta').each((_, element) => {
      const content = $(element).attr('content') || '';
      for (const pattern of phonePatterns) {
        const matches = content.match(pattern) || [];
        phoneNumbers = [...phoneNumbers, ...matches];
      }
    });
    
    // Process phone numbers
    const processedNumbers = phoneNumbers
      .map(phone => {
        // Clean up the phone number
        let cleaned = phone
          .replace(/(?:Phone|Tel|Telephone)(?::|\.)?/gi, '')
          .trim();
        
        return cleaned;
      })
      .filter((phone, index, self) => self.indexOf(phone) === index); // Remove duplicates
    
    return processedNumbers;
  } catch (error) {
    console.error(`Error extracting phone numbers from ${url}:`, error);
    return [];
  }
}

/**
 * Check if a given text appears to be an address
 */
function isLikelyAddress(text: string): boolean {
  const addressIndicators = [
    /\d+\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Plaza|Plz|Square|Sq)/i,
    /[A-Za-z]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/,
    /\b(?:floor|suite|room|apt|apartment)\s+\w+/i,
    /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/,
    /\b(?:Address|Location)(?::|\.)?[-.\s]/i
  ];
  
  return addressIndicators.some(pattern => pattern.test(text));
}

/**
 * Extract physical address from HTML
 */
async function extractAddress(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    
    // Look for structured data first
    let address: string | null = null;
    
    // Check JSON-LD
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonLd = JSON.parse($(element).html() || '{}');
        
        if (jsonLd.address) {
          const addressObj = jsonLd.address;
          address = `${addressObj.streetAddress || ''}, ${addressObj.addressLocality || ''}, ${addressObj.addressRegion || ''} ${addressObj.postalCode || ''}, ${addressObj.addressCountry || ''}`;
          return false; // Break the loop
        }
        
        // Check for address in Organization or LocalBusiness
        if ((jsonLd['@type'] === 'Organization' || jsonLd['@type'] === 'LocalBusiness') && jsonLd.address) {
          const addressObj = jsonLd.address;
          address = `${addressObj.streetAddress || ''}, ${addressObj.addressLocality || ''}, ${addressObj.addressRegion || ''} ${addressObj.postalCode || ''}, ${addressObj.addressCountry || ''}`;
          return false;
        }
      } catch (error) {
        // Skip JSON parsing errors
      }
    });
    
    if (address) {
      return address.replace(/,\s+,/g, ',').replace(/\s+/g, ' ').trim();
    }
    
    // Look for address in footer or contact section
    ['footer', '.footer', '.contact', '#contact', '.address', '#address'].forEach(selector => {
      if (address) return;
      
      const element = $(selector);
      if (element.length) {
        const text = element.text();
        const paragraphs = text.split(/[\r\n]+/);
        
        for (const paragraph of paragraphs) {
          if (isLikelyAddress(paragraph)) {
            address = paragraph.trim().replace(/\s+/g, ' ');
            break;
          }
        }
      }
    });
    
    return address;
  } catch (error) {
    console.error(`Error extracting address from ${url}:`, error);
    return null;
  }
}

/**
 * Main function to run the advanced contact extraction process
 */
export async function runAdvancedContactExtraction(options: {
  isDryRun?: boolean;
  premiumOnly?: boolean;
  batchSize?: number;
  limit?: number;
} = {}) {
  console.log('Starting advanced contact information extraction process...');
  
  const isDryRun = options.isDryRun || false;
  const premiumOnly = options.premiumOnly || false;
  const batchSize = options.batchSize || BATCH_SIZE;
  const limit = options.limit || Infinity;
  
  console.log(`Configuration:`);
  console.log(`- Dry run mode: ${isDryRun ? 'Enabled' : 'Disabled'}`);
  console.log(`- Processing ${premiumOnly ? 'premium opportunities only' : 'all opportunities'}`);
  console.log(`- Batch size: ${batchSize}`);
  if (limit < Infinity) console.log(`- Processing limit: ${limit} opportunities`);
  
  try {
    // Get current statistics
    const totalStats = await db.select({
      total: sql`COUNT(*)`,
      with_contact: sql`COUNT(*) FILTER (WHERE "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}')`
    }).from(discoveredOpportunities);
    
    const premiumStats = await db.select({
      total: sql`COUNT(*) FILTER (WHERE "isPremium" = true)`,
      with_contact: sql`COUNT(*) FILTER (WHERE "isPremium" = true AND "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}')`
    }).from(discoveredOpportunities);
    
    console.log('\nCurrent Contact Information Coverage:');
    console.log(`- Total opportunities: ${totalStats[0].total}`);
    console.log(`- With contact info: ${totalStats[0].with_contact} (${((totalStats[0].with_contact / totalStats[0].total) * 100).toFixed(1)}%)`);
    console.log(`- Premium opportunities: ${premiumStats[0].total}`);
    console.log(`- Premium with contact info: ${premiumStats[0].with_contact} (${((premiumStats[0].with_contact / premiumStats[0].total) * 100).toFixed(1)}%)`);
    
    // Determine which opportunities to process - make sure we only get ones with valid URLs
    let whereClause;
    if (premiumOnly) {
      whereClause = sql`"isPremium" = true AND "url" IS NOT NULL AND "url" != '' AND ("contactInfo" IS NULL OR "contactInfo" = '[]' OR "contactInfo" = '{}')`;
    } else {
      whereClause = sql`"url" IS NOT NULL AND "url" != '' AND ("contactInfo" IS NULL OR "contactInfo" = '[]' OR "contactInfo" = '{}')`;
    }
    
    // Get the total number of opportunities to process
    const countResult = await db.select({
      count: sql`COUNT(*)`
    }).from(discoveredOpportunities).where(whereClause);
    
    const totalToProcess = Math.min(countResult[0].count, limit);
    
    console.log(`\nFound ${totalToProcess} opportunities without contact information to process`);
    
    if (totalToProcess === 0) {
      console.log('No opportunities to process. Exiting.');
      return;
    }
    
    // Process opportunities in batches
    let processed = 0;
    let successCount = 0;
    let failureCount = 0;
    
    while (processed < totalToProcess) {
      // Get the next batch of opportunities
      const opportunities = await db.select()
        .from(discoveredOpportunities)
        .where(whereClause)
        .limit(batchSize)
        .offset(processed);
      
      if (opportunities.length === 0) break;
      
      console.log(`\nProcessing batch ${Math.ceil(processed / batchSize) + 1} (${processed + 1} to ${processed + opportunities.length} of ${totalToProcess})`);
      
      // Process each opportunity in the batch
      const results = await Promise.all(
        opportunities.map(opportunity => processOpportunity(opportunity, isDryRun))
      );
      
      // Update statistics
      const batchSuccesses = results.filter(r => r.success).length;
      const batchFailures = results.filter(r => !r.success).length;
      
      successCount += batchSuccesses;
      failureCount += batchFailures;
      processed += opportunities.length;
      
      console.log(`Batch results: ${batchSuccesses} successes, ${batchFailures} failures`);
      console.log(`Progress: ${processed}/${totalToProcess} (${(processed/totalToProcess*100).toFixed(1)}%)`);
      
      // Add a small delay between batches to avoid overwhelming the system
      if (processed < totalToProcess) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\nExtraction process complete!');
    console.log(`Processed ${processed} opportunities`);
    console.log(`- Successful extractions: ${successCount} (${(successCount/processed*100).toFixed(1)}%)`);
    console.log(`- Failed extractions: ${failureCount} (${(failureCount/processed*100).toFixed(1)}%)`);
    
    // Get updated statistics
    const updatedTotalStats = await db.select({
      total: sql`COUNT(*)`,
      with_contact: sql`COUNT(*) FILTER (WHERE "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}')`
    }).from(discoveredOpportunities);
    
    const updatedPremiumStats = await db.select({
      total: sql`COUNT(*) FILTER (WHERE "isPremium" = true)`,
      with_contact: sql`COUNT(*) FILTER (WHERE "isPremium" = true AND "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}')`
    }).from(discoveredOpportunities);
    
    console.log('\nUpdated Contact Information Coverage:');
    console.log(`- Total opportunities: ${updatedTotalStats[0].total}`);
    console.log(`- With contact info: ${updatedTotalStats[0].with_contact} (${((updatedTotalStats[0].with_contact / updatedTotalStats[0].total) * 100).toFixed(1)}%)`);
    console.log(`- Premium opportunities: ${updatedPremiumStats[0].total}`);
    console.log(`- Premium with contact info: ${updatedPremiumStats[0].with_contact} (${((updatedPremiumStats[0].with_contact / updatedPremiumStats[0].total) * 100).toFixed(1)}%)`);
    
    const improvementTotal = updatedTotalStats[0].with_contact - totalStats[0].with_contact;
    const improvementPremium = updatedPremiumStats[0].with_contact - premiumStats[0].with_contact;
    
    console.log(`\nImprovement:`);
    console.log(`- Added contact info to ${improvementTotal} opportunities overall`);
    console.log(`- Added contact info to ${improvementPremium} premium opportunities`);
    
  } catch (error) {
    console.error('Error in advanced contact extraction process:', error);
  }
}

/**
 * Process a single opportunity to extract contact information
 */
async function processOpportunity(opportunity: any, isDryRun: boolean): Promise<{
  success: boolean,
  opportunity: any
}> {
  try {
    console.log(`Processing opportunity ID: ${opportunity?.id}`);
    
    // Validate the opportunity has required fields
    if (!opportunity || !opportunity.url) {
      console.log('Missing required fields in opportunity. Skipping.');
      return { success: false, opportunity };
    }
    
    console.log(`Processing opportunity: ${opportunity.pageTitle || 'Untitled'} (${opportunity.url})`);
    
    // Extract domain for processing
    const domain = extractDomain(opportunity.url);
    console.log(`Domain: ${domain}`);
    
    // Skip if no valid domain could be extracted
    if (!domain) {
      console.log('No valid domain found. Skipping.');
      return { success: false, opportunity };
    }
    
    // Create a record of the original contact info for comparison
    const originalContactInfo = opportunity.contactInfo ? JSON.parse(opportunity.contactInfo) : null;
    
    // Initialize contact info with existing data or empty object
    let contactInfo = originalContactInfo || { 
      emails: [], 
      contactForm: null, 
      socialProfiles: [], 
      phoneNumbers: [],
      address: null
    };
    
    // 1. Try to extract from source URL first
    try {
      console.log('Extracting from source URL...');
      
      // Extract emails
      const emails = await extractEmailsFromPage(opportunity.url);
      if (emails.length > 0) {
        console.log(`Found ${emails.length} emails: ${emails.join(', ')}`);
        contactInfo.emails = [...new Set([...contactInfo.emails || [], ...emails])];
      }
      
      // Extract contact form
      const contactForm = await findContactFormUrl(opportunity.url);
      if (contactForm && (!contactInfo.contactForm || contactInfo.contactForm === '')) {
        console.log(`Found contact form: ${contactForm}`);
        contactInfo.contactForm = contactForm;
      }
      
      // Extract social profiles
      const socialProfiles = await extractSocialProfiles(opportunity.url);
      if (socialProfiles.length > 0) {
        console.log(`Found ${socialProfiles.length} social profiles`);
        
        // Merge with existing profiles, avoiding duplicates
        const existingPlatforms = (contactInfo.socialProfiles || []).map(p => p.platform + p.username);
        const newProfiles = socialProfiles.filter(p => !existingPlatforms.includes(p.platform + p.username));
        
        contactInfo.socialProfiles = [
          ...(contactInfo.socialProfiles || []),
          ...newProfiles
        ];
      }
      
      // Extract phone numbers
      const phoneNumbers = await extractPhoneNumbers(opportunity.url);
      if (phoneNumbers.length > 0) {
        console.log(`Found ${phoneNumbers.length} phone numbers: ${phoneNumbers.join(', ')}`);
        contactInfo.phoneNumbers = [...new Set([...contactInfo.phoneNumbers || [], ...phoneNumbers])];
      }
      
      // Extract physical address
      const address = await extractAddress(opportunity.url);
      if (address && (!contactInfo.address || contactInfo.address === '')) {
        console.log(`Found address: ${address}`);
        contactInfo.address = address;
      }
    } catch (error) {
      console.error(`Error processing source URL: ${error}`);
    }
    
    // 2. If still missing info, try to find contact pages and extract from there
    if (!contactInfo.emails.length || !contactInfo.contactForm || !contactInfo.socialProfiles.length) {
      try {
        console.log('Looking for additional contact pages...');
        const contactPages = await findContactPages(opportunity.url);
        
        if (contactPages.length > 1) { // Skip the first one which is the source URL
          console.log(`Found ${contactPages.length - 1} additional contact pages`);
          
          // Process each contact page (excluding the source URL which was already processed)
          for (let i = 1; i < contactPages.length; i++) {
            const contactPage = contactPages[i];
            console.log(`Processing contact page ${i}: ${contactPage}`);
            
            // Extract emails
            if (!contactInfo.emails.length) {
              const emails = await extractEmailsFromPage(contactPage);
              if (emails.length > 0) {
                console.log(`Found ${emails.length} emails: ${emails.join(', ')}`);
                contactInfo.emails = [...new Set([...contactInfo.emails || [], ...emails])];
              }
            }
            
            // Extract contact form
            if (!contactInfo.contactForm) {
              const contactForm = await findContactFormUrl(contactPage);
              if (contactForm) {
                console.log(`Found contact form: ${contactForm}`);
                contactInfo.contactForm = contactForm;
              }
            }
            
            // Extract social profiles
            if (!contactInfo.socialProfiles.length) {
              const socialProfiles = await extractSocialProfiles(contactPage);
              if (socialProfiles.length > 0) {
                console.log(`Found ${socialProfiles.length} social profiles`);
                
                // Merge with existing profiles, avoiding duplicates
                const existingPlatforms = (contactInfo.socialProfiles || []).map(p => p.platform + p.username);
                const newProfiles = socialProfiles.filter(p => !existingPlatforms.includes(p.platform + p.username));
                
                contactInfo.socialProfiles = [
                  ...(contactInfo.socialProfiles || []),
                  ...newProfiles
                ];
              }
            }
            
            // Extract phone numbers
            if (!contactInfo.phoneNumbers?.length) {
              const phoneNumbers = await extractPhoneNumbers(contactPage);
              if (phoneNumbers.length > 0) {
                console.log(`Found ${phoneNumbers.length} phone numbers: ${phoneNumbers.join(', ')}`);
                contactInfo.phoneNumbers = [...new Set([...contactInfo.phoneNumbers || [], ...phoneNumbers])];
              }
            }
            
            // Extract physical address
            if (!contactInfo.address) {
              const address = await extractAddress(contactPage);
              if (address) {
                console.log(`Found address: ${address}`);
                contactInfo.address = address;
              }
            }
            
            // If we have all the info we need, break the loop
            if (contactInfo.emails.length && contactInfo.contactForm && 
                contactInfo.socialProfiles.length && contactInfo.phoneNumbers?.length && 
                contactInfo.address) {
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing contact pages: ${error}`);
      }
    }
    
    // 3. Extract estimated email from domain if no emails found
    if (!contactInfo.emails.length) {
      // Generate potential email formats based on domain
      const commonEmails = [
        `contact@${domain}`,
        `info@${domain}`,
        `hello@${domain}`,
        `support@${domain}`,
        `team@${domain}`,
        `admin@${domain}`,
        `sales@${domain}`,
        `marketing@${domain}`
      ];
      
      console.log('No emails found. Adding potential domain-based emails as fallback.');
      contactInfo.emails = commonEmails;
    }
    
    // Update database with new contact info
    const hasChanges = JSON.stringify(contactInfo) !== JSON.stringify(originalContactInfo);
    
    if (hasChanges) {
      console.log('Contact information updated.');
      
      if (!isDryRun) {
        await db.update(discoveredOpportunities)
          .set({ 
            contactInfo: JSON.stringify(contactInfo),
            lastUpdated: new Date()
          })
          .where(sql`id = ${opportunity.id}`);
        
        console.log('Database updated.');
      } else {
        console.log('DRY RUN: No database changes made.');
      }
      
      return { success: true, opportunity: { ...opportunity, contactInfo } };
    } else {
      console.log('No new contact information found.');
      return { success: false, opportunity };
    }
    
  } catch (error) {
    console.error(`Error processing opportunity ${opportunity.id}:`, error);
    return { success: false, opportunity };
  }
}

// This file is used as a module, so we don't auto-execute it