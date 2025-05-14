/**
 * Contact Coverage Improvement Script
 * 
 * This script combines multiple techniques to significantly improve
 * contact information extraction for both regular and premium opportunities.
 * 
 * It prioritizes premium opportunities but also processes regular ones
 * to meet our coverage targets:
 * - 65-80% overall contact information coverage
 * - 90-95% coverage for premium opportunities
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { parse as parseUrl } from 'url';
import { setTimeout } from 'timers/promises';
import * as fs from 'fs/promises';

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
  /data-cfemail=["']([^"']+)["']/gi,                                                                    // Cloudflare obfuscated emails
  /\b[A-Za-z0-9._%+-]+\s*&#64;\s*[A-Za-z0-9.-]+\s*&#46;\s*[A-Z|a-z]{2,}\b/gi,                          // HTML entity encoding
  /\b[A-Za-z0-9._%+-]+\s*&#x40;\s*[A-Za-z0-9.-]+\s*&#x2e;\s*[A-Z|a-z]{2,}\b/gi                         // HTML hex entity encoding
];

// Common contact page paths to check
const CONTACT_PATHS = [
  '/contact',
  '/contact-us',
  '/about/contact',
  '/about-us/contact',
  '/get-in-touch',
  '/reach-us',
  '/support',
  '/help',
  '/about',
  '/about-us',
  '/company',
  '/team',
  '/our-team',
  '/staff',
  '/write-for-us',
  '/contribute',
  '/contact.html',
  '/contact-us.html',
  '/about.html',
  '/about-us.html',
  '/team.html'
];

// Social media patterns for detection
const SOCIAL_MEDIA_PATTERNS = [
  { platform: 'linkedin', pattern: /linkedin\.com\/(?:company|in|profile)\/([^\/\?]+)/i },
  { platform: 'twitter', pattern: /(?:twitter|x)\.com\/([^\/\?]+)/i },
  { platform: 'facebook', pattern: /facebook\.com\/(?:pg\/)?([^\/\?]+)/i },
  { platform: 'instagram', pattern: /instagram\.com\/([^\/\?]+)/i },
  { platform: 'pinterest', pattern: /pinterest\.com\/([^\/\?]+)/i },
  { platform: 'youtube', pattern: /youtube\.com\/(?:c\/|channel\/|user\/)?([^\/\?]+)/i },
  { platform: 'github', pattern: /github\.com\/([^\/\?]+)/i },
  { platform: 'medium', pattern: /medium\.com\/@?([^\/\?]+)/i },
  { platform: 'reddit', pattern: /reddit\.com\/(?:r|u)\/([^\/\?]+)/i },
  { platform: 'discord', pattern: /discord\.(?:gg|com)\/([^\/\?]+)/i },
  { platform: 'telegram', pattern: /t\.me\/([^\/\?]+)/i },
  { platform: 'tiktok', pattern: /tiktok\.com\/@([^\/\?]+)/i }
];

// Configuration
const BATCH_SIZE = 20;  // How many opportunities to process in parallel
const MAX_RETRIES = 3;  // Maximum retry attempts for failed requests
const THROTTLE_DELAY = 5000;  // Minimum time between requests to the same domain
const REQUEST_TIMEOUT = 10000;  // Timeout for HTTP requests

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

/**
 * Calculate exponential backoff with jitter for smarter retries
 * @param retry The current retry attempt number
 * @param baseDelay The base delay in milliseconds
 * @param maxDelay The maximum delay in milliseconds
 */
function calculateBackoff(retry: number, baseDelay = 1000, maxDelay = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, retry), maxDelay);
  const jitter = delay * 0.2 * Math.random();
  return delay + jitter;
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 * @param minTimeBetweenRequests Minimum time between requests to the same domain in ms
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = THROTTLE_DELAY): boolean {
  const now = Date.now();
  const lastRequestTime = domainRequestTimestamps[domain] || 0;
  
  if (now - lastRequestTime < minTimeBetweenRequests) {
    return true;
  }
  
  domainRequestTimestamps[domain] = now;
  return false;
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    if (!url.includes('://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    
    // Ensure protocol is https unless explicitly http
    if (urlObj.protocol === 'http:' && !url.startsWith('http://')) {
      urlObj.protocol = 'https:';
    }
    
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
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  try {
    // Clean up the URL
    const cleanUrl = cleanupUrl(url);
    
    // Extract domain for throttling
    const domain = extractDomain(cleanUrl);
    if (!domain) {
      console.error(`Invalid URL: ${cleanUrl}`);
      return null;
    }
    
    // Implement domain-based throttling
    if (shouldThrottleDomain(domain)) {
      // Wait before making the request
      const waitTime = THROTTLE_DELAY;
      console.log(`Throttling request to ${domain}, waiting ${waitTime}ms...`);
      await setTimeout(waitTime);
    }
    
    // Try to fetch the page with retries
    let lastError: any = null;
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        // If this is a retry, wait with backoff
        if (retry > 0) {
          const backoff = calculateBackoff(retry);
          console.log(`Retry ${retry}/${maxRetries} for ${cleanUrl}, waiting ${Math.round(backoff)}ms...`);
          await setTimeout(backoff);
        }
        
        // Make the request with a random user agent
        const response = await axios.get(cleanUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: REQUEST_TIMEOUT,
          maxRedirects: 5
        });
        
        return response.data;
      } catch (error: any) {
        lastError = error;
        
        // If we've reached our retry limit, or it's a 404/403/4xx error, stop retrying
        if (retry >= maxRetries || (error.response && error.response.status >= 400 && error.response.status < 500)) {
          break;
        }
      }
    }
    
    // If we get here, all retries failed
    const errorMessage = lastError.response 
      ? `HTTP ${lastError.response.status}` 
      : lastError.message || 'Unknown error';
    console.error(`Failed to fetch ${cleanUrl}: ${errorMessage}`);
    return null;
  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error.message);
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
    
    const emails: string[] = [];
    
    // Try all email patterns
    for (const pattern of EMAIL_PATTERNS) {
      const matches = html.match(pattern);
      if (matches) {
        for (let match of matches) {
          // Clean up and normalize the email
          let email = match;
          
          // Handle mailto: links
          if (email.startsWith('mailto:')) {
            email = email.substring(7);
          }
          
          // Handle HTML entities
          email = email.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
          email = email.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
          
          // Handle obfuscated emails
          email = email
            .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
            .replace(/\s*\{\s*at\s*\}\s*/gi, '@')
            .replace(/\s*\(\s*at\s*\)\s*/gi, '@')
            .replace(/\s+at\s+/gi, '@')
            .replace(/\s*\[\s*dot\s*\]\s*/gi, '.')
            .replace(/\s*\{\s*dot\s*\}\s*/gi, '.')
            .replace(/\s*\(\s*dot\s*\)\s*/gi, '.')
            .replace(/\s+dot\s+/gi, '.');
          
          // Validate it looks like an email
          if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
            // Convert to lowercase and add if unique
            email = email.toLowerCase();
            if (!emails.includes(email)) {
              emails.push(email);
            }
          }
        }
      }
    }
    
    // Filter out generic emails
    return emails.filter(email => {
      const lowercaseEmail = email.toLowerCase();
      // Filter out common no-reply and generic emails
      return !(
        lowercaseEmail.includes('noreply') ||
        lowercaseEmail.includes('no-reply') ||
        lowercaseEmail.includes('donotreply') ||
        lowercaseEmail.includes('do-not-reply') ||
        lowercaseEmail.includes('example.com') ||
        lowercaseEmail.includes('yourname') ||
        lowercaseEmail.includes('your-name') ||
        lowercaseEmail.includes('your.name')
      );
    });
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
    // Clean up base URL
    const cleanBaseUrl = cleanupUrl(baseUrl);
    
    // Extract domain and protocol
    const urlObj = new URL(cleanBaseUrl);
    const baseProtocol = urlObj.protocol;
    const baseDomain = urlObj.hostname;
    const baseUrlWithProtocol = `${baseProtocol}//${baseDomain}`;
    
    // Initialize contact page list
    const contactPages: string[] = [];
    
    // First try to find contact links on the base page
    const html = await fetchHtml(cleanBaseUrl);
    if (html) {
      // Load the HTML into cheerio
      const $ = cheerio.load(html);
      
      // Find links containing keywords related to contact pages
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().toLowerCase();
        
        if (href && (
          href.includes('contact') || 
          href.includes('about') || 
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
    const html = await fetchHtml(url);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    
    // Look for forms with keywords in action, id, or class
    const contactForm = $('form').filter((_, form) => {
      const action = $(form).attr('action') || '';
      const id = $(form).attr('id') || '';
      const className = $(form).attr('class') || '';
      
      return (
        action.toLowerCase().includes('contact') ||
        action.toLowerCase().includes('message') ||
        action.toLowerCase().includes('feedback') ||
        id.toLowerCase().includes('contact') ||
        id.toLowerCase().includes('message') ||
        id.toLowerCase().includes('feedback') ||
        className.toLowerCase().includes('contact') ||
        className.toLowerCase().includes('message') ||
        className.toLowerCase().includes('feedback')
      );
    });
    
    if (contactForm.length > 0) {
      // Get the form's action URL
      const action = contactForm.first().attr('action');
      if (action) {
        // Handle relative URLs
        if (action.startsWith('/')) {
          const urlObj = new URL(url);
          return `${urlObj.protocol}//${urlObj.hostname}${action}`;
        } else if (!action.includes('://')) {
          const urlObj = new URL(url);
          return `${urlObj.protocol}//${urlObj.hostname}/${action}`;
        }
        return action;
      }
      
      // If no action, return the current URL (form submits to same page)
      return url;
    }
    
    // If no form found on main page, look for links to contact pages
    const contactLink = $('a').filter((_, link) => {
      const href = $(link).attr('href') || '';
      const text = $(link).text().toLowerCase();
      
      return (
        text.includes('contact') ||
        text.includes('get in touch') ||
        text.includes('reach out') ||
        href.includes('contact') ||
        href.includes('touch')
      );
    });
    
    if (contactLink.length > 0) {
      const href = contactLink.first().attr('href');
      if (href) {
        // Handle relative URLs
        if (href.startsWith('/')) {
          const urlObj = new URL(url);
          return `${urlObj.protocol}//${urlObj.hostname}${href}`;
        } else if (!href.includes('://')) {
          const urlObj = new URL(url);
          return `${urlObj.protocol}//${urlObj.hostname}/${href}`;
        }
        return href;
      }
    }
    
    // Check if this is already a contact page by analyzing URL and content
    const urlObj = new URL(url);
    if (
      urlObj.pathname.includes('contact') ||
      $('title').text().toLowerCase().includes('contact') ||
      $('h1').text().toLowerCase().includes('contact') ||
      $('body').text().toLowerCase().includes('contact us') ||
      $('body').text().toLowerCase().includes('get in touch')
    ) {
      return url;
    }
    
    // If we're on the main page, check common contact page paths
    if (urlObj.pathname === '/' || urlObj.pathname === '') {
      const protocol = urlObj.protocol;
      const domain = urlObj.hostname;
      
      // Try common contact paths
      return await checkCommonContactPaths(protocol, domain, CONTACT_PATHS);
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding contact form for ${url}:`, error);
    return null;
  }
}

async function checkCommonContactPaths(protocol: string, domain: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const contactUrl = `${protocol}//${domain}${path}`;
    
    try {
      const response = await axios.head(contactUrl, {
        headers: { 'User-Agent': getRandomUserAgent() },
        timeout: 5000,
        validateStatus: (status) => status < 400
      });
      
      if (response.status < 400) {
        return contactUrl;
      }
    } catch (error) {
      // Continue checking other paths
    }
    
    // Small delay to avoid overwhelming the server
    await setTimeout(1000);
  }
  
  return null;
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
    
    // Find social media links in the footer, header, and navigation areas
    $('footer a, header a, nav a').each((_, link) => {
      const href = $(link).attr('href');
      if (!href) return;
      
      // Check against all social media patterns
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
          // Handle Twitter specifically
          let username = content.replace('@', '');
          const twitterUrl = `https://twitter.com/${username}`;
          
          if (!socialProfiles.some(p => p.platform === 'twitter')) {
            socialProfiles.push({
              platform: 'twitter',
              url: twitterUrl,
              username
            });
          }
        }
      }
    }
    
    // Look for schema.org structured data about social profiles
    const scriptTags = $('script[type="application/ld+json"]');
    scriptTags.each((_, script) => {
      try {
        const jsonContent = $(script).html();
        if (!jsonContent) return;
        
        const data = JSON.parse(jsonContent);
        
        // Check for sameAs property which often contains social links
        const sameAsLinks = data.sameAs || (data['@graph'] && data['@graph'][0] && data['@graph'][0].sameAs);
        
        if (Array.isArray(sameAsLinks)) {
          for (const link of sameAsLinks) {
            if (typeof link === 'string') {
              for (const pattern of SOCIAL_MEDIA_PATTERNS) {
                const match = link.match(pattern.pattern);
                if (match && !socialProfiles.some(p => p.url === link)) {
                  socialProfiles.push({
                    platform: pattern.platform,
                    url: link,
                    username: match[1]
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    return socialProfiles;
  } catch (error) {
    console.error(`Error extracting social profiles from ${url}:`, error);
    return [];
  }
}

/**
 * Configuration options for the contact coverage process
 */
interface ContactCoverageConfig {
  isDryRun?: boolean;
  premiumOnly?: boolean;
  batchSize?: number;
}

/**
 * Main function to improve contact information coverage
 * @param config Configuration options for the contact coverage process
 */
export async function increaseContactCoverage(config: ContactCoverageConfig | boolean = {}) {
  // For backward compatibility, if a boolean is passed, assume it's isDryRun
  const isDryRun = typeof config === 'boolean' ? config : config.isDryRun ?? false;
  const premiumOnly = typeof config === 'boolean' ? false : config.premiumOnly ?? false;
  const batchSize = typeof config === 'boolean' ? BATCH_SIZE : config.batchSize ?? BATCH_SIZE;
  try {
    console.log('Starting contact information coverage improvement process...');
    
    // First, get stats on current coverage
    const [currentStats] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as with_contact,
        SUM(CASE WHEN "isPremium" = true THEN 1 ELSE 0 END) as premium_total,
        SUM(CASE WHEN "isPremium" = true AND "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as premium_with_contact
      FROM "discoveredOpportunities"
    `);
    
    console.log('Current contact information coverage:');
    console.log(`- Total opportunities: ${currentStats.total}`);
    console.log(`- With contact info: ${currentStats.with_contact} (${((currentStats.with_contact / currentStats.total) * 100).toFixed(1)}%)`);
    console.log(`- Premium opportunities: ${currentStats.premium_total}`);
    console.log(`- Premium with contact info: ${currentStats.premium_with_contact} (${((currentStats.premium_with_contact / currentStats.premium_total) * 100).toFixed(1)}%)`);
    
    // First priority: Process premium opportunities without contact info
    console.log('\nProcessing premium opportunities without contact info...');
    
    const premiumOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"isPremium" = true AND ("contactInfo" IS NULL OR "contactInfo" = '[]' OR "contactInfo" = '{}')`);
    
    console.log(`Found ${premiumOpportunities.length} premium opportunities without contact info`);
    
    if (premiumOpportunities.length > 0) {
      // Process in batches to avoid overwhelming servers
      const totalPremiumBatches = Math.ceil(premiumOpportunities.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalPremiumBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, premiumOpportunities.length);
        const batch = premiumOpportunities.slice(start, end);
        
        console.log(`Processing premium batch ${batchIndex + 1} of ${totalPremiumBatches} (${start + 1} to ${end} of ${premiumOpportunities.length})`);
        
        // Process opportunities in sequence with enhanced extraction
        for (const opportunity of batch) {
          await processOpportunity(opportunity, true, isDryRun); // true = premium opportunity
          
          // Add a small delay between opportunities
          await setTimeout(1000);
        }
        
        // Add a delay between batches
        if (batchIndex < totalPremiumBatches - 1) {
          console.log('Waiting between premium batches...');
          await setTimeout(5000);
        }
      }
    }
    
    // Second priority: Process regular opportunities without contact info
    // Skip if premiumOnly is true
    if (premiumOnly) {
      console.log('\nSkipping regular opportunities (premium-only mode enabled)');
    } else {
      // Limit this to a reasonable number to avoid excessive resource usage
      console.log('\nProcessing regular opportunities without contact info...');
      
      const regularOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(sql`"isPremium" = false AND ("contactInfo" IS NULL OR "contactInfo" = '[]' OR "contactInfo" = '{}')`);
      
      console.log(`Found ${regularOpportunities.length} regular opportunities without contact info`);
      
      // Determine how many we need to process to reach target coverage
      const targetRegularCoverage = 0.65; // 65% target for regular opportunities
      const currentRegularTotal = currentStats.total - currentStats.premium_total;
      const currentRegularWithContact = currentStats.with_contact - currentStats.premium_with_contact;
      const currentRegularCoverage = currentRegularWithContact / currentRegularTotal;
      
      if (currentRegularCoverage < targetRegularCoverage) {
        const neededAdditional = Math.ceil(targetRegularCoverage * currentRegularTotal - currentRegularWithContact);
        const toProcess = Math.min(neededAdditional, regularOpportunities.length);
        
        console.log(`Need to add contact info to ${neededAdditional} regular opportunities to reach ${(targetRegularCoverage * 100).toFixed(1)}% coverage`);
        console.log(`Will process ${toProcess} opportunities`);
        
        if (toProcess > 0) {
          // Select a subset to process
          const opportunitiesToProcess = regularOpportunities.slice(0, toProcess);
          
          // Process in batches
        const totalRegularBatches = Math.ceil(opportunitiesToProcess.length / batchSize);
        
        for (let batchIndex = 0; batchIndex < totalRegularBatches; batchIndex++) {
          const start = batchIndex * batchSize;
          const end = Math.min(start + batchSize, opportunitiesToProcess.length);
          const batch = opportunitiesToProcess.slice(start, end);
          
          console.log(`Processing regular batch ${batchIndex + 1} of ${totalRegularBatches} (${start + 1} to ${end} of ${opportunitiesToProcess.length})`);
          
          // Process opportunities in sequence
          for (const opportunity of batch) {
            await processOpportunity(opportunity, false, isDryRun); // false = regular opportunity
            
            // Add a small delay between opportunities
            await setTimeout(1000);
          }
          
          // Add a delay between batches
          if (batchIndex < totalRegularBatches - 1) {
            console.log('Waiting between regular batches...');
            await setTimeout(5000);
          }
        }
      }
    } else {
      console.log(`Current regular coverage (${(currentRegularCoverage * 100).toFixed(1)}%) already meets target of ${(targetRegularCoverage * 100).toFixed(1)}%`);
    }
    
    // Final stats
    const [finalStats] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as with_contact,
        SUM(CASE WHEN "isPremium" = true THEN 1 ELSE 0 END) as premium_total,
        SUM(CASE WHEN "isPremium" = true AND "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as premium_with_contact
      FROM "discoveredOpportunities"
    `);
    
    console.log('\nFinal contact information coverage:');
    console.log(`- Total opportunities: ${finalStats.total}`);
    console.log(`- With contact info: ${finalStats.with_contact} (${((finalStats.with_contact / finalStats.total) * 100).toFixed(1)}%)`);
    console.log(`- Premium opportunities: ${finalStats.premium_total}`);
    console.log(`- Premium with contact info: ${finalStats.premium_with_contact} (${((finalStats.premium_with_contact / finalStats.premium_total) * 100).toFixed(1)}%)`);
    
    console.log('Contact information coverage improvement process completed!');
  } catch (error) {
    console.error('Error during contact information coverage improvement:', error);
  }
}

/**
 * Process a single opportunity to extract and update contact information
 * @param opportunity The opportunity to process
 * @param isPremium Whether this is a premium opportunity
 * @param isDryRun If true, no actual database updates will be performed
 */
async function processOpportunity(opportunity: any, isPremium: boolean, isDryRun = false) {
  try {
    console.log(`Processing opportunity #${opportunity.id}: ${opportunity.url} (${isPremium ? 'Premium' : 'Regular'})`);
    
    // Clean the URL
    const cleanUrl = cleanupUrl(opportunity.url);
    
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
      
      console.log(`Found ${contactPages.length} potential contact pages`);
      
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
    
    // Prepare contact information
    const contactInfo = {
      emails: emails,
      contactForm: contactForm,
      socialProfiles: socialProfiles
    };
    
    // Only update if we found any contact information
    if (emails.length > 0 || contactForm || socialProfiles.length > 0) {
      console.log(`Updating opportunity #${opportunity.id} with contact information:`, {
        emails: emails.length > 0 ? `${emails.length} emails found` : 'None',
        contactForm: contactForm ? 'Found' : 'None',
        socialProfiles: socialProfiles.length > 0 ? `${socialProfiles.length} profiles found` : 'None'
      });
      
      // Update the opportunity in the database
      if (!isDryRun) {
        await db.update(discoveredOpportunities)
          .set({
            contactInfo: contactInfo
          })
          .where(eq(discoveredOpportunities.id, opportunity.id));
      } else {
        console.log(`[DRY RUN] Would update opportunity #${opportunity.id} with contact information`);
      }
      
      return true;
    } else {
      console.log(`No contact information found for opportunity #${opportunity.id}`);
      return false;
    }
  } catch (error) {
    console.error(`Error processing opportunity #${opportunity.id}:`, error);
    return false;
  }
}

// For ESM modules we can't use require.main, but we can use import.meta.url
// We don't need this for now since we're running the script directly from run-contact-coverage-improvement.ts