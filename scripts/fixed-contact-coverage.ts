/**
 * Contact Coverage Improvement Script (Fixed Version)
 * 
 * This script combines multiple techniques to significantly improve
 * contact information extraction for both regular and premium opportunities.
 * 
 * It prioritizes premium opportunities but also processes regular ones
 * to meet our coverage targets:
 * - 65-80% overall contact information coverage
 * - 90-95% coverage for premium opportunities
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import * as cheerio from 'cheerio';
import axios from 'axios';

// Configuration constants
const MAX_RETRIES = 3;
const THROTTLE_DELAY = 5000; // 5 seconds between requests to the same domain
const BATCH_SIZE = 20; // Default batch size

// Map to track domain request times to prevent rate limiting
const domainRequestTimes: Map<string, number> = new Map();

// User agent strings to simulate different browsers
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1'
];

// Helper function to create a setTimeout that returns a Promise
function setTimeout(ms: number): Promise<void> {
  return new Promise(resolve => global.setTimeout(resolve, ms));
}

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
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
  const lastRequestTime = domainRequestTimes.get(domain);
  if (!lastRequestTime) return false;
  
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  return timeSinceLastRequest < minTimeBetweenRequests;
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    // Make sure URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Create URL object for standardization
    const urlObj = new URL(url);
    
    // Remove trailing slash from path if it's just the root
    if (urlObj.pathname === '/') {
      return `${urlObj.protocol}//${urlObj.host}`;
    }
    
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}`;
  } catch (error) {
    // If URL parsing fails, return the original URL
    console.warn(`Failed to clean URL: ${url}`, error);
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
  
  // Record this request time
  domainRequestTimes.set(domain, Date.now());
  
  for (let retry = 0; retry <= maxRetries; retry++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        },
        timeout: 30000,
        maxRedirects: 5
      });
      
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      if (retry === maxRetries) {
        console.error(`Failed to fetch ${url} after ${maxRetries} retries:`, error);
        return null;
      }
      
      const backoffTime = calculateBackoff(retry);
      console.log(`Retry ${retry + 1}/${maxRetries} for ${url} in ${backoffTime}ms`);
      await setTimeout(backoffTime);
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
  const $ = cheerio.load(html);
  
  // Remove script and style elements to avoid false positives
  $('script, style').remove();
  
  // Convert HTML to text and look for email patterns
  const text = $('body').text();
  
  // Standard email regex pattern
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const matches = text.match(emailRegex);
  
  if (matches) {
    // Filter and sanitize matches
    matches.forEach(email => {
      // Clean up and validate email
      const cleaned = email.trim().toLowerCase();
      if (
        cleaned.length > 5 && // Minimum viable email length
        cleaned.includes('@') &&
        cleaned.includes('.') &&
        !cleaned.includes('example.com') &&
        !cleaned.includes('yourdomain') &&
        !cleaned.includes('@test.') &&
        !cleaned.includes('@domain.') &&
        !cleaned.includes('sampledomain')
      ) {
        if (!emails.includes(cleaned)) {
          emails.push(cleaned);
        }
      }
    });
  }
  
  // Also try to find email references in anchor href attributes (mailto: links)
  $('a[href^="mailto:"]').each((_, element) => {
    const mailtoHref = $(element).attr('href');
    if (mailtoHref) {
      const email = mailtoHref.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    }
  });
  
  return emails;
}

/**
 * Find all contact pages by checking common paths
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const url = new URL(baseUrl);
    const protocol = url.protocol;
    const domain = url.hostname;
    
    // List of common contact page paths to check
    const contactPaths = [
      '/contact',
      '/contact-us',
      '/about/contact',
      '/contact.html',
      '/contact-us.html',
      '/about/contact.html',
      '/about',
      '/about-us',
      '/company/about',
      '/company/contact',
      '/support',
      '/help',
      '/reach-us',
      '/get-in-touch',
      '/connect',
      '/company',
      '/reach-out',
      '/team',
      '/about/team',
      '/company/team'
    ];
    
    const contactUrls: string[] = [];
    
    for (const path of contactPaths) {
      const fullUrl = `${protocol}//${domain}${path}`;
      try {
        // Check if the URL responds with a valid page
        const response = await axios.head(fullUrl, {
          headers: { 'User-Agent': getRandomUserAgent() },
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: (status) => status < 400, // Accept any 2xx or 3xx status
        });
        
        if (response.status < 400) {
          contactUrls.push(fullUrl);
        }
      } catch (error) {
        // Ignore errors - we're just probing for valid URLs
      }
      
      // Add a small delay between requests to avoid rate limiting
      await setTimeout(500);
    }
    
    return contactUrls;
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
    return [];
  }
}

/**
 * Find a contact form URL on a website with improved detection
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  // First, try to find a contact form on the current page
  const html = await fetchHtml(url);
  if (!html) return null;
  
  const $ = cheerio.load(html);
  
  // Check for forms with contact-related terms
  const contactForms = $('form').filter((_, form) => {
    const formContent = $(form).text().toLowerCase();
    const formAction = $(form).attr('action') || '';
    const formId = $(form).attr('id') || '';
    const formClass = $(form).attr('class') || '';
    
    return (
      formContent.includes('contact') ||
      formContent.includes('message') ||
      formContent.includes('send') ||
      formContent.includes('email') ||
      formAction.includes('contact') ||
      formId.includes('contact') ||
      formClass.includes('contact') ||
      $(form).find('input[name="email"]').length > 0 ||
      $(form).find('input[type="email"]').length > 0 ||
      $(form).find('textarea').length > 0
    );
  });
  
  if (contactForms.length > 0) {
    return url;
  }
  
  // If no contact form found on the current page, check common contact page paths
  try {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol;
    const domain = parsedUrl.hostname;
    
    // Common paths that might contain contact forms
    const contactPaths = [
      '/contact',
      '/contact-us',
      '/reach-out',
      '/get-in-touch',
      '/connect'
    ];
    
    // Check each path for a form
    const contactPageUrl = await checkCommonContactPaths(protocol, domain, contactPaths);
    return contactPageUrl;
  } catch (error) {
    console.error(`Error finding contact form for ${url}:`, error);
    return null;
  }
}

async function checkCommonContactPaths(protocol: string, domain: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const fullUrl = `${protocol}//${domain}${path}`;
    try {
      const response = await axios.get(fullUrl, {
        headers: { 'User-Agent': getRandomUserAgent() },
        timeout: 5000,
        maxRedirects: 5,
      });
      
      if (response.status === 200) {
        const $ = cheerio.load(response.data);
        const hasForms = $('form').length > 0;
        
        if (hasForms) {
          return fullUrl;
        }
      }
    } catch (error) {
      // Ignore errors - we're just probing for valid contact pages
    }
    
    // Add a small delay between requests
    await setTimeout(500);
  }
  
  return null;
}

/**
 * Extract social profiles from a page with enhanced detection
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}>> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);
  const profiles: Array<{platform: string, url: string, username: string, displayName?: string, description?: string, iconUrl?: string}> = [];
  
  // List of common social media domains to look for
  const socialPlatforms = [
    { name: 'LinkedIn', domain: 'linkedin.com', pattern: /linkedin\.com\/(?:in|company)\/([^\/\?]+)/ },
    { name: 'Twitter', domain: 'twitter.com', pattern: /twitter\.com\/([^\/\?]+)/ },
    { name: 'Facebook', domain: 'facebook.com', pattern: /facebook\.com\/([^\/\?]+)/ },
    { name: 'Instagram', domain: 'instagram.com', pattern: /instagram\.com\/([^\/\?]+)/ },
    { name: 'YouTube', domain: 'youtube.com', pattern: /youtube\.com\/(?:channel|user|c)\/([^\/\?]+)/ },
    { name: 'GitHub', domain: 'github.com', pattern: /github\.com\/([^\/\?]+)/ },
    { name: 'Pinterest', domain: 'pinterest.com', pattern: /pinterest\.com\/([^\/\?]+)/ },
    { name: 'Medium', domain: 'medium.com', pattern: /medium\.com\/@?([^\/\?]+)/ },
    { name: 'TikTok', domain: 'tiktok.com', pattern: /tiktok\.com\/@([^\/\?]+)/ },
    { name: 'Reddit', domain: 'reddit.com', pattern: /reddit\.com\/(?:user|r)\/([^\/\?]+)/ },
    { name: 'Vimeo', domain: 'vimeo.com', pattern: /vimeo\.com\/([^\/\?]+)/ },
    { name: 'Slack', domain: 'slack.com', pattern: /([^\/\?]+)\.slack\.com/ },
    { name: 'Discord', domain: 'discord.gg', pattern: /discord\.gg\/([^\/\?]+)/ },
    { name: 'Dribbble', domain: 'dribbble.com', pattern: /dribbble\.com\/([^\/\?]+)/ },
    { name: 'Behance', domain: 'behance.net', pattern: /behance\.net\/([^\/\?]+)/ }
  ];
  
  // Find all links
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
        // Extract username using the pattern
        const match = fullUrl.match(platform.pattern);
        const username = match ? match[1] : '';
        
        if (username && username !== 'sharer' && username !== 'share') {
          // Get display name if available
          const linkText = $(element).text().trim();
          const displayName = linkText && linkText !== username ? linkText : undefined;
          
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
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as with_contact,
        SUM(CASE WHEN "isPremium" = true THEN 1 ELSE 0 END) as premium_total,
        SUM(CASE WHEN "isPremium" = true AND "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as premium_with_contact
      FROM "discoveredOpportunities"
    `);
    
    console.log('Raw DB result:', JSON.stringify(statsResult));
    
    // Make sure we handle the result correctly
    if (!statsResult || !statsResult.rows || !statsResult.rows.length) {
      console.error('Failed to get current stats');
      return;
    }
    
    const currentStats = statsResult.rows[0];
    
    // Convert string numbers to actual numbers if needed
    const total = parseInt(currentStats.total as any) || 0;
    const withContact = parseInt(currentStats.with_contact as any) || 0;
    const premiumTotal = parseInt(currentStats.premium_total as any) || 0;
    const premiumWithContact = parseInt(currentStats.premium_with_contact as any) || 0;
    
    console.log('Current contact information coverage:');
    console.log(`- Total opportunities: ${total}`);
    console.log(`- With contact info: ${withContact} (${((withContact / total) * 100).toFixed(1)}%)`);
    console.log(`- Premium opportunities: ${premiumTotal}`);
    console.log(`- Premium with contact info: ${premiumWithContact} (${((premiumWithContact / premiumTotal) * 100).toFixed(1)}%)`);
    
    // Target coverage thresholds
    const targetPremiumCoverage = 0.9; // 90% target for premium opportunities
    
    // Get all opportunities - using SQL query instead of Drizzle's orderBy
    // Note: Only using domainAuthority for sorting since relevanceScore doesn't exist
    const opportunitiesQuery = await db.execute(sql`
      SELECT *
      FROM "discoveredOpportunities"
      ORDER BY "domainAuthority" DESC
    `);
    
    if (!opportunitiesQuery || !opportunitiesQuery.rows || !opportunitiesQuery.rows.length) {
      console.error('Failed to get opportunities');
      return;
    }
    
    const allOpportunities = opportunitiesQuery.rows;
    
    // First, process premium opportunities if needed
    if (!premiumOnly) {
      console.log('\nProcessing premium opportunities...');
      
      // Filter for premium opportunities without contact info
      const premiumOpportunities = allOpportunities.filter(o => 
        o.isPremium && 
        (!o.contactInfo || 
          (typeof o.contactInfo === 'object' && 
            Object.keys(o.contactInfo).length === 0) ||
          (Array.isArray(o.contactInfo) && o.contactInfo.length === 0))
      );
      
      console.log(`Found ${premiumOpportunities.length} premium opportunities without contact information`);
      
      // Calculate current premium coverage
      const currentPremiumTotal = currentStats.premium_total;
      const currentPremiumWithContact = currentStats.premium_with_contact;
      const currentPremiumCoverage = currentPremiumWithContact / currentPremiumTotal;
      
      if (currentPremiumCoverage < targetPremiumCoverage) {
        const neededAdditional = Math.ceil(targetPremiumCoverage * currentPremiumTotal - currentPremiumWithContact);
        const toProcess = Math.min(neededAdditional, premiumOpportunities.length);
        
        console.log(`Need to add contact info to ${neededAdditional} premium opportunities to reach ${(targetPremiumCoverage * 100).toFixed(1)}% coverage`);
        console.log(`Will process ${toProcess} opportunities`);
        
        if (toProcess > 0) {
          // Select a subset to process
          const opportunitiesToProcess = premiumOpportunities.slice(0, toProcess);
          
          // Process in batches
          const totalPremiumBatches = Math.ceil(opportunitiesToProcess.length / batchSize);
          
          for (let batchIndex = 0; batchIndex < totalPremiumBatches; batchIndex++) {
            const start = batchIndex * batchSize;
            const end = Math.min(start + batchSize, opportunitiesToProcess.length);
            const batch = opportunitiesToProcess.slice(start, end);
            
            console.log(`Processing premium batch ${batchIndex + 1} of ${totalPremiumBatches} (${start + 1} to ${end} of ${opportunitiesToProcess.length})`);
            
            // Process opportunities in sequence
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
      } else {
        console.log(`Current premium coverage (${(currentPremiumCoverage * 100).toFixed(1)}%) already meets target of ${(targetPremiumCoverage * 100).toFixed(1)}%`);
      }
    } else {
      console.log('Skipping regular opportunities (premium-only mode)');
    }
    
    // Now process regular opportunities if not in premium-only mode
    if (!premiumOnly) {
      console.log('\nProcessing regular opportunities...');
      
      // Filter for regular opportunities without contact info
      const regularOpportunities = allOpportunities.filter(o => 
        !o.isPremium && 
        (!o.contactInfo || 
          (typeof o.contactInfo === 'object' && 
            Object.keys(o.contactInfo).length === 0) ||
          (Array.isArray(o.contactInfo) && o.contactInfo.length === 0))
      );
      
      console.log(`Found ${regularOpportunities.length} regular opportunities without contact information`);
      
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
    }
    
    // Get final stats
    const finalStatsResult = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as with_contact,
        SUM(CASE WHEN "isPremium" = true THEN 1 ELSE 0 END) as premium_total,
        SUM(CASE WHEN "isPremium" = true AND "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}' THEN 1 ELSE 0 END) as premium_with_contact
      FROM "discoveredOpportunities"
    `);
    
    console.log('Raw final DB result:', JSON.stringify(finalStatsResult));
    
    // Make sure we handle the result correctly
    if (!finalStatsResult || !finalStatsResult.rows || !finalStatsResult.rows.length) {
      console.error('Failed to get final stats');
      return;
    }
    
    const finalStats = finalStatsResult.rows[0];
    
    // Convert string numbers to actual numbers if needed
    const finalTotal = parseInt(finalStats.total as any) || 0;
    const finalWithContact = parseInt(finalStats.with_contact as any) || 0;
    const finalPremiumTotal = parseInt(finalStats.premium_total as any) || 0;
    const finalPremiumWithContact = parseInt(finalStats.premium_with_contact as any) || 0;
    
    console.log('\nFinal contact information coverage:');
    console.log(`- Total opportunities: ${finalTotal}`);
    console.log(`- With contact info: ${finalWithContact} (${((finalWithContact / finalTotal) * 100).toFixed(1)}%)`);
    console.log(`- Premium opportunities: ${finalPremiumTotal}`);
    console.log(`- Premium with contact info: ${finalPremiumWithContact} (${((finalPremiumWithContact / finalPremiumTotal) * 100).toFixed(1)}%)`);
    
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
      
      // Update the opportunity in the database with contact info if not in dry run mode
      if (!isDryRun) {
        await db.update(discoveredOpportunities)
          .set({
            contactInfo: contactInfo
          })
          .where(eq(discoveredOpportunities.id, opportunity.id));
        
        console.log(`Successfully updated opportunity #${opportunity.id} with contact information`);
        return true;
      } else {
        console.log(`[DRY RUN] Would update opportunity #${opportunity.id} with contact information`);
        return true;
      }
    } else {
      console.log(`No contact information found for opportunity #${opportunity.id}`);
      return false;
    }
  } catch (error) {
    console.error(`Error processing opportunity #${opportunity.id}:`, error);
    return false;
  }
}