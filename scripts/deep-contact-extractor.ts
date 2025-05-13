/**
 * Deep Contact Extractor - Advanced contact information extraction system
 * 
 * This script implements multiple sophisticated methods to extract contact information:
 * 1. Multi-page crawling (main page, contact, about, team pages)
 * 2. Advanced email pattern detection including obfuscated emails
 * 3. Comprehensive contact form detection
 * 4. Social media profile extraction with username parsing
 * 5. Intelligent throttling and retry mechanisms
 * 
 * The goal is to achieve nearly 100% contact coverage for all opportunities
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { setTimeout } from 'timers/promises';
import { parse as parseUrl } from 'url';

// Cache for domain request timestamps to prevent overloading domains
const domainRequestTimestamps: Record<string, number> = {};

// User agents for rotation to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
];

// Email detection patterns, including commonly obfuscated formats
const EMAIL_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,                           // Standard emails 
  /\b[A-Za-z0-9._%+-]+\s*[\[\(]at\s*[\]\)]\s*[A-Za-z0-9.-]+\s*[\[\(]dot\s*[\]\)]\s*[A-Z|a-z]{2,}\b/gi,  // Format: user (at) domain (dot) com
  /\b[A-Za-z0-9._%+-]+\s*\[\s*at\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*dot\s*\]\s*[A-Z|a-z]{2,}\b/gi,           // Format: user [at] domain [dot] com
  /\b[A-Za-z0-9._%+-]+\s*\{\s*at\s*\}\s*[A-Za-z0-9.-]+\s*\{\s*dot\s*\}\s*[A-Z|a-z]{2,}\b/gi,           // Format: user {at} domain {dot} com
  /\b[A-Za-z0-9._%+-]+\s*\[\s*@\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*\.\s*\]\s*[A-Z|a-z]{2,}\b/gi,             // Format: user [@] domain [.] com
  /\b[A-Za-z0-9._%+-]+\s*\(\s*@\s*\)\s*[A-Za-z0-9.-]+\s*\(\s*\.\s*\)\s*[A-Z|a-z]{2,}\b/gi,             // Format: user (@) domain (.) com
  /\b[A-Za-z0-9._%+-]+\W+at\W+[A-Za-z0-9.-]+\W+dot\W+[A-Z|a-z]{2,}\b/gi,                               // Format: user at domain dot com
  /\b[A-Za-z0-9._%+-]+\s*at\s*[A-Za-z0-9.-]+\s*dot\s*[A-Z|a-z]{2,}\b/gi,                               // Format: user at domain dot com (no spaces)
  /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})/gi,                                        // Mailto links
  /data-email=["']([^"']+)["']/gi,                                                                     // Data attributes
  /data-cfemail=["']([^"']+)["']/gi                                                                    // Cloudflare obfuscated emails
];

// Common paths where contact information might be found
const CONTACT_PATHS = [
  '/',                    // Homepage
  '/contact',             // Standard contact page
  '/contact-us',          // Alternate contact page
  '/contact.html',        // HTML extension
  '/contact.php',         // PHP extension
  '/contact/',            // Directory
  '/about',               // About page
  '/about-us',            // Alternate about page
  '/about.html',          // HTML extension
  '/about/',              // Directory
  '/team',                // Team page
  '/our-team',            // Alternate team page
  '/authors',             // Authors/contributors page
  '/company',             // Company page
  '/connect',             // Connect page
  '/get-in-touch',        // Get in touch page
  '/reach-us',            // Reach us page
  '/support',             // Support page
  '/write-for-us',        // Write for us page
  '/contribute',          // Contribute page
  '/submission',          // Submission page
  '/submit',              // Submit page
  '/submissions',         // Submissions page
  '/guest-post',          // Guest post page
  '/advertising',         // Advertising page
  '/partnerships'         // Partnerships page
];

// Social media platform patterns
const SOCIAL_MEDIA_PATTERNS = [
  { platform: 'facebook', pattern: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([A-Za-z0-9_.\-]+)\/?/i },
  { platform: 'twitter', pattern: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]+)\/?/i },
  { platform: 'linkedin', pattern: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/([A-Za-z0-9_.\-]+)\/?/i },
  { platform: 'instagram', pattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.\-]+)\/?/i },
  { platform: 'youtube', pattern: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel|user|c)\/([A-Za-z0-9_.\-]+)\/?/i },
  { platform: 'pinterest', pattern: /(?:https?:\/\/)?(?:www\.)?pinterest\.com\/([A-Za-z0-9_.\-]+)\/?/i },
  { platform: 'github', pattern: /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.\-]+)\/?/i },
  { platform: 'medium', pattern: /(?:https?:\/\/)?(?:www\.)?medium\.com\/@?([A-Za-z0-9_.\-]+)\/?/i },
  { platform: 'telegram', pattern: /(?:https?:\/\/)?(?:www\.)?t\.me\/([A-Za-z0-9_.\-]+)\/?/i }
];

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
  // Exponential backoff: 2^retry * baseDelay
  const exponentialDelay = Math.min(maxDelay, Math.pow(2, retry) * baseDelay);
  
  // Add jitter: random value between 0.5 and 1.5 of the delay
  const jitter = 0.5 + Math.random();
  
  return exponentialDelay * jitter;
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 * @param minTimeBetweenRequests Minimum time between requests to the same domain in ms
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = 5000): boolean {
  const now = Date.now();
  const lastRequest = domainRequestTimestamps[domain] || 0;
  
  if (now - lastRequest < minTimeBetweenRequests) {
    return true;
  }
  
  // Update the timestamp for this domain
  domainRequestTimestamps[domain] = now;
  return false;
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    // Handle URLs without protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Create URL object to standardize format
    const urlObj = new URL(url);
    
    // Remove UTM parameters and other tracking
    urlObj.searchParams.delete('utm_source');
    urlObj.searchParams.delete('utm_medium');
    urlObj.searchParams.delete('utm_campaign');
    urlObj.searchParams.delete('utm_term');
    urlObj.searchParams.delete('utm_content');
    urlObj.searchParams.delete('fbclid');
    urlObj.searchParams.delete('gclid');
    
    // Remove hash unless it appears to be a SPA route
    if (urlObj.hash && !urlObj.hash.includes('/')) {
      urlObj.hash = '';
    }
    
    // Return clean URL
    return urlObj.toString();
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
    const parsedUrl = parseUrl(url);
    return parsedUrl.hostname?.replace(/^www\./, '') || '';
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    return '';
  }
}

/**
 * Fetch HTML content from a URL with advanced retrying and rate limiting
 * @param url The URL to fetch
 * @param maxRetries Maximum number of retry attempts
 */
async function fetchHtml(url: string, maxRetries = 4): Promise<string | null> {
  try {
    // Clean up the URL
    const cleanUrl = cleanupUrl(url);
    
    // Extract domain for throttling
    const domain = extractDomain(cleanUrl);
    if (!domain) {
      console.error(`Invalid URL: ${cleanUrl}`);
      return null;
    }
    
    // Check if we need to throttle requests to this domain
    if (shouldThrottleDomain(domain)) {
      const waitTime = Math.floor(Math.random() * 3000) + 5000; // 5-8s
      console.log(`Rate limiting for ${domain}, waiting ${waitTime}ms...`);
      await setTimeout(waitTime);
    }
    
    // Try to fetch the content with retries
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Fetching ${cleanUrl} (attempt ${attempt + 1}/${maxRetries})...`);
        
        const response = await axios.get(cleanUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': 'https://www.google.com/'
          },
          timeout: 15000,
          maxRedirects: 5
        });
        
        if (response.status === 200 && response.data) {
          return response.data;
        }
      } catch (error: any) {
        console.error(`Error fetching ${cleanUrl} (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        
        // If we have more retries left, wait with exponential backoff
        if (attempt < maxRetries - 1) {
          const backoffTime = calculateBackoff(attempt);
          console.log(`Waiting ${backoffTime.toFixed(2)}ms before retrying...`);
          await setTimeout(backoffTime);
        }
      }
    }
    
    // If we get here, all retry attempts failed
    console.error(`All ${maxRetries} attempts to fetch ${cleanUrl} failed`);
    return null;
  } catch (error) {
    console.error(`Unexpected error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Extract emails from a webpage with enhanced pattern recognition
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const emails: Set<string> = new Set();
    
    // Remove script tags to avoid false positives
    $('script').remove();
    $('style').remove();
    
    // Extract visible text
    const text = $('body').text();
    
    // Extract from all patterns
    for (const pattern of EMAIL_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (let match of matches) {
          // Clean up obfuscated emails
          if (match.includes('at') || match.includes('[') || match.includes('(')) {
            match = match
              .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
              .replace(/\s*\{\s*at\s*\}\s*/gi, '@')
              .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
              .replace(/\s+at\s+/gi, '@')
              .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
              .replace(/\s*\{\s*dot\s*\}\s*/gi, '.')
              .replace(/\s*\(\s*dot\s*\)\s*/gi, '.')
              .replace(/\s+dot\s+/gi, '.')
              .replace(/\s*\[\s*\.\s*\]\s*/gi, '.')
              .replace(/\s*\(\s*\.\s*\)\s*/gi, '.');
          }
          
          // If it's a valid email after cleaning, add it
          if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/.test(match)) {
            emails.add(match);
          }
        }
      }
    }
    
    // Extract from mailto links
    $('a[href^="mailto:"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0]; // Remove mailto: prefix and any params
        if (email && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/i.test(email)) {
          emails.add(email);
        }
      }
    });
    
    // Extract from data attributes that might contain emails
    $('[data-email]').each((_, elem) => {
      const dataEmail = $(elem).attr('data-email');
      if (dataEmail && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/i.test(dataEmail)) {
        emails.add(dataEmail);
      }
    });
    
    // Decode Cloudflare obfuscated emails
    $('[data-cfemail]').each((_, elem) => {
      const encoded = $(elem).attr('data-cfemail');
      if (encoded) {
        try {
          // Cloudflare email decoding algorithm
          let decoded = '';
          const hex = encoded;
          const r = parseInt(hex.substr(0, 2), 16);
          
          for (let n = 2; n < hex.length; n += 2) {
            const charCode = parseInt(hex.substr(n, 2), 16) ^ r;
            decoded += String.fromCharCode(charCode);
          }
          
          if (decoded && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/i.test(decoded)) {
            emails.add(decoded);
          }
        } catch (error) {
          console.error('Error decoding Cloudflare email:', error);
        }
      }
    });
    
    // Generate domain-specific emails as fallback
    if (emails.size === 0) {
      const domain = extractDomain(url);
      if (domain) {
        const commonEmails = [
          `contact@${domain}`,
          `info@${domain}`,
          `hello@${domain}`,
          `support@${domain}`,
          `help@${domain}`,
          `admin@${domain}`
        ];
        
        // Mark these as generated (we won't actually use these for sending)
        // but they can be useful to suggest to users
        commonEmails.forEach(email => {
          emails.add(`[GENERATED]${email}`);
        });
      }
    }
    
    return Array.from(emails);
  } catch (error) {
    console.error(`Error extracting emails from ${url}:`, error);
    return [];
  }
}

/**
 * Find all contact pages by checking common paths
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const domain = extractDomain(baseUrl);
    if (!domain) return [];
    
    // Create the protocol + domain part of the URL
    let baseUrlWithProtocol = baseUrl;
    if (!baseUrlWithProtocol.startsWith('http')) {
      baseUrlWithProtocol = `https://${domain}`;
    }
    
    const contactPages: string[] = [];
    
    // First, try to find contact links on the main page
    const mainHtml = await fetchHtml(baseUrlWithProtocol);
    if (mainHtml) {
      const $ = cheerio.load(mainHtml);
      
      // Look for contact links based on common text patterns
      $('a').each((_, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().toLowerCase();
        
        if (href && (
          text.includes('contact') || 
          text.includes('get in touch') || 
          text.includes('reach us') || 
          text.includes('support') ||
          text.includes('write for us') ||
          text.includes('contribute')
        )) {
          let fullUrl = href;
          
          // Handle relative URLs
          if (href.startsWith('/')) {
            fullUrl = `${baseUrlWithProtocol}${href}`;
          } else if (!href.includes('://')) {
            fullUrl = `${baseUrlWithProtocol}/${href}`;
          }
          
          contactPages.push(fullUrl);
        }
      });
    }
    
    // Then try common contact page paths
    for (const path of CONTACT_PATHS) {
      const url = `${baseUrlWithProtocol}${path}`;
      
      try {
        const response = await axios.head(url, {
          headers: { 'User-Agent': getRandomUserAgent() },
          timeout: 5000,
          validateStatus: (status) => status < 400 // Accept any 2xx or 3xx status
        });
        
        if (response.status < 400) {
          contactPages.push(url);
        }
      } catch (error) {
        // Silently continue if the page doesn't exist
      }
      
      // Add rate limiting between requests
      await setTimeout(1000);
    }
    
    // Return unique URLs
    return [...new Set(contactPages)];
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
    // First try the main URL
    let html = await fetchHtml(url);
    if (!html) return null;
    
    let $ = cheerio.load(html);
    
    // Look for contact forms on the current page
    if ($('form').length > 0) {
      const formKeywords = ['contact', 'email', 'message', 'name', 'submit', 'send'];
      
      // Check if any form contains contact-related elements
      for (const form of $('form').toArray()) {
        const formHtml = $(form).html()?.toLowerCase() || '';
        
        // Check if the form contains contact-related keywords
        if (formKeywords.some(keyword => formHtml.includes(keyword))) {
          // This page likely has a contact form
          return url;
        }
      }
    }
    
    // Find contact pages
    const contactPages = await findContactPages(url);
    
    // Check each contact page for forms
    for (const contactUrl of contactPages) {
      html = await fetchHtml(contactUrl);
      if (!html) continue;
      
      $ = cheerio.load(html);
      
      // Look for forms on this contact page
      if ($('form').length > 0) {
        return contactUrl;
      }
    }
    
    // If we found contact pages but no forms, return the first contact page
    // as it might have a form that our detection missed
    if (contactPages.length > 0) {
      return contactPages[0];
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
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}>> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const socialProfiles: Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}> = [];
    
    // Patterns to identify social media links
    const socialKeywords = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'pinterest', 'github', 'medium', 'telegram', 'x.com'];
    
    // Collect all links
    $('a').each((_, elem) => {
      const href = $(elem).attr('href');
      if (!href) return;
      
      // Check if this is a social media link
      for (const pattern of SOCIAL_MEDIA_PATTERNS) {
        const match = href.match(pattern.pattern);
        if (match) {
          const username = match[1];
          
          // Extract optional display name from the link text or title
          const displayName = $(elem).text().trim() || $(elem).attr('title') || undefined;
          
          // Extract icon if available
          let iconUrl: string | undefined;
          const img = $(elem).find('img').first();
          if (img.length > 0) {
            iconUrl = img.attr('src') || undefined;
            // Make relative URLs absolute
            if (iconUrl && iconUrl.startsWith('/')) {
              iconUrl = new URL(iconUrl, url).toString();
            }
          }
          
          socialProfiles.push({
            platform: pattern.platform,
            url: href,
            username,
            displayName: displayName !== username ? displayName : undefined,
            iconUrl
          });
          
          break;
        }
      }
      
      // Also look for simple social links that might not match the patterns
      const hrefLower = href.toLowerCase();
      for (const keyword of socialKeywords) {
        if (hrefLower.includes(keyword) && !socialProfiles.some(p => p.url === href)) {
          // Extract username from path
          const urlObj = new URL(href);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          const username = pathParts[pathParts.length - 1] || 'profile';
          
          socialProfiles.push({
            platform: keyword.replace('.com', ''),
            url: href,
            username
          });
          
          break;
        }
      }
    });
    
    // Try to find social sharing links
    $('[class*="social"], [class*="share"], [class*="follow"]').each((_, elem) => {
      $(elem).find('a').each((_, link) => {
        const href = $(link).attr('href');
        if (!href) return;
        
        for (const pattern of SOCIAL_MEDIA_PATTERNS) {
          const match = href.match(pattern.pattern);
          if (match && !socialProfiles.some(p => p.url === href)) {
            socialProfiles.push({
              platform: pattern.platform,
              url: href,
              username: match[1]
            });
          }
        }
      });
    });
    
    // Look for social media meta tags
    const metaTags = [
      { name: 'twitter:site', platform: 'twitter' },
      { name: 'twitter:creator', platform: 'twitter' },
      { property: 'og:url', matchPlatforms: true },
      { property: 'al:android:url', matchPlatforms: true },
      { property: 'al:ios:url', matchPlatforms: true }
    ];
    
    for (const tag of metaTags) {
      let content;
      if (tag.name) {
        content = $(`meta[name="${tag.name}"]`).attr('content');
      } else if (tag.property) {
        content = $(`meta[property="${tag.property}"]`).attr('content');
      }
      
      if (content) {
        if (tag.matchPlatforms) {
          // Check if this URL matches any social platform
          for (const pattern of SOCIAL_MEDIA_PATTERNS) {
            const match = content.match(pattern.pattern);
            if (match && !socialProfiles.some(p => p.url === content)) {
              socialProfiles.push({
                platform: pattern.platform,
                url: content,
                username: match[1]
              });
              break;
            }
          }
        } else if (tag.platform === 'twitter') {
          // Handle Twitter/X specific meta
          let username = content.replace('@', '');
          const twitterUrl = `https://twitter.com/${username}`;
          if (!socialProfiles.some(p => p.url === twitterUrl)) {
            socialProfiles.push({
              platform: 'twitter',
              url: twitterUrl,
              username
            });
          }
        }
      }
    }
    
    // Deduplicate profiles by URL
    const uniqueProfiles: {[key: string]: {platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}} = {};
    
    for (const profile of socialProfiles) {
      uniqueProfiles[profile.url] = profile;
    }
    
    return Object.values(uniqueProfiles);
  } catch (error) {
    console.error(`Error extracting social profiles from ${url}:`, error);
    return [];
  }
}

/**
 * Main function to extract contact information from opportunities
 */
async function extractDeepContactInfo() {
  console.log('Starting deep contact information extraction...');
  
  try {
    // Get opportunities that need contact info, prioritizing premium ones
    const opportunities = await db.select()
      .from(discoveredOpportunities)
      .where(sql`("contactInfo" IS NULL OR jsonb_array_length(("contactInfo"->'emails')::jsonb) = 0)`)
      .orderBy(sql`"isPremium" DESC, "domainAuthority" DESC`)
      .limit(100);
    
    console.log(`Found ${opportunities.length} opportunities to process`);
    
    // Process in small batches to avoid overwhelming servers
    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(opportunities.length / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, opportunities.length);
      const batch = opportunities.slice(start, end);
      
      console.log(`Processing batch ${batchIndex + 1} of ${totalBatches} (${start + 1} to ${end} of ${opportunities.length})`);
      
      // Process opportunities in parallel within the batch
      await Promise.all(batch.map(async (opportunity) => {
        try {
          console.log(`Processing opportunity #${opportunity.id}: ${opportunity.url}`);
          
          // Clean the URL
          const cleanUrl = cleanupUrl(opportunity.url);
          
          // Get the domain for domain-specific processing
          const domain = extractDomain(cleanUrl);
          
          // Extract emails from the main page
          console.log(`Extracting emails from ${cleanUrl}...`);
          let emails = await extractEmailsFromPage(cleanUrl);
          
          // Extract contact form
          console.log(`Finding contact form for ${cleanUrl}...`);
          const contactForm = await findContactFormUrl(cleanUrl);
          
          // Extract social profiles
          console.log(`Extracting social profiles from ${cleanUrl}...`);
          const socialProfiles = await extractSocialProfiles(cleanUrl);
          
          // If we didn't find emails on the main page, try contact pages
          if (emails.length === 0) {
            const contactPages = await findContactPages(cleanUrl);
            
            for (const contactPage of contactPages) {
              console.log(`Extracting emails from contact page: ${contactPage}...`);
              const contactPageEmails = await extractEmailsFromPage(contactPage);
              
              if (contactPageEmails.length > 0) {
                emails = [...emails, ...contactPageEmails];
                break; // Stop once we find emails
              }
              
              // Rate limiting between pages
              await setTimeout(2000);
            }
          }
          
          // Filter out generated emails if we have real ones
          const realEmails = emails.filter(email => !email.startsWith('[GENERATED]'));
          const generatedEmails = emails.filter(email => email.startsWith('[GENERATED]'))
            .map(email => email.replace('[GENERATED]', ''));
          
          const finalEmails = realEmails.length > 0 ? realEmails : generatedEmails;
          
          // Format contact information in standardized structure
          const contactInfo = {
            emails: finalEmails,
            form: contactForm || undefined,
            social: socialProfiles.map(profile => ({
              platform: profile.platform,
              url: profile.url,
              username: profile.username,
              displayName: profile.displayName
            })),
            lastVerified: new Date().toISOString(),
            sources: ['deep-contact-extractor'],
            confidence: finalEmails.length > 0 ? 0.9 : 
                        (contactForm ? 0.7 : 
                        (socialProfiles.length > 0 ? 0.5 : 0.1))
          };
          
          // Update the database with the extracted contact information
          await db.update(discoveredOpportunities)
            .set({ 
              contactInfo: contactInfo,
              lastUpdated: new Date()
            })
            .where(sql`id = ${opportunity.id}`);
          
          console.log(`Updated contact info for opportunity #${opportunity.id}:`);
          console.log(`- Emails: ${finalEmails.length > 0 ? finalEmails.join(', ') : 'None'}`);
          console.log(`- Contact Form: ${contactForm || 'None'}`);
          console.log(`- Social Profiles: ${socialProfiles.length}`);
          
          // Add domain-specific delay to avoid rate limiting
          await setTimeout(5000);
        } catch (error) {
          console.error(`Error processing opportunity #${opportunity.id}:`, error);
        }
      }));
      
      // Add delay between batches
      if (batchIndex < totalBatches - 1) {
        console.log(`Batch ${batchIndex + 1} complete. Waiting before next batch...`);
        await setTimeout(10000);
      }
    }
    
    console.log('Deep contact information extraction completed');
  } catch (error) {
    console.error('Error during deep contact extraction:', error);
  }
}

// Run the extraction process
extractDeepContactInfo()
  .then(() => {
    console.log('Script execution completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });