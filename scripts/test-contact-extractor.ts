/**
 * Test Advanced Contact Extractor
 * 
 * This script tests the advanced contact extractor on a small sample of URLs
 * without making any database changes.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

// Configuration Constants
const MAX_RETRIES = 3;
const THROTTLE_DELAY = 3000;
const USER_AGENT_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0'
];

// Domain request trackers for throttling
const lastRequestByDomain: { [domain: string]: number } = {};

// Test URLs to check extraction capabilities
const TEST_URLS = [
  'https://moz.com/about/contact',
  'https://ahrefs.com/contact',
  'https://backlinko.com/contact',
  'https://www.semrush.com/company/contact-us/'
];

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return USER_AGENT_LIST[Math.floor(Math.random() * USER_AGENT_LIST.length)];
}

/**
 * Calculate exponential backoff with jitter for smarter retries
 */
function calculateBackoff(retry: number): number {
  const expBackoff = Math.min(30000, 1000 * Math.pow(2, retry));
  return expBackoff + Math.random() * 1000;
}

/**
 * Check if we should throttle requests to a domain
 */
function shouldThrottleDomain(domain: string): boolean {
  const now = Date.now();
  const lastRequest = lastRequestByDomain[domain] || 0;
  
  if (now - lastRequest < THROTTLE_DELAY) {
    return true;
  }
  
  lastRequestByDomain[domain] = now;
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
 * Fetch HTML content from a URL
 */
async function fetchHtml(url: string): Promise<string | null> {
  const domain = extractDomain(url);
  
  // Apply domain throttling
  if (shouldThrottleDomain(domain)) {
    console.log(`Throttling request to ${domain}, waiting ${THROTTLE_DELAY}ms...`);
    await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
  }
  
  let retries = 0;
  
  while (retries <= MAX_RETRIES) {
    try {
      console.log(`Fetching ${url}...`);
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      
      if (response.status === 200 && response.data) {
        return response.data;
      }
    } catch (error: any) {
      console.error(`Error fetching ${url}: ${error.message}`);
      retries++;
      
      if (retries > MAX_RETRIES) {
        console.error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
        break;
      }
      
      const backoffTime = calculateBackoff(retries);
      console.log(`Retry ${retries}/${MAX_RETRIES} for ${url} in ${Math.round(backoffTime)}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
  
  return null;
}

/**
 * Extract emails from a webpage
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const bodyText = $('body').text();
    
    // Regular expression for standard email format
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = bodyText.match(emailPattern) || [];
    
    // Look for "mailto:" links
    $('a[href^="mailto:"]').each((_, element) => {
      const mailtoHref = $(element).attr('href') || '';
      const email = mailtoHref.replace('mailto:', '').split('?')[0].trim();
      if (email && email.includes('@')) {
        emailMatches.push(email);
      }
    });
    
    return [...new Set(emailMatches)]; // Remove duplicates
  } catch (error) {
    console.error(`Error extracting emails from ${url}:`, error);
    return [];
  }
}

/**
 * Extract social media profiles from a page
 */
async function extractSocialProfiles(url: string): Promise<string[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const socialProfiles: string[] = [];
    
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      const cleanHref = href.split('?')[0].toLowerCase();
      
      if (cleanHref.includes('linkedin.com')) {
        socialProfiles.push(`LinkedIn: ${cleanHref}`);
      } else if (cleanHref.includes('twitter.com') || cleanHref.includes('x.com')) {
        socialProfiles.push(`Twitter: ${cleanHref}`);
      } else if (cleanHref.includes('facebook.com')) {
        socialProfiles.push(`Facebook: ${cleanHref}`);
      } else if (cleanHref.includes('instagram.com')) {
        socialProfiles.push(`Instagram: ${cleanHref}`);
      } else if (cleanHref.includes('youtube.com')) {
        socialProfiles.push(`YouTube: ${cleanHref}`);
      }
    });
    
    return [...new Set(socialProfiles)]; // Remove duplicates
  } catch (error) {
    console.error(`Error extracting social profiles from ${url}:`, error);
    return [];
  }
}

/**
 * Main function to test the contact extraction
 */
async function testContactExtraction(): Promise<void> {
  console.log('Starting contact extraction test...\n');
  
  for (const url of TEST_URLS) {
    console.log(`\n=== Testing URL: ${url} ===\n`);
    
    try {
      // Extract emails
      console.log('Extracting emails...');
      const emails = await extractEmailsFromPage(url);
      if (emails.length > 0) {
        console.log(`Found ${emails.length} emails:`);
        emails.forEach(email => console.log(`- ${email}`));
      } else {
        console.log('No emails found.');
      }
      
      // Extract social profiles
      console.log('\nExtracting social profiles...');
      const socialProfiles = await extractSocialProfiles(url);
      if (socialProfiles.length > 0) {
        console.log(`Found ${socialProfiles.length} social profiles:`);
        socialProfiles.forEach(profile => console.log(`- ${profile}`));
      } else {
        console.log('No social profiles found.');
      }
      
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }
  
  console.log('\nContact extraction test completed.');
}

// Run the test
testContactExtraction().catch(console.error);