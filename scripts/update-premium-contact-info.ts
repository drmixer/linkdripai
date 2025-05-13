/**
 * This script specifically updates premium opportunities with structured contact information
 * by extracting it from pages and storing it in the contactInfo field
 */
import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import axios from 'axios';

// Set a user agent to avoid being blocked - rotated to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.58 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:99.0) Gecko/20100101 Firefox/99.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:99.0) Gecko/20100101 Firefox/99.0',
];

// Get a random user agent
function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

// Fetch HTML content with retry capability
async function fetchHtml(url: string, maxRetries = 2): Promise<string | null> {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 8000, // Shorter timeout
        maxRedirects: 3,
      });
      
      if (response.status === 200) {
        return response.data;
      }
      
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return null;
    } catch (error) {
      retries++;
      const waitTime = retries * 1000; // Progressive backoff
      
      if (retries <= maxRetries) {
        console.log(`Retry ${retries}/${maxRetries} for ${url} after ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.log(`Failed to fetch ${url} after ${maxRetries} retries: ${error.message}`);
        return null;
      }
    }
  }
  
  return null;
}

/**
 * Extract emails from a webpage
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    console.log(`Fetching ${url} to extract emails...`);
    const html = await fetchHtml(url);
    
    if (!html) {
      return [];
    }
    
    // Email regex pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = html.match(emailRegex) || [];
    
    // Filter out common false positives and system emails
    const filteredEmails = emails.filter(email => 
      !email.includes('example.com') && 
      !email.includes('yourdomain.com') &&
      !email.includes('domain.com') &&
      !email.includes('email@') &&
      !email.endsWith('.png') &&
      !email.endsWith('.jpg') &&
      !email.includes('your@') &&
      !email.includes('@example') &&
      !email.includes('@your')
    );
    
    console.log(`Found ${filteredEmails.length} emails on ${url}`);
    return Array.from(new Set(filteredEmails)); // Remove duplicates
  } catch (error) {
    console.log(`Failed to extract emails from ${url}: ${error.message}`);
    return [];
  }
}

/**
 * Find a contact form URL on a website
 */
async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    // Normalize the URL
    const baseUrl = new URL(url);
    const domain = baseUrl.hostname;
    
    // Common paths for contact pages
    const contactPaths = [
      '/contact',
      '/contact-us',
      '/connect',
      '/get-in-touch',
      '/reach-us',
      '/about/contact',
      '/about-us/contact',
      '/about/connect'
    ];
    
    // Try to find a contact link on the page
    const html = await fetchHtml(url);
    
    if (!html) {
      // If we couldn't get the page, try direct paths
      return await checkCommonContactPaths(baseUrl.protocol, domain, contactPaths);
    }
    
    const $ = cheerio.load(html);
    
    // Look for contact links in the navigation and footer
    const contactLinks = $('a').filter(function(i, el) {
      const href = $(el).attr('href');
      const text = $(el).text().toLowerCase();
      
      return !!(
        href && 
        (text.includes('contact') || 
         text.includes('connect') || 
         text.includes('get in touch') ||
         href.includes('contact') ||
         href.includes('connect'))
      );
    });
    
    if (contactLinks.length > 0) {
      const href = contactLinks.first().attr('href');
      
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
    
    // If no link found on the page, try common contact paths
    return await checkCommonContactPaths(baseUrl.protocol, domain, contactPaths);
  } catch (error) {
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
 * Extract social media profiles from a page
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string}>> {
  try {
    const html = await fetchHtml(url);
    
    if (!html) {
      return [];
    }
    
    const $ = cheerio.load(html);
    const profiles: Array<{platform: string, url: string, username: string}> = [];
    
    // Social media platforms to look for
    const platforms = [
      { name: 'facebook', pattern: /facebook\.com/ },
      { name: 'twitter', pattern: /twitter\.com|x\.com/ },
      { name: 'linkedin', pattern: /linkedin\.com/ },
      { name: 'instagram', pattern: /instagram\.com/ },
      { name: 'youtube', pattern: /youtube\.com/ },
      { name: 'pinterest', pattern: /pinterest\.com/ },
      { name: 'github', pattern: /github\.com/ }
    ];
    
    // Find social links
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      
      for (const platform of platforms) {
        if (platform.pattern.test(href)) {
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
    
    return profiles;
  } catch (error) {
    console.log(`Error extracting social profiles: ${error.message}`);
    return [];
  }
}

async function updatePremiumOpportunityContactInfo() {
  console.log('Starting to update contact information for premium opportunities...');
  
  // Get premium opportunities without contact info
  const opportunities = await db.select()
    .from(discoveredOpportunities)
    .where(sql`"isPremium" = true AND "contactInfo" IS NULL`)
    .limit(20); // Process fewer to avoid timeouts
  
  console.log(`Found ${opportunities.length} premium opportunities that need contact info`);
  
  let updatedCount = 0;
  let failedCount = 0;
  
  // Number of parallel requests to make at once - smaller batch size to avoid overloading
  const BATCH_SIZE = 3;
  
  // Process in parallel batches
  for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
    const batch = opportunities.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch of ${batch.length} opportunities (${i+1} to ${Math.min(i+BATCH_SIZE, opportunities.length)} of ${opportunities.length})`);
    
    // Process batch in parallel
    const promises = batch.map(async (opp) => {
      try {
        console.log(`Processing premium opportunity #${opp.id}: ${opp.domain}`);
        
        let contactInfoObj: Record<string, any> = {};
        let metadataObj: Record<string, any> = {};
        
        // Parse existing metadata if available
        if (opp.rawData) {
          try {
            metadataObj = typeof opp.rawData === 'string' ? JSON.parse(opp.rawData) : opp.rawData;
          } catch (e) {
            console.log(`Error parsing metadata for opportunity #${opp.id}`);
          }
        }
        
        // Check if we already have email info in metadata
        if (metadataObj.allEmails && Array.isArray(metadataObj.allEmails) && metadataObj.allEmails.length > 0) {
          contactInfoObj.additionalEmails = metadataObj.allEmails;
          
          // Use first email as primary
          if (metadataObj.allEmails.length > 0) {
            contactInfoObj.email = metadataObj.allEmails[0];
          }
        } 
        // If we have a contact email in the metadata
        else if (metadataObj.contactEmail) {
          contactInfoObj.email = metadataObj.contactEmail;
        }
        // If we have no email info at all, try to fetch from the page
        else {
          try {
            const emails = await extractEmailsFromPage(opp.url);
            if (emails.length > 0) {
              contactInfoObj.email = emails[0];
              if (emails.length > 1) {
                contactInfoObj.additionalEmails = emails.slice(1);
              }
              
              // Update metadata as well
              metadataObj.allEmails = emails;
            }
          } catch (emailError) {
            console.log(`Error extracting emails from ${opp.url}: ${emailError.message}`);
          }
        }
        
        // Always use the domain homepage as the primary URL for extracting contact info
        const baseUrl = new URL(opp.url);
        const homepageUrl = `${baseUrl.protocol}//${baseUrl.hostname}`;
        
        // Try to find a contact form - homepage is more likely to have navigation to contact page
        try {
          // Try homepage first, then fall back to specific page URL
          const contactFormUrl = await findContactFormUrl(homepageUrl) || 
                               await findContactFormUrl(opp.url);
          
          if (contactFormUrl) {
            contactInfoObj.form = contactFormUrl;
            metadataObj.contactFormUrl = contactFormUrl;
          }
        } catch (formError) {
          console.log(`Error finding contact form for ${homepageUrl}: ${formError.message}`);
        }
        
        // If we don't have emails yet, try to extract from homepage
        if (!contactInfoObj.email && !contactInfoObj.additionalEmails) {
          try {
            const emails = await extractEmailsFromPage(homepageUrl);
            if (emails.length > 0) {
              contactInfoObj.email = emails[0];
              if (emails.length > 1) {
                contactInfoObj.additionalEmails = emails.slice(1);
              }
              
              // Update metadata as well
              metadataObj.allEmails = emails;
            }
          } catch (emailError) {
            console.log(`Error extracting emails from homepage: ${emailError.message}`);
          }
        }
        
        // Extract social profiles if not already in metadata
        if (!metadataObj.socialProfiles || !Array.isArray(metadataObj.socialProfiles) || metadataObj.socialProfiles.length === 0) {
          try {
            // Prioritize homepage for social profiles since they're usually in the footer
            const socialProfiles = await extractSocialProfiles(homepageUrl);
                                
            if (socialProfiles.length > 0) {
              contactInfoObj.social = socialProfiles;
              metadataObj.socialProfiles = socialProfiles;
            }
          } catch (socialError) {
            console.log(`Error extracting social profiles for ${homepageUrl}: ${socialError.message}`);
          }
        } else if (metadataObj.socialProfiles && Array.isArray(metadataObj.socialProfiles) && metadataObj.socialProfiles.length > 0) {
          contactInfoObj.social = metadataObj.socialProfiles;
        }
        
        // Update the database - use quoted names for PostgreSQL
        await db.execute(sql`
          UPDATE "discoveredOpportunities"
          SET "contactInfo" = ${Object.keys(contactInfoObj).length > 0 ? JSON.stringify(contactInfoObj) : null}, 
              "rawData" = ${JSON.stringify(metadataObj)}
          WHERE "id" = ${opp.id}
        `);
        
        updatedCount++;
        console.log(`Updated contact info for premium opportunity #${opp.id}`);
        return true;
      } catch (error) {
        console.error(`Error updating opportunity #${opp.id}:`, error);
        failedCount++;
        return false;
      }
    });
    
    // Wait for all promises in this batch to resolve
    await Promise.all(promises);
    
    // Add a small delay between batches to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`Contact info update complete for premium opportunities. Updated: ${updatedCount}, Failed: ${failedCount}`);
  
  // If there are more opportunities to process, you can run again
  const remainingCount = await db.execute(sql`
    SELECT COUNT(*) FROM "discoveredOpportunities" 
    WHERE "isPremium" = true AND "contactInfo" IS NULL
  `);
  
  console.log(`Remaining premium opportunities to process: ${remainingCount.rows[0]?.count || 0}`);
}

// Run the script
updatePremiumOpportunityContactInfo()
  .catch(error => {
    console.error('Error running script:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script execution completed');
  });