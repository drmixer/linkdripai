/**
 * Simple Contact Extraction Test
 * 
 * This script performs a quick test of our contact extraction methods
 * on a known domain to verify functionality.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";

// Configuration
const REQUEST_TIMEOUT = 15000; // 15 second timeout

// Axios instance with optimal settings for web scraping
const axiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  maxRedirects: 5,
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  }
});

// Email extraction regex
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Social platform patterns
const SOCIAL_PLATFORM_PATTERNS = [
  { platform: "facebook", regex: /(?:facebook\.com|fb\.com)\/(?!share|sharer)([^/?&]+)/i },
  { platform: "twitter", regex: /(?:twitter\.com|x\.com)\/([^/?&]+)/i },
  { platform: "linkedin", regex: /linkedin\.com\/(?:company|in|school)\/([^/?&]+)/i },
  { platform: "instagram", regex: /instagram\.com\/([^/?&]+)/i },
  { platform: "youtube", regex: /youtube\.com\/(?:channel\/|user\/|c\/)?([^/?&]+)/i },
];

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  try {
    const trimmed = url.trim();
    
    // Check if the URL has a protocol
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'https://' + trimmed; // Add https by default
    }
    
    return trimmed;
  } catch (error) {
    console.error(`Error cleaning URL ${url}:`, error);
    return url;
  }
}

/**
 * Extract emails from HTML content
 */
async function extractEmails(url: string): Promise<string[]> {
  try {
    const response = await axiosInstance.get(cleanupUrl(url));
    const html = response.data;
    
    // Parse HTML
    const $ = cheerio.load(html);
    
    // Remove script and style elements which might contain false positives
    $('script, style, noscript').remove();
    
    // Get text content
    const text = $.text();
    
    // Extract emails using regex
    const emails: Set<string> = new Set();
    
    // Standard email format
    const matches = text.match(EMAIL_REGEX) || [];
    matches.forEach(email => emails.add(email.toLowerCase()));
    
    // Check mailto: links
    $('a[href^="mailto:"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const email = href.replace('mailto:', '').split('?')[0].toLowerCase();
        if (email.match(EMAIL_REGEX)) {
          emails.add(email);
        }
      }
    });
    
    return Array.from(emails);
  } catch (error) {
    console.error("Error extracting emails:", error);
    return [];
  }
}

/**
 * Extract social profiles from HTML
 */
async function extractSocialProfiles(url: string): Promise<{platform: string, url: string, username: string}[]> {
  try {
    const response = await axiosInstance.get(cleanupUrl(url));
    const html = response.data;
    
    // Parse HTML
    const $ = cheerio.load(html);
    
    const results: {platform: string, url: string, username: string}[] = [];
    
    // Extract from all links
    $('a').each((_, element) => {
      try {
        const href = $(element).attr('href');
        if (!href) return;
        
        // Try to normalize the URL
        let fullUrl: string;
        try {
          fullUrl = new URL(href, url).href;
        } catch (error) {
          return; // Skip invalid URLs
        }
        
        // Check against platform patterns
        for (const { platform, regex } of SOCIAL_PLATFORM_PATTERNS) {
          const match = fullUrl.match(regex);
          if (match && match[1]) {
            const username = match[1].replace(/\/$/, ''); // Remove trailing slash
            
            // Check for duplicates before adding
            if (!results.some(r => r.platform === platform && r.username === username)) {
              results.push({
                platform,
                url: fullUrl,
                username
              });
            }
          }
        }
      } catch (error) {
        // Skip problematic elements
      }
    });
    
    return results;
  } catch (error) {
    console.error("Error extracting social profiles:", error);
    return [];
  }
}

/**
 * Find a contact form URL
 */
async function findContactForm(url: string): Promise<string | null> {
  try {
    const response = await axiosInstance.get(cleanupUrl(url));
    const html = response.data;
    
    const $ = cheerio.load(html);
    
    // Look for contact links
    const contactLinks: string[] = [];
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      
      if (href && (
        text.includes('contact') || 
        text.includes('get in touch') || 
        text.includes('reach us')
      )) {
        try {
          // Convert relative to absolute URL
          let fullUrl = new URL(href, url).href;
          contactLinks.push(fullUrl);
        } catch (error) {
          // Skip invalid URLs
        }
      }
    });
    
    if (contactLinks.length > 0) {
      return contactLinks[0]; // Return the first contact link found
    }
    
    return null;
  } catch (error) {
    console.error("Error finding contact form:", error);
    return null;
  }
}

/**
 * Run a simple test of contact extraction
 */
async function runSimpleTest() {
  // Use semrush.com as a test domain that should have contact info
  const testUrl = 'https://semrush.com';
  
  console.log(`Testing contact extraction on ${testUrl}...`);
  
  try {
    // Test email extraction
    console.log("\nExtracting emails...");
    const emails = await extractEmails(testUrl);
    console.log(`Found ${emails.length} emails: ${JSON.stringify(emails)}`);
    
    // Test social profile extraction
    console.log("\nExtracting social profiles...");
    const socialProfiles = await extractSocialProfiles(testUrl);
    console.log(`Found ${socialProfiles.length} social profiles:`);
    socialProfiles.forEach(profile => {
      console.log(`- ${profile.platform}: ${profile.username}`);
    });
    
    // Test contact form finding
    console.log("\nFinding contact form...");
    const contactForm = await findContactForm(testUrl);
    console.log(`Contact form URL: ${contactForm}`);
    
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
runSimpleTest().catch(console.error);