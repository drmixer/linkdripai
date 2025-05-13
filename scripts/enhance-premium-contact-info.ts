/**
 * This script specifically enhances premium opportunities with contact information
 * using more aggressive extraction techniques and multiple sources
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';

// Cache for domain request timestamps to prevent overloading domains
const domainRequestTimestamps: Record<string, number> = {};

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

// Get a random user agent
function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

// Calculate backoff time for retries
function calculateBackoff(retry: number, baseDelay = 1000, maxDelay = 30000): number {
  const delay = Math.min(baseDelay * Math.pow(2, retry), maxDelay);
  const jitter = delay * 0.2 * Math.random();
  return delay + jitter;
}

// Check if we should throttle requests to a domain
function shouldThrottleDomain(domain: string, minTimeBetweenRequests = 5000): boolean {
  const now = Date.now();
  const lastRequestTime = domainRequestTimestamps[domain] || 0;
  
  if (now - lastRequestTime < minTimeBetweenRequests) {
    return true;
  }
  
  domainRequestTimestamps[domain] = now;
  return false;
}

// Cleanup URLs by removing fake parameters and IDs
function cleanupUrl(url: string): string {
  try {
    // Parse the URL
    const parsedUrl = new URL(url);
    
    // Check if the URL has artificial ID parameters
    if (parsedUrl.search.includes('id=')) {
      // Remove the query parameters
      parsedUrl.search = '';
    }
    
    // Remove common unnecessary URL parts
    let path = parsedUrl.pathname;
    
    // Remove trailing slash if present
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    
    // Check for artificial path segments
    const pathSegments = path.split('/').filter(Boolean);
    
    // If we have a deeply nested path with certain keywords, simplify it
    const suspiciousKeywords = ['topic', 'directory', 'resources', 'forum'];
    
    if (pathSegments.length > 2 && 
        suspiciousKeywords.some(keyword => path.includes(keyword)) &&
        !path.includes('blog')) {
      // Try to get to a more reliable base URL
      // Keep only the first level of the path if it seems legitimate
      const simplifiedPath = '/' + pathSegments[0];
      path = simplifiedPath;
    }
    
    // Set the cleaned path
    parsedUrl.pathname = path;
    
    // Put the URL back together
    const cleanedUrl = parsedUrl.toString();
    console.log(`Cleaned URL: ${url} -> ${cleanedUrl}`);
    
    return cleanedUrl;
  } catch (error) {
    console.error(`Error cleaning URL ${url}: ${error.message}`);
    return url;
  }
}

// Fetch HTML content with retry logic
async function fetchHtml(url: string, maxRetries = 3): Promise<string | null> {
  try {
    // Parse domain for rate limiting
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    
    // Check domain rate limiting
    if (shouldThrottleDomain(domain)) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Attempt with retries
    let lastError: any = null;
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.google.com/'
          },
          timeout: 15000,
          maxRedirects: 5
        });
        
        if (response.status === 200) {
          return response.data;
        }
      } catch (error: any) {
        lastError = error;
        console.error(`Error fetching ${url} (attempt ${retry + 1}/${maxRetries + 1}): ${error.message}`);
        
        // Wait before retrying
        if (retry < maxRetries) {
          const backoffTime = calculateBackoff(retry);
          console.log(`Waiting ${backoffTime}ms before retrying...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    throw lastError || new Error('Failed to fetch HTML after multiple attempts');
  } catch (error: any) {
    console.error(`Failed to fetch HTML from ${url}: ${error.message}`);
    return null;
  }
}

// Extract emails with enhanced pattern recognition
async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    
    // Get page text content
    const pageText = $('body').text();
    
    // Advanced email regex pattern with common obfuscation handling
    const emailPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Standard email
      /\b[A-Za-z0-9._%+-]+\s*[\[\(]at\[\)\]\s*[A-Za-z0-9.-]+\s*[\[\(]dot[\)\]\s*[A-Z|a-z]{2,}\b/gi, // at/dot notation
      /\b[A-Za-z0-9._%+-]+\s*\[\s*at\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*dot\s*\]\s*[A-Z|a-z]{2,}\b/gi, // [at]/[dot] notation
      /\b[A-Za-z0-9._%+-]+\s*\(\s*at\s*\)\s*[A-Za-z0-9.-]+\s*\(\s*dot\s*\)\s*[A-Z|a-z]{2,}\b/gi, // (at)/(dot) notation
    ];
    
    // Extract emails using multiple patterns
    const emails: string[] = [];
    
    // Process each pattern
    for (const pattern of emailPatterns) {
      const matches = pageText.match(pattern);
      if (matches) {
        for (let match of matches) {
          // Convert obfuscated emails to standard format
          match = match
            .replace(/\s*[\[\(]\s*at\s*[\)\]]\s*/gi, '@')
            .replace(/\s*[\[\(]\s*dot\s*[\)\]]\s*/gi, '.');
          
          if (match.includes('@') && match.includes('.') && 
              !match.includes('.jpg') && 
              !match.includes('.png') && 
              !match.includes('.gif')) {
            emails.push(match.trim());
          }
        }
      }
    }
    
    // Also check for emails in href="mailto:"
    $('a[href^="mailto:"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email && email.includes('@') && !emails.includes(email)) {
          emails.push(email);
        }
      }
    });
    
    // Remove duplicates
    return [...new Set(emails)];
  } catch (error: any) {
    console.error(`Error extracting emails from ${url}: ${error.message}`);
    return [];
  }
}

// Find a contact form URL on a website
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    const html = await fetchHtml(url);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    
    // Check links for contact-related text
    const contactLinks = $('a').filter(function() {
      const href = $(this).attr('href');
      const text = $(this).text().toLowerCase();
      
      return href && (
        text.includes('contact') || 
        text.includes('get in touch') || 
        text.includes('reach out') ||
        text.includes('talk to us') ||
        text.includes('email us') ||
        href.includes('contact') ||
        href.includes('get-in-touch')
      );
    });
    
    if (contactLinks.length > 0) {
      // Get the most likely contact link
      const bestLink = contactLinks.first();
      const href = bestLink.attr('href');
      
      if (href) {
        // Resolve relative URL
        try {
          const baseUrl = new URL(url);
          let contactUrl;
          
          if (href.startsWith('http')) {
            contactUrl = href;
          } else if (href.startsWith('/')) {
            contactUrl = `${baseUrl.protocol}//${baseUrl.host}${href}`;
          } else {
            contactUrl = `${baseUrl.protocol}//${baseUrl.host}/${href}`;
          }
          
          return contactUrl;
        } catch (error) {
          console.error(`Error resolving contact URL: ${error.message}`);
        }
      }
    }
    
    // Try common contact page paths
    const parsedUrl = new URL(url);
    return await checkCommonContactPaths(
      parsedUrl.protocol, 
      parsedUrl.hostname,
      ['/contact', '/contact-us', '/about/contact', '/get-in-touch', '/reach-out', '/support']
    );
  } catch (error: any) {
    console.error(`Error finding contact form for ${url}: ${error.message}`);
    return null;
  }
}

// Check common contact page paths
async function checkCommonContactPaths(protocol: string, domain: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const testUrl = `${protocol}//${domain}${path}`;
    try {
      const response = await axios.head(testUrl, {
        headers: { 'User-Agent': getRandomUserAgent() },
        timeout: 5000,
        validateStatus: (status) => status < 400
      });
      
      if (response.status < 400) {
        return testUrl;
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  return null;
}

// Extract social profiles from a page
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}>> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    
    // Define social media patterns to look for
    const socialPatterns = [
      { platform: 'linkedin', regex: /linkedin\.com\/(?:company|in|profile)\/([^\/\?]+)/i },
      { platform: 'twitter', regex: /(?:twitter\.com|x\.com)\/([^\/\?]+)/i },
      { platform: 'facebook', regex: /facebook\.com\/(?:pg\/)?([^\/\?]+)/i },
      { platform: 'instagram', regex: /instagram\.com\/([^\/\?]+)/i },
      { platform: 'youtube', regex: /youtube\.com\/(?:c\/|channel\/|user\/)?([^\/\?]+)/i },
      { platform: 'pinterest', regex: /pinterest\.com\/([^\/\?]+)/i },
      { platform: 'github', regex: /github\.com\/([^\/\?]+)/i },
      { platform: 'medium', regex: /medium\.com\/@?([^\/\?]+)/i },
      { platform: 'tiktok', regex: /tiktok\.com\/@([^\/\?]+)/i },
      { platform: 'threads', regex: /threads\.net\/@?([^\/\?]+)/i },
    ];
    
    const socialProfiles: Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}> = [];
    
    // Extract from href links
    $('a').each(function() {
      const href = $(this).attr('href');
      if (!href) return;
      
      for (const { platform, regex } of socialPatterns) {
        const match = href.match(regex);
        if (match && match[1]) {
          const username = match[1];
          const displayName = $(this).text().trim() || undefined;
          const iconUrl = $(this).find('img').attr('src') || undefined;
          
          // Check if this profile is already in our list
          const existingIndex = socialProfiles.findIndex(p => 
            p.platform === platform && p.username === username
          );
          
          if (existingIndex === -1) {
            socialProfiles.push({
              platform,
              url: href,
              username,
              displayName,
              iconUrl
            });
          }
        }
      }
    });
    
    // Look for social sharing buttons that contain URLs
    $('[class*="social"], [class*="share"], [class*="follow"], .footer a, .header a').each(function() {
      const href = $(this).attr('href');
      if (!href) return;
      
      for (const { platform, regex } of socialPatterns) {
        const match = href.match(regex);
        if (match && match[1]) {
          const username = match[1];
          
          // Check if this profile is already in our list
          const existingIndex = socialProfiles.findIndex(p => 
            p.platform === platform && p.username === username
          );
          
          if (existingIndex === -1) {
            socialProfiles.push({
              platform,
              url: href,
              username
            });
          }
        }
      }
    });
    
    return socialProfiles;
  } catch (error: any) {
    console.error(`Error extracting social profiles from ${url}: ${error.message}`);
    return [];
  }
}

// Main function to enhance premium opportunities
async function enhancePremiumContactInfo() {
  console.log('Starting premium opportunity contact information enhancement...');
  
  try {
    // Get all premium opportunities
    const premiumOpportunities = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"isPremium" = true`);
    
    console.log(`Found ${premiumOpportunities.length} premium opportunities to process`);
    
    const results = {
      totalOpportunities: premiumOpportunities.length,
      processedCount: 0,
      updatedCount: 0,
      newEmailsFound: 0,
      newFormsFound: 0,
      newSocialProfilesFound: 0,
      errorCount: 0
    };
    
    // Process opportunities in smaller batches to avoid memory issues
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < premiumOpportunities.length; i += BATCH_SIZE) {
      const batch = premiumOpportunities.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(premiumOpportunities.length / BATCH_SIZE)}`);
      
      // Process each opportunity in parallel but with a small delay between starts
      await Promise.all(batch.map(async (opportunity, index) => {
        // Add delay between each opportunity's processing start
        await new Promise(resolve => setTimeout(resolve, index * 500));
        
        // Clean up the URL before processing - remove artificial parameters
        opportunity.url = cleanupUrl(opportunity.url);
        return processOpportunity(opportunity);
      }));
    }
    
    console.log(`
Premium opportunity contact information enhancement complete:
- Total premium opportunities: ${results.totalOpportunities}
- Successfully processed: ${results.processedCount}
- Updated with better contact info: ${results.updatedCount}
- New emails found: ${results.newEmailsFound}
- New contact forms found: ${results.newFormsFound}
- New social profiles found: ${results.newSocialProfilesFound}
- Errors encountered: ${results.errorCount}
    `);
    
    // Function to process a single opportunity
    async function processOpportunity(opportunity: any) {
      try {
        results.processedCount++;
        
        // Skip if already processed recently
        if (opportunity.contactInfo) {
          let contactInfo = typeof opportunity.contactInfo === 'string' 
            ? JSON.parse(opportunity.contactInfo) 
            : opportunity.contactInfo;
          
          // Check if extracted recently (within last 7 days)
          if (contactInfo.extractionDetails?.lastExtracted) {
            const lastExtracted = new Date(contactInfo.extractionDetails.lastExtracted);
            const daysSinceLastExtraction = (Date.now() - lastExtracted.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSinceLastExtraction < 7) {
              if (results.processedCount % 10 === 0 || results.processedCount === results.totalOpportunities) {
                console.log(`Processed ${results.processedCount}/${results.totalOpportunities} opportunities (${results.updatedCount} updated)`);
              }
              return;
            }
          }
        }
        
        console.log(`Processing premium opportunity #${opportunity.id}: ${opportunity.url}`);
        
        // Initialize contact info object with standard structure
        let contactInfoObj: any = {
          email: null,
          emails: [],
          form: null,
          social: [],
          lastUpdated: new Date().toISOString(),
          extractionDetails: {
            lastExtracted: new Date().toISOString(),
            source: 'premium-opportunity-enhancement',
            version: '1.1',
            hasEmail: false,
            hasAdditionalEmails: false,
            hasContactForm: false,
            hasSocialProfiles: false
          }
        };
        
        // If existing contact info, merge it
        if (opportunity.contactInfo) {
          try {
            const existingContactInfo = typeof opportunity.contactInfo === 'string' 
              ? JSON.parse(opportunity.contactInfo) 
              : opportunity.contactInfo;
            
            if (existingContactInfo.email) {
              contactInfoObj.email = existingContactInfo.email;
            }
            
            if (existingContactInfo.emails && Array.isArray(existingContactInfo.emails)) {
              contactInfoObj.emails = [...existingContactInfo.emails];
            }
            
            if (existingContactInfo.form) {
              contactInfoObj.form = existingContactInfo.form;
            }
            
            if (existingContactInfo.social && Array.isArray(existingContactInfo.social)) {
              contactInfoObj.social = [...existingContactInfo.social];
            }
          } catch (error) {
            console.error(`Error parsing existing contact info for opportunity #${opportunity.id}: ${error.message}`);
          }
        }
        
        // Try to extract email addresses
        try {
          let emails = await extractEmailsFromPage(opportunity.url);
          
          // If no emails found on main page, try the about or contact page
          if (emails.length === 0) {
            const parsedUrl = new URL(opportunity.url);
            const aboutPageUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/about`;
            const contactPageUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}/contact`;
            
            const aboutPageEmails = await extractEmailsFromPage(aboutPageUrl);
            emails = [...emails, ...aboutPageEmails];
            
            const contactPageEmails = await extractEmailsFromPage(contactPageUrl);
            emails = [...emails, ...contactPageEmails];
          }
          
          // If we found emails, update the object
          if (emails.length > 0) {
            // Set primary email
            if (!contactInfoObj.email && emails.length > 0) {
              contactInfoObj.email = emails[0];
              results.newEmailsFound++;
            }
            
            // Add additional emails
            const existingEmails = new Set([
              contactInfoObj.email,
              ...contactInfoObj.emails
            ].filter(Boolean));
            
            for (const email of emails) {
              if (!existingEmails.has(email)) {
                contactInfoObj.emails.push(email);
                existingEmails.add(email);
                results.newEmailsFound++;
              }
            }
          }
          
          contactInfoObj.extractionDetails.hasEmail = !!contactInfoObj.email;
          contactInfoObj.extractionDetails.hasAdditionalEmails = contactInfoObj.emails.length > 0;
        } catch (error: any) {
          console.error(`Error extracting emails for opportunity #${opportunity.id}: ${error.message}`);
        }
        
        // Try to find contact form
        if (!contactInfoObj.form) {
          try {
            const contactFormUrl = await findContactFormUrl(opportunity.url);
            if (contactFormUrl) {
              contactInfoObj.form = contactFormUrl;
              contactInfoObj.extractionDetails.hasContactForm = true;
              results.newFormsFound++;
            }
          } catch (error: any) {
            console.error(`Error finding contact form for opportunity #${opportunity.id}: ${error.message}`);
          }
        } else {
          contactInfoObj.extractionDetails.hasContactForm = true;
        }
        
        // Extract social profiles
        try {
          const socialProfiles = await extractSocialProfiles(opportunity.url);
          
          // Add new social profiles
          const existingProfiles = new Map(
            contactInfoObj.social.map((p: any) => [`${p.platform}:${p.username}`, p])
          );
          
          for (const profile of socialProfiles) {
            const key = `${profile.platform}:${profile.username}`;
            if (!existingProfiles.has(key)) {
              contactInfoObj.social.push(profile);
              existingProfiles.set(key, profile);
              results.newSocialProfilesFound++;
            }
          }
          
          contactInfoObj.extractionDetails.hasSocialProfiles = contactInfoObj.social.length > 0;
        } catch (error: any) {
          console.error(`Error extracting social profiles for opportunity #${opportunity.id}: ${error.message}`);
        }
        
        // Create metadata object for raw storage
        const metadataObj: any = {
          extraction_timestamp: new Date().toISOString(),
          extraction_source: 'premium_enhancement_script',
          opportunity_id: opportunity.id,
          domain: opportunity.domain,
          url: opportunity.url,
          extraction_stats: {
            emails_found: contactInfoObj.emails.length + (contactInfoObj.email ? 1 : 0),
            has_contact_form: !!contactInfoObj.form,
            social_profiles_found: contactInfoObj.social.length
          }
        };
        
        // Update the database
        await db.update(discoveredOpportunities)
          .set({
            contactInfo: JSON.stringify(contactInfoObj),
            metadataRaw: JSON.stringify(metadataObj)
          })
          .where(sql`id = ${opportunity.id}`);
        
        results.updatedCount++;
        
        if (results.processedCount % 10 === 0 || results.processedCount === results.totalOpportunities) {
          console.log(`Processed ${results.processedCount}/${results.totalOpportunities} opportunities (${results.updatedCount} updated)`);
        }
        
        return true;
      } catch (error: any) {
        console.error(`Error processing opportunity #${opportunity.id}: ${error.message}`);
        results.errorCount++;
        return false;
      }
    }
    
  } catch (error: any) {
    console.error(`Error enhancing premium opportunities: ${error.message}`);
  }
}

// Run the script
enhancePremiumContactInfo()
  .catch(error => {
    console.error('Error running script:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script execution completed');
  });