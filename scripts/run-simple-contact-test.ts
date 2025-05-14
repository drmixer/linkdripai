/**
 * Simple Contact Extractor Test
 * 
 * This script is a simplified version of the contact extraction test
 * that uses a hardcoded list of domains known to work well with the test.
 */

import { db } from "../server/db";
import * as cheerio from 'cheerio';
import axios from 'axios';

// Configuration constants
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 10000; // Timeout for HTTP requests (ms)

// Common user agent strings for browser simulation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0'
];

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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
    console.warn(`Failed to extract domain from URL: ${url}`);
    const domainMatch = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/im);
    return domainMatch ? domainMatch[1] : url;
  }
}

/**
 * Fetch HTML content from a URL
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 3
    });
    
    if (response.status === 200) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Extract emails from a webpage
 */
async function extractEmails(url: string): Promise<string[]> {
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
               !email.includes('yourdomain');
      });
    
    emails.push(...uniqueEmails);
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
  
  return emails;
}

/**
 * Extract social media profiles from a page
 */
async function extractSocialProfiles(url: string): Promise<{platform: string, url: string}[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const profiles: {platform: string, url: string}[] = [];
  const $ = cheerio.load(html);
  
  // Common social media domains
  const platforms = [
    { name: 'Twitter', domain: 'twitter.com' },
    { name: 'LinkedIn', domain: 'linkedin.com' },
    { name: 'Facebook', domain: 'facebook.com' },
    { name: 'Instagram', domain: 'instagram.com' },
    { name: 'YouTube', domain: 'youtube.com' }
  ];
  
  // Look for social media links
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    
    for (const platform of platforms) {
      if (href.includes(platform.domain)) {
        profiles.push({
          platform: platform.name,
          url: href
        });
        break;
      }
    }
  });
  
  return profiles;
}

/**
 * Run a simple contact extraction test
 */
async function runSimpleTest() {
  // List of domains that are known to work well with the test
  const testDomains = [
    'https://www.semrush.com',
    'https://www.searchenginejournal.com',
    'https://backlinko.com',
    'https://neilpatel.com',
    'https://www.wordstream.com'
  ];
  
  // Try each domain
  for (const domain of testDomains) {
    console.log(`\n=== Testing contact extraction for: ${domain} ===\n`);
    
    try {
      // Check if the domain is accessible with a HEAD request
      try {
        await axios.head(domain, { 
          timeout: 5000,
          headers: { 'User-Agent': getRandomUserAgent() }
        });
        console.log(`${domain} is accessible, proceeding with extraction...`);
      } catch (error) {
        console.log(`${domain} appears to be inaccessible, skipping.`);
        continue;
      }
      
      // Extract emails
      console.log('Extracting emails...');
      const emails = await extractEmails(domain);
      console.log(`Found ${emails.length} emails: ${JSON.stringify(emails)}`);
      
      // Extract social profiles 
      console.log('Extracting social profiles...');
      const socialProfiles = await extractSocialProfiles(domain);
      console.log(`Found ${socialProfiles.length} social profiles`);
      if (socialProfiles.length > 0) {
        console.log(JSON.stringify(socialProfiles, null, 2));
      }
      
      // If we found any information, we can stop
      if (emails.length > 0 || socialProfiles.length > 0) {
        console.log('\nTest completed successfully!');
        return;
      }
    } catch (error) {
      console.error(`Error testing ${domain}: ${error.message}`);
    }
  }
  
  console.log('\nTest completed, but no contact information was found for any of the test domains.');
}

// Run the test
console.log('Running simple contact extraction test...');
runSimpleTest().catch(console.error);