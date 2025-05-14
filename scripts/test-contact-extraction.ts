/**
 * Test Contact Extraction Script
 * 
 * This script tests the contact extraction on a single opportunity
 * to verify the extraction process without processing the entire database.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq, or, and, isNull, ne } from "drizzle-orm";
import * as cheerio from 'cheerio';
import axios from 'axios';

// Configuration constants
const MAX_RETRIES = 3;
const THROTTLE_DELAY = 1500; // Default throttle delay between requests to the same domain (ms)
const CONTACT_PAGE_DELAY = 1000; // Delay between checking contact pages (ms)
const REQUEST_TIMEOUT = 10000; // Timeout for HTTP requests (ms)
const MAX_EXECUTION_TIME = 180000; // Maximum execution time (ms) - 3 minutes

// Map to track domain request times to prevent rate limiting
const domainRequestTimes: Map<string, number> = new Map();

// Common user agent strings for browser simulation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
];

// Common social media platforms to look for
const socialPlatforms = [
  { name: 'LinkedIn', domain: 'linkedin.com', pattern: /linkedin\.com\/(?:company|in|profile)\/([^\/\?]+)/ },
  { name: 'Twitter', domain: 'twitter.com', pattern: /twitter\.com\/([^\/\?]+)/ },
  { name: 'Facebook', domain: 'facebook.com', pattern: /facebook\.com\/([^\/\?]+)/ },
  { name: 'Instagram', domain: 'instagram.com', pattern: /instagram\.com\/([^\/\?]+)/ },
  { name: 'YouTube', domain: 'youtube.com', pattern: /youtube\.com\/(?:channel|user|c)\/([^\/\?]+)/ },
  { name: 'GitHub', domain: 'github.com', pattern: /github\.com\/([^\/\?]+)/ },
  { name: 'Medium', domain: 'medium.com', pattern: /medium\.com\/(@[^\/\?]+)/ }
];

/**
 * Promisified setTimeout
 */
function setTimeout(ms: number): Promise<void> {
  return new Promise(resolve => global.setTimeout(resolve, ms));
}

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
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, retry), maxDelay);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return exponentialDelay + jitter;
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 * @param minTimeBetweenRequests Minimum time between requests to the same domain in ms
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = THROTTLE_DELAY): boolean {
  // Extract the root domain to avoid subdomains bypassing throttling
  const rootDomain = extractRootDomain(domain);
  
  const lastRequestTime = domainRequestTimes.get(rootDomain);
  if (!lastRequestTime) return false;
  
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  return timeSinceLastRequest < minTimeBetweenRequests;
}

/**
 * Extract root domain from a domain name
 * This helps prevent different subdomains of the same site from bypassing throttling
 */
function extractRootDomain(domain: string): string {
  try {
    const parts = domain.split('.');
    
    // Special cases for known domains with secondary TLDs
    if (parts.length > 2) {
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];
      
      // Handle cases like .co.uk, .com.au, etc.
      if ((secondLastPart === 'co' || secondLastPart === 'com' || secondLastPart === 'org' || 
           secondLastPart === 'net' || secondLastPart === 'gov' || secondLastPart === 'edu') && 
          lastPart.length <= 3) {
        // If we have enough parts, return the actual domain
        if (parts.length > 3) {
          return `${parts[parts.length - 3]}.${secondLastPart}.${lastPart}`;
        }
      }
    }
    
    // Default case: use the last two parts of the domain
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    
    // Fallback
    return domain;
  } catch (error) {
    console.warn(`Error extracting root domain from ${domain}: ${error.message}`);
    return domain;
  }
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    // Add https:// if no protocol is present
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    return urlObj.toString();
  } catch (error) {
    console.warn(`Error cleaning up URL ${url}: ${error.message}`);
    return url;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    // Ensure URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    return new URL(url).hostname;
  } catch (error) {
    // If URL parsing fails, try a simple regex extraction
    console.warn(`Failed to extract domain from URL: ${url} using URL constructor, falling back to regex`);
    const domainMatch = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/im);
    return domainMatch ? domainMatch[1] : url;
  }
}

/**
 * Fetch HTML content from a URL with advanced retrying and rate limiting
 * @param url The URL to fetch
 * @param maxRetries Maximum number of retry attempts
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  const domain = extractDomain(url);
  
  // Check if we need to throttle requests to this domain
  if (shouldThrottleDomain(domain)) {
    const waitTime = THROTTLE_DELAY;
    console.log(`Rate limiting for ${domain}, waiting ${waitTime}ms before next request`);
    await setTimeout(waitTime);
  }
  
  // Record this request time for the root domain to prevent subdomains from bypassing throttling
  const rootDomain = extractRootDomain(domain);
  domainRequestTimes.set(rootDomain, Date.now());
  
  // Try to handle 404 errors - check if it's a URL with query parameters
  // and try the base URL instead
  let urlsToTry = [url];
  try {
    const urlObj = new URL(url);
    if (urlObj.search) {
      // Add the base URL without query parameters as a fallback
      urlsToTry.push(`${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`);
    }
  } catch (e) {
    // Invalid URL, just use the original
  }
  
  // Try all URL variations
  for (const currentUrl of urlsToTry) {
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        const response = await axios.get(currentUrl, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
          },
          timeout: REQUEST_TIMEOUT,
          maxRedirects: 5
        });
        
        if (response.status === 200) {
          return response.data;
        }
      } catch (error) {
        if (retry === maxRetries) {
          console.error(`Failed to fetch ${currentUrl} after ${maxRetries} retries:`, error.message);
          
          // If this is the last URL to try, we'll return null after the loop
          if (currentUrl === urlsToTry[urlsToTry.length - 1]) {
            break;
          } else {
            // If there are more URLs to try, break out of the retry loop for this URL
            break;
          }
        }
        
        // Handle specific error types differently
        if (error.response && error.response.status === 404) {
          // For 404 errors, stop retrying this specific URL variation immediately
          console.log(`URL returned 404 not found: ${currentUrl}, trying next fallback if available`);
          break;
        } else if (error.code === 'ECONNABORTED' || (error.response && error.response.status === 429)) {
          // For timeouts and rate limiting, use longer delays
          const extendedDelay = calculateBackoff(retry) * 1.5;
          console.log(`Rate limiting or timeout detected for ${currentUrl} (attempt ${retry + 1}/${maxRetries}). Using extended backoff of ${Math.round(extendedDelay / 1000)}s...`);
          await setTimeout(extendedDelay);
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          // For connection refused or host not found, might be a permanent issue
          console.error(`Connection refused or host not found for ${currentUrl}: ${error.message}`);
          // Try the next URL variation if available
          break;
        } else {
          // For all other errors, use standard backoff
          const backoffTime = calculateBackoff(retry);
          console.log(`Retry ${retry + 1}/${maxRetries} for ${currentUrl} due to ${error.message}. Waiting ${Math.round(backoffTime / 1000)}s...`);
          await setTimeout(backoffTime);
        }
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
  
  const emails: string[] = [];
  
  // Extract visible emails
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = html.match(emailRegex);
  
  if (matches) {
    // Process and deduplicate
    const uniqueEmails = [...new Set(matches)]
      .filter(email => {
        // Filter out common false positives
        return !email.includes('example.com') && 
               !email.includes('domain.com') && 
               !email.includes('yourdomain') && 
               !email.includes('email@');
      });
    
    emails.push(...uniqueEmails);
  }
  
  // Check for obfuscated emails - common pattern is to replace @ with text
  const obfuscatedPattern = /[A-Za-z0-9._%+-]+\s*[\[\(]at[\]\)]\s*[A-Za-z0-9.-]+\s*[\[\(]dot[\]\)]\s*[A-Z|a-z]{2,}/g;
  const obfuscatedMatches = html.match(obfuscatedPattern);
  
  if (obfuscatedMatches) {
    obfuscatedMatches.forEach(match => {
      // Convert [at] and [dot] to @ and .
      const email = match.replace(/\s*[\[\(]at[\]\)]\s*/i, '@').replace(/\s*[\[\(]dot[\]\)]\s*/gi, '.');
      if (!emails.includes(email)) {
        emails.push(email);
      }
    });
  }
  
  // Parse DOM for additional emails that might be in mailto links
  try {
    const $ = cheerio.load(html);
    $('a[href^="mailto:"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.startsWith('mailto:')) {
        const email = href.substring(7).split('?')[0].trim();
        if (email && !emails.includes(email) && email.includes('@')) {
          emails.push(email);
        }
      }
    });
  } catch (error) {
    console.error(`Error parsing HTML for mailto links: ${error.message}`);
  }
  
  return emails.filter(email => email.includes('@'));
}

/**
 * Find all contact pages by checking common paths
 */
async function findContactPages(baseUrl: string, startTime = Date.now()): Promise<string[]> {
  let url = baseUrl;
  
  // Check if we've exceeded the max execution time
  if (Date.now() - startTime > MAX_EXECUTION_TIME) {
    console.log('Maximum execution time reached in findContactPages, returning partial results');
    return [];
  }
  
  // Ensure baseUrl has a protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    // Extract protocol and domain
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const domain = urlObj.hostname;
    
    // Common paths to check - prioritize the most important ones first
    const contactPaths = [
      '/contact', 
      '/contact-us',
      '/about/contact',
      '/reach-us',
      '/connect',
      '/get-in-touch',
      '/about', 
      '/about-us'
    ];
    
    const contactPages: string[] = [];
    
    // First check the main page for links to contact pages
    const mainHtml = await fetchHtml(url);
    if (mainHtml) {
      try {
        const $ = cheerio.load(mainHtml);
        $('a').each((_, element) => {
          // Check again for execution time to prevent long-running loops
          if (Date.now() - startTime > MAX_EXECUTION_TIME) return;
          
          const href = $(element).attr('href');
          const text = $(element).text().toLowerCase();
          
          if (!href) return;
          
          const isContactLink = 
            text.includes('contact') || 
            text.includes('get in touch') || 
            text.includes('reach us') || 
            text.includes('connect with us');
          
          if (isContactLink) {
            let contactUrl = href;
            
            // Handle relative URLs
            if (href.startsWith('/')) {
              contactUrl = `${protocol}//${domain}${href}`;
            } else if (!href.startsWith('http')) {
              contactUrl = `${protocol}//${domain}/${href}`;
            }
            
            // Ensure it's from the same domain for security and relevance
            if (extractDomain(contactUrl) === domain && !contactPages.includes(contactUrl)) {
              contactPages.push(contactUrl);
            }
          }
        });
      } catch (error) {
        console.error(`Error parsing main page HTML: ${error.message}`);
      }
    }
    
    // Check if we've already found contact pages from the main page links
    if (contactPages.length >= 2) {
      console.log(`Found ${contactPages.length} contact pages from main page links, skipping common paths check`);
      return contactPages;
    }
    
    // Then check common paths (limited to save time)
    const pathsToCheck = contactPages.length === 0 ? contactPaths : contactPaths.slice(0, 3);
    
    for (const path of pathsToCheck) {
      // Check if we've exceeded the max execution time
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        console.log('Maximum execution time reached when checking contact paths, returning partial results');
        return contactPages;
      }
      
      const contactUrl = `${protocol}//${domain}${path}`;
      if (!contactPages.includes(contactUrl)) {
        const html = await fetchHtml(contactUrl);
        if (html) {
          contactPages.push(contactUrl);
        }
        
        // Add a small delay between requests to avoid rate limiting
        await setTimeout(CONTACT_PAGE_DELAY);
      }
    }
    
    return contactPages;
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}: ${error.message}`);
    return [];
  }
}

/**
 * Find a contact form URL on a website with improved detection
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  // Normalize the URL
  let baseUrl = url;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  
  try {
    // Extract domain and protocol
    const urlObj = new URL(baseUrl);
    const protocol = urlObj.protocol;
    const domain = urlObj.hostname;
    
    // Check the current URL for a contact form first
    const html = await fetchHtml(baseUrl);
    if (html) {
      const $ = cheerio.load(html);
      const hasForm = $('form').length > 0;
      
      // Check if the current page has a contact form based on text content
      const pageText = $('body').text().toLowerCase();
      const isContactPage = 
        pageText.includes('contact us') || 
        pageText.includes('get in touch') || 
        pageText.includes('send us a message') ||
        pageText.includes('send a message');
      
      if (hasForm && isContactPage) {
        return baseUrl;
      }
    }
    
    // Check common contact page paths
    const paths = [
      '/contact', 
      '/contact-us', 
      '/reach-us', 
      '/get-in-touch',
      '/connect'
    ];
    
    return await checkCommonContactPaths(protocol, domain, paths);
  } catch (error) {
    console.error(`Error finding contact form for ${url}: ${error.message}`);
    return null;
  }
}

async function checkCommonContactPaths(protocol: string, domain: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const contactUrl = `${protocol}//${domain}${path}`;
    const html = await fetchHtml(contactUrl);
    
    if (html) {
      try {
        const $ = cheerio.load(html);
        if ($('form').length > 0) {
          return contactUrl;
        }
      } catch (error) {
        console.error(`Error parsing HTML for contact form: ${error.message}`);
      }
    }
    
    // Add a small delay between requests
    await setTimeout(CONTACT_PAGE_DELAY);
  }
  
  return null;
}

/**
 * Extract social profiles from a page with enhanced detection
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string, displayName?: string, iconUrl?: string}>> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const profiles: Array<{platform: string, url: string, username: string, displayName?: string, iconUrl?: string}> = [];
  const $ = cheerio.load(html);
  
  // Look for social media links
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    
    // Normalize URL
    let fullUrl = href;
    if (href.startsWith('/')) {
      try {
        const baseUrl = new URL(url);
        fullUrl = `${baseUrl.protocol}//${baseUrl.host}${href}`;
      } catch (error) {
        return; // Skip invalid URLs
      }
    } else if (!href.startsWith('http')) {
      // Not a valid URL for social media
      return;
    }
    
    // Check against social platforms
    for (const platform of socialPlatforms) {
      if (fullUrl.includes(platform.domain)) {
        const match = fullUrl.match(platform.pattern);
        if (match) {
          const username = match[1] || 'unknown';
          
          // Try to get display name from link text
          const displayName = $(element).text().trim() || undefined;
          
          // Get icon URL if there's an img child
          const $img = $(element).find('img');
          const iconUrl = $img.length > 0 ? $img.attr('src') : undefined;
          
          // Add to profiles if not a duplicate
          if (!profiles.some(p => p.platform === platform.name && p.username === username)) {
            profiles.push({
              platform: platform.name,
              url: fullUrl,
              username,
              displayName,
              iconUrl
            });
          }
        }
      }
    }
  });
  
  return profiles;
}

/**
 * Main function to test contact extraction on a specific opportunity
 */
async function testContactExtraction() {
  try {
    // Get premium opportunities without contact info
    // Also make sure the URL doesn't contain query parameters which often create issues
    // And avoid large domains like google, facebook, etc. which can time out
    const premiumOpportunities = await db.query.discoveredOpportunities.findMany({
      where: (opportunity, { eq, and, isNull, ne, not, like, or }) => (
        and(
          eq(opportunity.isPremium, true),
          not(like(opportunity.url, '%?%')), // Avoid URLs with query parameters
          not(like(opportunity.url, '%google.%')), // Avoid Google domains
          not(like(opportunity.url, '%facebook.%')), // Avoid Facebook
          not(like(opportunity.url, '%twitter.%')), // Avoid Twitter
          not(like(opportunity.url, '%linkedin.%')), // Avoid LinkedIn
          not(like(opportunity.url, '%youtube.%')), // Avoid YouTube
          not(like(opportunity.url, '%instagram.%')), // Avoid Instagram
          or(
            isNull(opportunity.contactInfo),
            eq(opportunity.contactInfo as any, '{}'),
            eq(opportunity.contactInfo as any, '[]')
          )
        )
      ),
      orderBy: (opportunity, { desc }) => [desc(opportunity.domainAuthority)],
      limit: 5 // Get top 5 so we have more fallbacks
    });
    
    if (!premiumOpportunities.length) {
      console.log('No premium opportunities without contact info found');
      return;
    }
    
    // Try each opportunity in sequence until one is successful
    let success = false;
    
    for (const opportunity of premiumOpportunities) {
      if (success) break;
      
      console.log(`\n=== Testing contact extraction for: ${opportunity.title} (${opportunity.url}) ===\n`);
      
      try {
        const startTime = Date.now();
        
        // Start with the main domain URL
        const url = opportunity.url;
        const domain = extractDomain(url);
        
        // Try a simple HEAD request first to verify the site is responding
        try {
          console.log(`Checking if ${domain} is accessible...`);
          await axios.head(url, { 
            timeout: 5000,
            headers: {
              'User-Agent': getRandomUserAgent()
            }
          });
          console.log(`${domain} is accessible, proceeding with extraction...`);
        } catch (headError) {
          console.log(`${domain} appears to be inaccessible: ${headError.message}`);
          console.log(`Trying next opportunity...\n`);
          continue; // Try the next opportunity
        }
        
        // Extract emails from main page
        console.log(`Extracting emails from main page: ${url}`);
        const emails = await extractEmailsFromPage(url);
        console.log(`Found ${emails.length} emails on main page`);
        
        // Find and check contact pages
        console.log(`Finding contact pages for ${url}`);
        const contactPages = await findContactPages(url);
        console.log(`Found ${contactPages.length} potential contact pages`);
        
        // Extract emails from contact pages (limit to 3 to avoid timeouts)
        const limitedContactPages = contactPages.slice(0, 3);
        if (limitedContactPages.length < contactPages.length) {
          console.log(`Limiting contact page checking to ${limitedContactPages.length} out of ${contactPages.length} pages to avoid timeouts`);
        }
        
        for (const contactPage of limitedContactPages) {
          try {
            // Check if we've exceeded the max execution time
            if (Date.now() - startTime > MAX_EXECUTION_TIME * 0.7) {
              console.log('70% of maximum execution time reached, skipping remaining contact pages');
              break;
            }
            
            console.log(`Extracting emails from contact page: ${contactPage}`);
            const pageEmails = await extractEmailsFromPage(contactPage);
            console.log(`Found ${pageEmails.length} emails on contact page`);
            
            // Add unique emails
            for (const email of pageEmails) {
              if (!emails.includes(email)) {
                emails.push(email);
              }
            }
            
            // Rate limiting between pages
            await setTimeout(CONTACT_PAGE_DELAY);
          } catch (error) {
            console.error(`Error extracting emails from contact page ${contactPage}: ${error.message}`);
          }
        }
        
        // Look for contact form
        console.log(`Searching for contact form on ${url}`);
        const contactForm = await findContactFormUrl(url);
        console.log(`Contact form found: ${contactForm ? 'Yes' : 'No'}`);
        
        // Extract social profiles
        console.log(`Extracting social profiles from ${url}`);
        const socialProfiles = await extractSocialProfiles(url);
        console.log(`Found ${socialProfiles.length} social profiles`);
        
        // Prepare contact information
        const contactInfo = {
          emails: emails,
          contactForm: contactForm,
          socialProfiles: socialProfiles
        };
        
        console.log('\nExtracted contact information:');
        console.log(JSON.stringify(contactInfo, null, 2));
        
        // Calculate execution time
        const executionTime = (Date.now() - startTime) / 1000;
        console.log(`\nExecution completed in ${executionTime.toFixed(2)} seconds`);
        
        // Mark as successful to avoid trying more opportunities
        success = true;
      } catch (error) {
        console.error(`Error processing opportunity ${opportunity.url}:`, error.message);
        console.log('Trying next opportunity...\n');
      }
    }
    
    if (!success) {
      console.log('Failed to extract contact information from any of the tested opportunities');
    }
    
  } catch (error) {
    console.error('Error in test contact extraction:', error);
  }
}

// Run the test with a timeout
console.log(`Running test with a maximum execution time of ${MAX_EXECUTION_TIME / 1000} seconds`);

// Set a timeout to prevent the script from hanging indefinitely
const timeoutId = setTimeout(() => {
  console.log(`\nTest script reached maximum execution time of ${MAX_EXECUTION_TIME / 1000} seconds.`);
  console.log('Terminating the script. You may want to try with a different opportunity.');
  process.exit(1);
}, MAX_EXECUTION_TIME + 10000); // Add 10 seconds buffer for clean shutdown

// Run the test
testContactExtraction()
  .catch(console.error)
  .finally(() => {
    // Clear the timeout when the test completes
    clearTimeout(timeoutId);
  });