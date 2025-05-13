/**
 * This script enhances contact information for premium opportunities using
 * our improved extraction techniques
 */
import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import axios from 'axios';

// Extensive array of modern user agents to rotate through for avoiding detection
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  // Chrome on Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Firefox on Linux
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

// Map to track domain access times for rate limiting
const domainAccessTimes: Map<string, number[]> = new Map();

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[randomIndex];
}

/**
 * Calculate exponential backoff with jitter for smarter retries
 * @param retry The current retry attempt number
 * @param baseDelay The base delay in milliseconds
 * @param maxDelay The maximum delay in milliseconds
 */
function calculateBackoff(retry: number, baseDelay = 1000, maxDelay = 30000): number {
  // Calculate exponential backoff: baseDelay * 2^retry
  const expBackoff = baseDelay * Math.pow(2, retry);
  
  // Cap at maximum delay
  const cappedBackoff = Math.min(expBackoff, maxDelay);
  
  // Add jitter: random value between 0 and 30% of the calculated backoff
  const jitter = Math.random() * 0.3 * cappedBackoff;
  
  return Math.floor(cappedBackoff + jitter);
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 * @param minTimeBetweenRequests Minimum time between requests to the same domain in ms
 */
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = 5000): boolean {
  const now = Date.now();
  const accessTimes = domainAccessTimes.get(domain) || [];
  
  // Clean up old access times (older than 5 minutes)
  const recentAccessTimes = accessTimes.filter(time => now - time < 300000);
  
  // If there are recent accesses, check if the most recent one is too close
  if (recentAccessTimes.length > 0) {
    const mostRecentAccess = Math.max(...recentAccessTimes);
    const timeSinceLastAccess = now - mostRecentAccess;
    
    if (timeSinceLastAccess < minTimeBetweenRequests) {
      return true;
    }
  }
  
  // Update access times for this domain
  domainAccessTimes.set(domain, [...recentAccessTimes, now]);
  return false;
}

/**
 * Fetch HTML content from a URL with advanced retrying and rate limiting
 * @param url The URL to fetch
 * @param maxRetries Maximum number of retry attempts
 */
async function fetchHtml(url: string, maxRetries = 3): Promise<string | null> {
  let retries = 0;
  
  try {
    // Extract domain from URL for rate limiting
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    while (retries <= maxRetries) {
      try {
        // Check if we should throttle requests to this domain
        if (shouldThrottleDomain(domain)) {
          const waitTime = 5000 + Math.random() * 2000; // 5-7 seconds
          console.log(`Rate limiting for ${domain}, waiting ${Math.round(waitTime)}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        console.log(`Fetching ${url} (attempt ${retries + 1}/${maxRetries + 1})...`);
        
        // Rotate user agents
        const userAgent = getRandomUserAgent();
        
        // Make the request with various headers to appear like a real browser
        const response = await axios.get(url, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout: 20000, // Increased timeout
          maxRedirects: 5,
          validateStatus: status => status < 400 // Consider all 2xx and 3xx responses as success
        });
        
        // Only update access time if the request was successful
        if (response.status >= 200 && response.status < 400) {
          // Update domain access time map
          const accessTimes = domainAccessTimes.get(domain) || [];
          domainAccessTimes.set(domain, [...accessTimes, Date.now()]);
          
          return response.data;
        }
        
        console.log(`Received status ${response.status} from ${url}`);
        retries++;
        
        // Calculate backoff with exponential delay and jitter
        if (retries <= maxRetries) {
          const waitTime = calculateBackoff(retries);
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } catch (error: any) {
        // Check if it's a 404 error, in which case we might want to try the homepage
        const isNotFound = error.response && error.response.status === 404;
        
        console.log(`Error fetching ${url}: ${error.message}`);
        
        if (isNotFound && !url.endsWith('/')) {
          // If the URL fails with 404, try the domain homepage if we're not already at the root
          try {
            console.log(`URL returned 404, trying domain homepage instead...`);
            const urlObj = new URL(url);
            const homeUrl = `${urlObj.protocol}//${urlObj.hostname}/`;
            
            // Don't count this as a retry if we're trying the homepage as a fallback
            const homeResponse = await axios.get(homeUrl, {
              headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
              },
              timeout: 15000
            });
            
            if (homeResponse.status === 200) {
              console.log(`Successfully fetched homepage for ${urlObj.hostname}`);
              return homeResponse.data;
            }
          } catch (homeError: any) {
            console.log(`Failed to fetch homepage as fallback: ${homeError.message}`);
          }
        }
        
        retries++;
        
        // Calculate backoff with exponential delay and jitter
        if (retries <= maxRetries) {
          const waitTime = calculateBackoff(retries);
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  } catch (error: any) {
    console.log(`Fatal error processing ${url}: ${error.message}`);
  }
  
  return null;
}

/**
 * Extract emails from a webpage with enhanced pattern recognition
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    console.log(`Fetching ${url} to extract emails...`);
    const html = await fetchHtml(url);
    
    if (!html) {
      return [];
    }
    
    let emails: string[] = [];
    
    // Standard email regex pattern - captures normal email formats
    const standardEmailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const standardEmails = html.match(standardEmailRegex) || [];
    emails = [...emails, ...standardEmails];
    
    // Find mailto: links which often contain valid emails
    const $ = cheerio.load(html);
    $('a[href^="mailto:"]').each((i, el) => {
      const mailtoHref = $(el).attr('href');
      if (mailtoHref) {
        const email = mailtoHref.replace(/^mailto:/, '').split('?')[0].trim();
        if (email && email.includes('@') && email.includes('.')) {
          emails.push(email);
        }
      }
    });
    
    // Look for obfuscated emails (e.g., "name [at] domain [dot] com")
    const obfuscatedEmailRegex = /\b[A-Za-z0-9._%+-]+\s*(?:\[at\]|\(at\)|@|&#64;|%40)\s*[A-Za-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\.|\&\#46;|%2E)\s*[A-Z|a-z]{2,}\b/gi;
    const obfuscatedEmails = html.match(obfuscatedEmailRegex) || [];
    // Clean up obfuscated emails
    const cleanedObfuscatedEmails = obfuscatedEmails.map(email => {
      return email
        .replace(/\s+/g, '')
        .replace(/\[at\]|\(at\)|&#64;|%40/gi, '@')
        .replace(/\[dot\]|\(dot\)|&#46;|%2E/gi, '.');
    });
    emails = [...emails, ...cleanedObfuscatedEmails];
    
    // Look for JSON-LD structured data which might contain contact information
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonLd = JSON.parse($(el).html() || '{}');
        
        // Check for email in ContactPoint
        if (jsonLd.contactPoint && jsonLd.contactPoint.email) {
          emails.push(jsonLd.contactPoint.email);
        }
        
        // Check for email in Person
        if (jsonLd['@type'] === 'Person' && jsonLd.email) {
          emails.push(jsonLd.email);
        }
        
        // Check for email in Organization
        if (jsonLd['@type'] === 'Organization' && jsonLd.email) {
          emails.push(jsonLd.email);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
    
    // Filter out common false positives and system emails
    const filteredEmails = emails.filter(email => 
      email &&
      !email.includes('example.com') && 
      !email.includes('yourdomain.com') &&
      !email.includes('domain.com') &&
      !email.includes('email@') &&
      !email.endsWith('.png') &&
      !email.endsWith('.jpg') &&
      !email.includes('your@') &&
      !email.includes('@example') &&
      !email.includes('@your') &&
      !email.includes('user@') &&
      !email.includes('@null') &&
      !email.includes('@localhost') &&
      /@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) // Must have valid domain structure
    );
    
    console.log(`Found ${filteredEmails.length} emails on ${url}`);
    return Array.from(new Set(filteredEmails)); // Remove duplicates
  } catch (error: any) {
    console.log(`Failed to extract emails from ${url}: ${error.message}`);
    return [];
  }
}

/**
 * Find a contact form URL on a website with improved detection
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    // Normalize the URL
    const baseUrl = new URL(url);
    const domain = baseUrl.hostname;
    
    // Expanded list of common paths for contact pages
    const contactPaths = [
      '/contact',
      '/contact-us',
      '/connect',
      '/get-in-touch',
      '/reach-us',
      '/about/contact',
      '/about-us/contact',
      '/about/connect',
      '/support',
      '/help',
      '/feedback',
      '/talk-to-us',
      '/reach-out',
      '/contact/sales',
      '/about/get-in-touch',
      '/inquiry'
    ];
    
    // Try to find a contact link on the page
    const html = await fetchHtml(url);
    
    if (!html) {
      // If we couldn't get the page, try direct paths
      return await checkCommonContactPaths(baseUrl.protocol, domain, contactPaths);
    }
    
    const $ = cheerio.load(html);
    
    // Step 1: Look for JSON-LD structured data which might contain contact page URL
    let structuredDataContactUrl = null;
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonLd = JSON.parse($(el).html() || '{}');
        
        // Check for contactPage in WebSite
        if (jsonLd['@type'] === 'WebSite' && jsonLd.contactPage) {
          structuredDataContactUrl = jsonLd.contactPage;
        }
        
        // Check for contactPoint in Organization
        if (jsonLd['@type'] === 'Organization' && jsonLd.contactPoint && jsonLd.contactPoint.url) {
          structuredDataContactUrl = jsonLd.contactPoint.url;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
    
    if (structuredDataContactUrl) {
      // Normalize the structured data URL
      if (typeof structuredDataContactUrl === 'string') {
        if (structuredDataContactUrl.startsWith('http')) {
          return structuredDataContactUrl;
        } else if (structuredDataContactUrl.startsWith('/')) {
          return `${baseUrl.protocol}//${domain}${structuredDataContactUrl}`;
        } else {
          return `${baseUrl.protocol}//${domain}/${structuredDataContactUrl}`;
        }
      }
    }
    
    // Step 2: Look for elements that suggest a contact form on the current page
    const formElements = $('form');
    let hasContactFormOnPage = false;
    
    formElements.each((i, el) => {
      // Check for forms with contact-related attributes
      const formId = $(el).attr('id') || '';
      const formClass = $(el).attr('class') || '';
      const formAction = $(el).attr('action') || '';
      
      if (
        formId.toLowerCase().includes('contact') || 
        formClass.toLowerCase().includes('contact') ||
        formAction.toLowerCase().includes('contact')
      ) {
        hasContactFormOnPage = true;
        return false; // break the loop
      }
      
      // Check for email input fields in the form
      const emailFields = $(el).find('input[type="email"], input[name*="email"], input[placeholder*="email"]');
      const messageFields = $(el).find('textarea, input[name*="message"], input[placeholder*="message"]');
      
      if (emailFields.length > 0 && messageFields.length > 0) {
        hasContactFormOnPage = true;
        return false; // break the loop
      }
    });
    
    if (hasContactFormOnPage) {
      return url; // The current page has a contact form
    }
    
    // Step 3: Look for contact links in the navigation and footer with expanded criteria
    const contactKeywords = ['contact', 'connect', 'get in touch', 'reach us', 'talk to us', 'support', 'help', 'feedback'];
    const contactLinks = $('a').filter(function(i, el) {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      const ariaLabel = $(el).attr('aria-label') || '';
      
      // Check text content for contact keywords
      const hasContactText = contactKeywords.some(keyword => text.includes(keyword));
      
      // Check href for contact keywords
      const hasContactHref = contactKeywords.some(keyword => 
        href.includes(keyword.replace(/\s+/g, '-')) || 
        href.includes(keyword.replace(/\s+/g, '_'))
      );
      
      // Check aria-label for contact keywords
      const hasContactAriaLabel = contactKeywords.some(keyword => ariaLabel.toLowerCase().includes(keyword));
      
      return !!(href && (hasContactText || hasContactHref || hasContactAriaLabel));
    });
    
    // Sort contact links by relevance (prefer explicit "contact" links)
    const sortedLinks = Array.from(contactLinks).sort((a, b) => {
      const textA = $(a).text().toLowerCase();
      const textB = $(b).text().toLowerCase();
      
      // Exact "contact" or "contact us" matches get priority
      if (textA === 'contact' || textA === 'contact us') return -1;
      if (textB === 'contact' || textB === 'contact us') return 1;
      
      // Next priority: contains "contact"
      const aHasContact = textA.includes('contact');
      const bHasContact = textB.includes('contact');
      if (aHasContact && !bHasContact) return -1;
      if (!aHasContact && bHasContact) return 1;
      
      return 0;
    });
    
    if (sortedLinks.length > 0) {
      const href = $(sortedLinks[0]).attr('href');
      
      if (!href) {
        return null;
      }
      
      // Handle relative vs absolute URLs
      if (href.startsWith('http')) {
        return href;
      } else if (href.startsWith('/')) {
        return `${baseUrl.protocol}//${domain}${href}`;
      } else {
        return `${baseUrl.protocol}//${domain}/${href}`;
      }
    }
    
    // Step 4: If no link found on the page, try common contact paths
    return await checkCommonContactPaths(baseUrl.protocol, domain, contactPaths);
  } catch (error: any) {
    console.log(`Error finding contact form: ${error.message}`);
    return null;
  }
}

// Helper function to check common contact page paths
async function checkCommonContactPaths(protocol: string, domain: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const contactUrl = `${protocol}//${domain}${path}`;
    try {
      const response = await axios.head(contactUrl, {
        headers: {
          'User-Agent': getRandomUserAgent()
        },
        timeout: 5000,
        validateStatus: (status) => status < 400, // Accept any 2xx or 3xx status
      });
      
      if (response.status < 400) {
        return contactUrl;
      }
    } catch (error) {
      // Continue to the next path on error
      continue;
    }
  }
  
  return null;
}

/**
 * Extract social media profiles from a page with enhanced detection
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}>> {
  try {
    const html = await fetchHtml(url);
    
    if (!html) {
      return [];
    }
    
    const $ = cheerio.load(html);
    const profiles: Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}> = [];
    
    // Extended social media platforms to look for with more precise detection
    const platforms = [
      { 
        name: 'facebook', 
        patterns: [
          /facebook\.com\/[^\/\?]+/, 
          /fb\.com\/[^\/\?]+/,
          /facebook\.com\/pages\/[^\/\?]+/
        ],
        iconClasses: ['fa-facebook', 'fa-facebook-f', 'fa-facebook-square', 'facebook', 'fb'] 
      },
      { 
        name: 'twitter', 
        patterns: [
          /twitter\.com\/[^\/\?]+/, 
          /x\.com\/[^\/\?]+/
        ],
        iconClasses: ['fa-twitter', 'fa-twitter-square', 'twitter', 'twitter-bird'] 
      },
      { 
        name: 'linkedin', 
        patterns: [
          /linkedin\.com\/company\/[^\/\?]+/, 
          /linkedin\.com\/in\/[^\/\?]+/
        ],
        iconClasses: ['fa-linkedin', 'fa-linkedin-in', 'fa-linkedin-square', 'linkedin'] 
      },
      { 
        name: 'instagram', 
        patterns: [/instagram\.com\/[^\/\?]+/],
        iconClasses: ['fa-instagram', 'instagram', 'insta'] 
      },
      { 
        name: 'youtube', 
        patterns: [
          /youtube\.com\/user\/[^\/\?]+/, 
          /youtube\.com\/c\/[^\/\?]+/, 
          /youtube\.com\/channel\/[^\/\?]+/
        ],
        iconClasses: ['fa-youtube', 'fa-youtube-play', 'fa-youtube-square', 'youtube'] 
      },
      { 
        name: 'pinterest', 
        patterns: [/pinterest\.com\/[^\/\?]+/],
        iconClasses: ['fa-pinterest', 'fa-pinterest-p', 'fa-pinterest-square', 'pinterest'] 
      },
      { 
        name: 'github', 
        patterns: [/github\.com\/[^\/\?]+/],
        iconClasses: ['fa-github', 'fa-github-alt', 'fa-github-square', 'github'] 
      },
      { 
        name: 'medium', 
        patterns: [
          /medium\.com\/@[^\/\?]+/, 
          /medium\.com\/[^\/\?]+/
        ],
        iconClasses: ['fa-medium', 'medium'] 
      },
      { 
        name: 'tiktok', 
        patterns: [/tiktok\.com\/@[^\/\?]+/],
        iconClasses: ['fa-tiktok', 'tiktok'] 
      }
    ];
    
    // Step 1: Look for JSON-LD structured data which might contain social profile URLs
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonLd = JSON.parse($(el).html() || '{}');
        
        // Check for sameAs in Organization or Person
        if ((jsonLd['@type'] === 'Organization' || jsonLd['@type'] === 'Person') && Array.isArray(jsonLd.sameAs)) {
          jsonLd.sameAs.forEach((socialUrl: string) => {
            if (typeof socialUrl !== 'string') return;
            
            // Check which platform this URL belongs to
            for (const platform of platforms) {
              for (const pattern of platform.patterns) {
                if (pattern.test(socialUrl)) {
                  const urlParts = socialUrl.split('/');
                  const username = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || '';
                  
                  // Only add if we don't already have this platform
                  if (!profiles.some(p => p.platform === platform.name)) {
                    profiles.push({
                      platform: platform.name,
                      url: socialUrl,
                      username: username,
                      displayName: jsonLd.name || ''
                    });
                  }
                  break;
                }
              }
            }
          });
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });
    
    // Step 2: Look for social links in the footer, header, and social widgets
    const potentialSocialContainers = [
      '.social', '.social-icons', '.social-media', '.social-links', '.social-profiles',
      '.footer', 'footer', '.header', 'header', '.nav', '.navbar',
      '[class*="social"]', '[id*="social"]'
    ];
    
    // Try each potential container
    for (const containerSelector of potentialSocialContainers) {
      $(containerSelector).find('a').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        
        // Check for platform matches
        for (const platform of platforms) {
          const matchesPattern = platform.patterns.some(pattern => pattern.test(href));
          
          // Check for icon classes that indicate social media even if URL doesn't match pattern
          const hasIconClass = platform.iconClasses.some(iconClass => {
            const classAttr = $(el).attr('class') || '';
            const childWithIcon = $(el).find(`[class*="${iconClass}"]`).length > 0;
            return classAttr.includes(iconClass) || childWithIcon;
          });
          
          // Check if element has a social media icon as background
          const hasIconImage = $(el).find('img').filter((i, img) => {
            const src = $(img).attr('src') || '';
            const alt = $(img).attr('alt') || '';
            return src.toLowerCase().includes(platform.name) || alt.toLowerCase().includes(platform.name);
          }).length > 0;
          
          if (matchesPattern || hasIconClass || hasIconImage) {
            // Extract username from URL if available
            let username = '';
            if (href) {
              const url = new URL(href.startsWith('http') ? href : `http://${href}`);
              const urlParts = url.pathname.split('/').filter(p => p);
              username = urlParts.length > 0 ? urlParts[urlParts.length - 1] : '';
            }
            
            // Try to get display name
            const displayName = $(el).attr('title') || $(el).attr('aria-label') || '';
            
            // Try to get description
            const description = $(el).attr('data-description') || $(el).attr('data-content') || '';
            
            // Try to get icon URL
            let iconUrl = '';
            const iconImg = $(el).find('img').first();
            if (iconImg.length > 0) {
              iconUrl = iconImg.attr('src') || '';
            }
            
            // Only add if we don't already have this platform
            if (!profiles.some(p => p.platform === platform.name)) {
              profiles.push({
                platform: platform.name,
                url: href,
                username: username,
                displayName: displayName || undefined,
                description: description || undefined,
                iconUrl: iconUrl || undefined
              });
            }
            break;
          }
        }
      });
    }
    
    // Step 3: General search for all anchor tags (less precise, but catch-all)
    if (profiles.length === 0) {
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        
        for (const platform of platforms) {
          const matchesPattern = platform.patterns.some(pattern => pattern.test(href));
          
          if (matchesPattern) {
            // Extract username from URL
            const urlParts = href.split('/');
            const username = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || '';
            
            // Only add if we don't already have this platform
            if (!profiles.some(p => p.platform === platform.name)) {
              profiles.push({
                platform: platform.name,
                url: href,
                username: username
              });
            }
            break;
          }
        }
      });
    }
    
    return profiles;
  } catch (error: any) {
    console.log(`Error extracting social profiles: ${error.message}`);
    return [];
  }
}

/**
 * Update premium opportunities with enhanced contact information extraction
 */
async function enhanceOpportunityContactInfo() {
  console.log('Starting to enhance contact information for premium opportunities...');
  
  try {
    // Get all premium opportunities - note the "isPremium" column casing is correct here
    const opportunities = await db.select()
      .from(discoveredOpportunities)
      .where(
        sql`"isPremium" = true`
      )
      .limit(25); // Process in smaller batches for better error handling
    
    console.log(`Found ${opportunities.length} premium opportunities to enhance with improved contact info`);
    
    // Create a semaphore to limit concurrent requests (prevent overwhelming target servers)
    const MAX_CONCURRENT = 5;
    let runningTasks = 0;
    let completedTasks = 0;
    const taskQueue = [];
    
    // Create a promise that resolves when all opportunities are processed
    const processingComplete = new Promise((resolve, reject) => {
      // Function to process the next opportunity in the queue
      const processNext = async () => {
        if (taskQueue.length === 0 && runningTasks === 0) {
          return resolve(null);
        }
        
        if (taskQueue.length > 0 && runningTasks < MAX_CONCURRENT) {
          const opportunity = taskQueue.shift();
          runningTasks++;
          
          try {
            await processOpportunity(opportunity);
          } catch (error: any) {
            console.error(`Error in task processing: ${error.message}`);
          } finally {
            runningTasks--;
            completedTasks++;
            
            // Log progress periodically
            if (completedTasks % 5 === 0 || completedTasks === opportunities.length) {
              console.log(`Progress: ${completedTasks}/${opportunities.length} opportunities processed`);
            }
            
            // Process next opportunity
            processNext();
          }
        }
      };
      
      // Add all opportunities to the task queue
      taskQueue.push(...opportunities);
      
      // Start initial batch of tasks
      for (let i = 0; i < Math.min(MAX_CONCURRENT, opportunities.length); i++) {
        processNext();
      }
    });
    
    // Process a single opportunity
    async function processOpportunity(opportunity: any) {
      console.log(`Processing opportunity: ${opportunity.domain} (${opportunity.url})`);
      
      try {
        // Get existing contact info if any
        const existingContactInfo = opportunity.contactInfo ? JSON.parse(opportunity.contactInfo) : {
          emails: [],
          contactForm: null,
          socialProfiles: []
        };
        
        // Extract emails from the page
        const emails = await extractEmailsFromPage(opportunity.url);
        console.log(`Found ${emails.length} emails on main page`);
        
        // Find contact form
        const contactFormUrl = await findContactFormUrl(opportunity.url);
        console.log(`Contact form: ${contactFormUrl || 'Not found'}`);
        
        // Extract social profiles
        const socialProfiles = await extractSocialProfiles(opportunity.url);
        console.log(`Found ${socialProfiles.length} social profiles`);
        
        // Try to extract "about" page content if emails are missing
        let aboutPageEmails = [];
        if (emails.length === 0) {
          try {
            // Try to find the about page
            const urlObj = new URL(opportunity.url);
            const aboutUrls = [
              `${urlObj.protocol}//${urlObj.hostname}/about`,
              `${urlObj.protocol}//${urlObj.hostname}/about-us`,
              `${urlObj.protocol}//${urlObj.hostname}/team`,
              `${urlObj.protocol}//${urlObj.hostname}/company`
            ];
            
            for (const aboutUrl of aboutUrls) {
              console.log(`Checking about page for emails: ${aboutUrl}`);
              aboutPageEmails = await extractEmailsFromPage(aboutUrl);
              if (aboutPageEmails.length > 0) {
                console.log(`Found ${aboutPageEmails.length} emails on about page: ${aboutUrl}`);
                break;
              }
            }
          } catch (aboutError) {
            console.log(`Error checking about pages: ${aboutError.message}`);
          }
        }
        
        // Combine all found emails with existing emails
        const allEmails = [...new Set([
          ...existingContactInfo.emails,
          ...emails, 
          ...aboutPageEmails
        ])];
        
        // Prepare enhanced contactInfo object
        const enhancedContactInfo = {
          emails: allEmails,
          contactForm: contactFormUrl || existingContactInfo.contactForm,
          socialProfiles: socialProfiles.length > 0 ? socialProfiles : existingContactInfo.socialProfiles,
          lastUpdated: new Date().toISOString(),
          extractionDetails: {
            mainPageEmailsFound: emails.length,
            aboutPageEmailsFound: aboutPageEmails.length,
            hasContactForm: !!contactFormUrl,
            socialProfilesFound: socialProfiles.length,
            enhancedExtraction: true
          }
        };
        
        // Update the opportunity in the database
        await db.update(discoveredOpportunities)
          .set({
            contactInfo: JSON.stringify(enhancedContactInfo)
          })
          .where(sql`id = ${opportunity.id}`);
        
        console.log(`Enhanced contact info for ${opportunity.domain}: ${allEmails.length} emails, form: ${contactFormUrl ? 'yes' : 'no'}, ${socialProfiles.length} social profiles`);
      } catch (error: any) {
        console.error(`Error processing opportunity ${opportunity.url}: ${error.message}`);
        
        // Update with error information but preserve existing data
        const existingContactInfo = opportunity.contactInfo ? JSON.parse(opportunity.contactInfo) : {
          emails: [],
          contactForm: null,
          socialProfiles: []
        };
        
        const fallbackContactInfo = {
          ...existingContactInfo,
          lastUpdated: new Date().toISOString(),
          extractionDetails: {
            ...(existingContactInfo.extractionDetails || {}),
            error: `Enhancement failed: ${error.message}`,
            enhancementAttempted: true
          }
        };
        
        // Update with at least the attempt information
        await db.update(discoveredOpportunities)
          .set({
            contactInfo: JSON.stringify(fallbackContactInfo)
          })
          .where(sql`id = ${opportunity.id}`);
      }
    }
    
    // Wait for all opportunities to be processed
    await processingComplete;
    
    console.log('Finished enhancing contact information for premium opportunities');
  } catch (error: any) {
    console.error(`Error enhancing contact information: ${error.message}`);
  }
}

// Run the enhancement function
enhanceOpportunityContactInfo()
  .then(() => {
    console.log('Contact information enhancement script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });