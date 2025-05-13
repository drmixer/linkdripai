/**
 * This script specifically updates premium opportunities with structured contact information
 * by extracting it from pages and storing it in the contactInfo field
 */
import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import axios from 'axios';

// Set a user agent to avoid being blocked
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36';

/**
 * Extract emails from a webpage
 */
async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    console.log(`Fetching ${url} to extract emails...`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      console.log(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const html = response.data;
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
      !email.includes('your@')
    );
    
    console.log(`Found ${filteredEmails.length} emails on ${url}`);
    return Array.from(new Set(filteredEmails)); // Remove duplicates
  } catch (error) {
    console.log(`Failed to fetch ${url}: ${error.message}`);
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
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      return null;
    }
    
    const $ = cheerio.load(response.data);
    
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
    for (const path of contactPaths) {
      const contactUrl = `${baseUrl.protocol}//${domain}${path}`;
      try {
        const contactResponse = await axios.head(contactUrl, {
          headers: {
            'User-Agent': USER_AGENT
          },
          timeout: 5000
        });
        
        if (contactResponse.status === 200) {
          return contactUrl;
        }
      } catch (error) {
        // Continue to the next path on error
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.log(`Error finding contact form: ${error.message}`);
    return null;
  }
}

/**
 * Extract social media profiles from a page
 */
async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string}>> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 10000
    });
    
    if (response.status !== 200) {
      return [];
    }
    
    const $ = cheerio.load(response.data);
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
    .limit(25); // Process in batches
  
  console.log(`Found ${opportunities.length} premium opportunities that need contact info`);
  
  let updatedCount = 0;
  let failedCount = 0;
  
  for (const opp of opportunities) {
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
        
        // Use first email as primary if not already set
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
        const emails = await extractEmailsFromPage(opp.url);
        if (emails.length > 0) {
          contactInfoObj.email = emails[0];
          if (emails.length > 1) {
            contactInfoObj.additionalEmails = emails.slice(1);
          }
          
          // Update metadata as well
          metadataObj.allEmails = emails;
        }
      }
      
      // Always try to find a contact form for premium opportunities
      const contactFormUrl = await findContactFormUrl(opp.url);
      if (contactFormUrl) {
        contactInfoObj.form = contactFormUrl;
        metadataObj.contactFormUrl = contactFormUrl;
      }
      
      // Extract social profiles if not already in metadata
      if (!metadataObj.socialProfiles || !Array.isArray(metadataObj.socialProfiles) || metadataObj.socialProfiles.length === 0) {
        const socialProfiles = await extractSocialProfiles(opp.url);
        if (socialProfiles.length > 0) {
          contactInfoObj.social = socialProfiles;
          metadataObj.socialProfiles = socialProfiles;
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
    } catch (error) {
      console.error(`Error updating opportunity #${opp.id}:`, error);
      failedCount++;
    }
    
    // Add a small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
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