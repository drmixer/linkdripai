/**
 * Crawler Enhancements for Contact Collection
 * 
 * Improves the existing crawler to better collect contact information
 * during the initial discovery process.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from 'ws';
import axios from 'axios';
import cheerio from 'cheerio';
import { URL } from 'url';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';

// Constants for crawling behavior
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 10000; // 10 seconds
const THROTTLE_DELAY = 3000; // 3 seconds between requests to same domain
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
];

// Track requests to each domain for rate limiting
const domainRequests: Record<string, number> = {};

// Configure environment
dotenv.config();
neonConfig.webSocketConstructor = ws;

// Setup database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 */
function shouldThrottleDomain(domain: string): boolean {
  const now = Date.now();
  const lastRequest = domainRequests[domain] || 0;
  
  if (now - lastRequest < THROTTLE_DELAY) {
    return true;
  }
  
  domainRequests[domain] = now;
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
    return '';
  }
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  if (!url) return '';
  
  try {
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch (error) {
    console.error('Failed to cleanup URL:', url, error);
    return url;
  }
}

/**
 * Improved fetch with error handling and retries
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  const domain = extractDomain(url);
  
  if (!domain) {
    console.error('Invalid URL:', url);
    return null;
  }
  
  // Throttle requests to the same domain
  if (shouldThrottleDomain(domain)) {
    console.log(`Throttling request to ${domain}, waiting ${THROTTLE_DELAY}ms`);
    await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: REQUEST_TIMEOUT,
        validateStatus: status => status < 400, // Only valid responses
        maxRedirects: 5
      });
      
      return response.data;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error(`Failed to fetch ${url} after ${maxRetries} attempts:`, error.message);
        return null;
      }
      
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.log(`Retry ${attempt + 1}/${maxRetries} for ${url} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

/**
 * Find contact pages through intelligent crawling
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  const contactPages: string[] = [];
  const html = await fetchHtml(baseUrl);
  
  if (!html) return contactPages;
  
  const $ = cheerio.load(html);
  
  // Find links with contact-related texts
  const contactKeywords = [
    'contact', 'about', 'team', 'staff', 'people', 'connect', 
    'kontakt', 'contacto', 'contato', 'reach', 'touch', 'email'
  ];
  
  // Regex pattern for contact-related paths
  const contactRegex = /\/(contact|about|team|staff|connect|reach-us|get-in-touch)/i;
  
  // Check links for contact pages
  $('a').each((_, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().toLowerCase().trim();
    
    if (!href) return;
    
    // Check if the link text contains contact-related keywords
    const hasContactKeyword = contactKeywords.some(keyword => 
      text.includes(keyword) || (href.toLowerCase().includes(keyword))
    );
    
    // Check if the URL path matches contact patterns
    const isContactPath = contactRegex.test(href);
    
    if (hasContactKeyword || isContactPath) {
      try {
        // Resolve relative URLs
        const resolvedUrl = new URL(href, baseUrl).toString();
        // Only add new URLs and ignore anchor links to the same page
        if (!contactPages.includes(resolvedUrl) && 
            !resolvedUrl.includes('#') && 
            resolvedUrl.startsWith('http')) {
          contactPages.push(resolvedUrl);
        }
      } catch (error) {
        console.error(`Invalid URL: ${baseUrl} + ${href}`, error.message);
      }
    }
  });
  
  // Also check for common contact page patterns
  const commonContactPaths = [
    '/contact', '/contact-us', '/about', '/about-us', 
    '/team', '/our-team', '/connect', '/get-in-touch'
  ];
  
  for (const path of commonContactPaths) {
    try {
      const contactUrl = new URL(path, baseUrl).toString();
      if (!contactPages.includes(contactUrl)) {
        contactPages.push(contactUrl);
      }
    } catch (error) {
      console.error(`Invalid URL: ${baseUrl} + ${path}`, error.message);
    }
  }
  
  return contactPages;
}

/**
 * Check if a page contains contact information
 */
function containsContactInfo($: cheerio.CheerioAPI): boolean {
  // Look for form elements
  const hasContactForm = $('form').length > 0;
  
  // Look for contact-related text
  const pageText = $('body').text().toLowerCase();
  const hasContactText = [
    'contact', 'email', 'phone', 'call us', 'reach out', 
    'message', 'get in touch', 'send us'
  ].some(term => pageText.includes(term));
  
  // Look for email addresses or phone patterns
  const hasEmailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(pageText);
  const hasPhonePattern = /(\+\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/.test(pageText);
  
  return hasContactForm || hasEmailPattern || hasPhonePattern || hasContactText;
}

/**
 * Extract emails from a page with advanced methods
 */
async function extractEmails(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const emails: string[] = [];
  
  // Extract emails from text content
  const pageText = $('body').text();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = pageText.match(emailRegex) || [];
  
  // Add unique emails
  matches.forEach(email => {
    // Validate basic email format
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !emails.includes(email)) {
      emails.push(email);
    }
  });
  
  // Check mailto links
  $('a[href^="mailto:"]').each((_, element) => {
    const mailtoHref = $(element).attr('href');
    if (mailtoHref) {
      const email = mailtoHref.replace('mailto:', '').split('?')[0].trim();
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    }
  });
  
  // Check for obfuscated emails in data attributes, titles, or custom attributes
  $('*').each((_, element) => {
    const dataAttrs = $(element).data();
    for (const key in dataAttrs) {
      const value = String(dataAttrs[key]);
      const emailMatch = value.match(emailRegex);
      if (emailMatch) {
        emailMatch.forEach(email => {
          if (!emails.includes(email)) emails.push(email);
        });
      }
    }
    
    // Check title attributes
    const title = $(element).attr('title');
    if (title) {
      const titleMatches = title.match(emailRegex);
      if (titleMatches) {
        titleMatches.forEach(email => {
          if (!emails.includes(email)) emails.push(email);
        });
      }
    }
  });
  
  return emails;
}

/**
 * Extract social profiles from a page
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string}>> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const socialProfiles: Array<{platform: string, url: string, username: string}> = [];
  
  // Define social media platforms to look for
  const socialPlatforms = [
    { name: 'facebook', pattern: /facebook\.com/ },
    { name: 'twitter', pattern: /twitter\.com|x\.com/ },
    { name: 'linkedin', pattern: /linkedin\.com/ },
    { name: 'instagram', pattern: /instagram\.com/ },
    { name: 'youtube', pattern: /youtube\.com/ },
    { name: 'pinterest', pattern: /pinterest\.com/ },
    { name: 'github', pattern: /github\.com/ },
    { name: 'tiktok', pattern: /tiktok\.com/ },
    { name: 'medium', pattern: /medium\.com/ },
    { name: 'reddit', pattern: /reddit\.com/ }
  ];
  
  // Extract from links
  $('a').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    
    // Clean and normalize URL
    let socialUrl = href;
    try {
      // Handle relative URLs
      if (!socialUrl.match(/^https?:\/\//i) && !socialUrl.startsWith('//')) {
        socialUrl = new URL(socialUrl, url).toString();
      } else if (socialUrl.startsWith('//')) {
        socialUrl = 'https:' + socialUrl;
      }
    } catch (error) {
      return; // Skip invalid URLs
    }
    
    // Check if this URL matches any social platform
    for (const platform of socialPlatforms) {
      if (platform.pattern.test(socialUrl)) {
        // Extract username from URL
        const urlParts = socialUrl.split('/');
        const username = urlParts[urlParts.length - 1] || 
                         urlParts[urlParts.length - 2] || '';
        
        // Skip invalid usernames
        if (username && !username.includes('?') && username !== '' && username !== '#') {
          // Check if we already have this profile
          const isDuplicate = socialProfiles.some(
            profile => profile.platform === platform.name && profile.url === socialUrl
          );
          
          if (!isDuplicate) {
            socialProfiles.push({
              platform: platform.name,
              url: socialUrl,
              username: username
            });
          }
        }
        break; // No need to check other platforms
      }
    }
  });
  
  return socialProfiles;
}

/**
 * Find contact forms on a page
 */
async function findContactForms(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const contactForms: string[] = [];
  
  // Add current URL if it contains a form
  if ($('form').length > 0) {
    contactForms.push(url);
  }
  
  // Find links to pages that might contain forms
  const formKeywords = ['contact', 'message', 'feedback', 'support', 'help', 'inquiry'];
  
  $('a').each((_, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().toLowerCase().trim();
    
    if (!href) return;
    
    const hasFormKeyword = formKeywords.some(keyword => text.includes(keyword));
    
    if (hasFormKeyword) {
      try {
        const formUrl = new URL(href, url).toString();
        if (!contactForms.includes(formUrl)) {
          contactForms.push(formUrl);
        }
      } catch (error) {
        // Invalid URL, skip
      }
    }
  });
  
  return contactForms;
}

/**
 * Process a batch of opportunities to enhance contact information
 */
async function processBatch(opportunities: any[]): Promise<number> {
  let updatedCount = 0;
  
  for (const opportunity of opportunities) {
    console.log(`Processing opportunity: ${opportunity.domain}`);
    
    try {
      // Generate base URL from domain
      const baseUrl = opportunity.url;
      
      // Start with existing contact info or initialize new structure
      const existingContactInfo = opportunity.contactInfo || {};
      const updatedContactInfo = {
        ...existingContactInfo,
        emails: existingContactInfo.emails || [],
        socialProfiles: existingContactInfo.socialProfiles || [],
        contactForms: existingContactInfo.contactForms || [],
        extractionDetails: {
          normalized: true,
          source: 'crawler_enhancements',
          version: '1.0',
          lastUpdated: new Date().toISOString()
        }
      };
      
      let hasChanges = false;
      
      // Step 1: Find contact pages
      const contactPages = await findContactPages(baseUrl);
      
      // Step 2: Extract emails from main page and contact pages
      if (!updatedContactInfo.emails.length) {
        const mainPageEmails = await extractEmails(baseUrl);
        
        for (const email of mainPageEmails) {
          if (!updatedContactInfo.emails.includes(email)) {
            updatedContactInfo.emails.push(email);
            hasChanges = true;
          }
        }
        
        // Extract emails from contact pages
        for (const contactPage of contactPages) {
          const contactPageEmails = await extractEmails(contactPage);
          
          for (const email of contactPageEmails) {
            if (!updatedContactInfo.emails.includes(email)) {
              updatedContactInfo.emails.push(email);
              hasChanges = true;
            }
          }
        }
      }
      
      // Step 3: Extract social profiles
      if (!updatedContactInfo.socialProfiles.length) {
        const mainPageSocial = await extractSocialProfiles(baseUrl);
        
        for (const profile of mainPageSocial) {
          // Check if profile already exists
          const exists = updatedContactInfo.socialProfiles.some(
            p => p.platform === profile.platform && p.url === profile.url
          );
          
          if (!exists) {
            updatedContactInfo.socialProfiles.push(profile);
            hasChanges = true;
          }
        }
        
        // Extract from contact pages
        for (const contactPage of contactPages) {
          const contactPageSocial = await extractSocialProfiles(contactPage);
          
          for (const profile of contactPageSocial) {
            const exists = updatedContactInfo.socialProfiles.some(
              p => p.platform === profile.platform && p.url === profile.url
            );
            
            if (!exists) {
              updatedContactInfo.socialProfiles.push(profile);
              hasChanges = true;
            }
          }
        }
      }
      
      // Step 4: Find contact forms
      if (!updatedContactInfo.contactForms.length) {
        const contactForms = await findContactForms(baseUrl);
        
        // Also check contact pages for forms
        for (const contactPage of contactPages) {
          if (!contactForms.includes(contactPage)) {
            const pageForms = await findContactForms(contactPage);
            for (const form of pageForms) {
              if (!contactForms.includes(form)) {
                contactForms.push(form);
              }
            }
          }
        }
        
        // Add unique forms
        for (const form of contactForms) {
          if (!updatedContactInfo.contactForms.includes(form)) {
            updatedContactInfo.contactForms.push(form);
            hasChanges = true;
          }
        }
      }
      
      // Update opportunity if changes were made
      if (hasChanges) {
        await db.update(schema.discoveredOpportunities)
          .set({ contactInfo: updatedContactInfo })
          .where(eq(schema.discoveredOpportunities.id, opportunity.id));
        
        updatedCount++;
        console.log(`Updated contact info for ${opportunity.domain}`);
      } else {
        console.log(`No changes for ${opportunity.domain}`);
      }
    } catch (error) {
      console.error(`Error processing opportunity ${opportunity.domain}:`, error);
    }
  }
  
  return updatedCount;
}

/**
 * Main function to enhance contact information during crawling
 */
export async function enhanceCrawlerContactCollection() {
  console.log('🌐 Starting crawler contact enhancement...');
  
  try {
    // Query opportunities without contact info or with minimal contact info
    const opportunities = await db.select()
      .from(schema.discoveredOpportunities)
      .where(
        // Select opportunities without contact info or with empty contact info
        eq(schema.discoveredOpportunities.status, 'discovered')
      )
      .limit(100); // Process in batches
    
    console.log(`Found ${opportunities.length} opportunities to process`);
    
    if (opportunities.length === 0) {
      console.log('No opportunities need contact enhancement');
      return;
    }
    
    // Process in smaller batches to avoid overwhelming the network
    const batchSize = 10;
    let totalUpdated = 0;
    
    for (let i = 0; i < opportunities.length; i += batchSize) {
      const batch = opportunities.slice(i, i + batchSize);
      console.log(`Processing batch ${i/batchSize + 1}/${Math.ceil(opportunities.length/batchSize)}`);
      
      const updatedCount = await processBatch(batch);
      totalUpdated += updatedCount;
      
      // Wait a bit between batches
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log(`🎉 Crawler contact enhancement complete! Updated ${totalUpdated} opportunities`);
  } catch (error) {
    console.error('❌ Error during crawler contact enhancement:', error);
  } finally {
    await pool.end();
  }
}

// Run the enhancement if executed directly
if (require.main === module) {
  enhanceCrawlerContactCollection()
    .then(() => console.log('Crawler contact enhancement script completed'))
    .catch(err => {
      console.error('Error running crawler contact enhancement:', err);
      process.exit(1);
    });
}