/**
 * This script updates existing opportunities with structured contact information
 * by extracting it from the metadataRaw field and storing it in the contactInfo field
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { load } from 'cheerio';
import fetch from 'node-fetch';

// Social media detection patterns
const socialMediaPatterns = [
  { platform: 'twitter', regex: /twitter\.com\/([^\/\?"']+)/ },
  { platform: 'facebook', regex: /facebook\.com\/([^\/\?"']+)/ },
  { platform: 'linkedin', regex: /linkedin\.com\/(?:company|in)\/([^\/\?"']+)/ },
  { platform: 'instagram', regex: /instagram\.com\/([^\/\?"']+)/ },
  { platform: 'pinterest', regex: /pinterest\.com\/([^\/\?"']+)/ },
  { platform: 'youtube', regex: /youtube\.com\/(?:channel|user|c)\/([^\/\?"']+)/ },
  { platform: 'github', regex: /github\.com\/([^\/\?"']+)/ }
];

async function extractEmailsFromPage(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return [];
    }

    const html = await response.text();
    const $ = load(html);

    // Extract text while filtering out scripts, styles, etc.
    $('script, style, noscript, iframe, embed, object').remove();
    const bodyText = $('body').text().replace(/\\s+/g, ' ').trim();

    // Extract emails
    const emailRegex = /[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,125}[a-zA-Z]{2,63}/g;
    const tempEmails = bodyText.match(emailRegex) || [];

    // Also check for mailto links
    const mailtoEmails: string[] = [];
    $('a[href^="mailto:"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.startsWith('mailto:')) {
        const email = href.substring(7).split('?')[0].trim();
        if (email && email.includes('@')) {
          mailtoEmails.push(email);
        }
      }
    });

    // Combine and filter emails
    const allEmails = [...new Set([...tempEmails, ...mailtoEmails])];
    return allEmails.filter(email => 
      !email.includes('example.com') && 
      !email.includes('domain.com') && 
      !email.startsWith('email@') &&
      !email.includes('your@') &&
      !email.includes('@example') &&
      email.length < 100
    ).slice(0, 5); // Limit to 5 emails
  } catch (error) {
    console.error(`Error extracting emails from ${url}:`, error);
    return [];
  }
}

async function findContactFormUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    // Check for contact links
    const contactSelectors = [
      'a[href*="contact"]', 
      'a[href*="about"]', 
      'a:contains("Contact")', 
      'a:contains("About")',
      'a[href*="reach-us"]',
      'a[href*="reach-out"]',
      'a[href*="get-in-touch"]'
    ];

    let contactUrl = null;

    for (const selector of contactSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        const href = elements.first().attr('href');
        if (href) {
          try {
            const resolvedUrl = new URL(href, url).toString();
            contactUrl = resolvedUrl;
            break;
          } catch (error) {
            // Invalid URL, continue with next selector
          }
        }
      }
    }

    return contactUrl;
  } catch (error) {
    console.error(`Error finding contact form for ${url}:`, error);
    return null;
  }
}

async function extractSocialProfiles(url: string): Promise<Array<{platform: string, url: string, username: string}>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const $ = load(html);

    const socialProfiles: Array<{platform: string, url: string, username: string}> = [];
    
    // Find social media links in all <a> tags
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      for (const pattern of socialMediaPatterns) {
        const match = href.match(pattern.regex);
        if (match && match[1]) {
          try {
            const profileUrl = new URL(href.startsWith('http') ? href : `https://${href}`).toString();
            socialProfiles.push({
              platform: pattern.platform,
              url: profileUrl,
              username: match[1]
            });
          } catch (error) {
            // Invalid URL, skip
          }
        }
      }
    });

    // Remove duplicates (same platform and username)
    const uniqueProfiles: Array<{platform: string, url: string, username: string}> = [];
    const seen = new Set<string>();
    
    for (const profile of socialProfiles) {
      const key = `${profile.platform}:${profile.username}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProfiles.push(profile);
      }
    }

    return uniqueProfiles;
  } catch (error) {
    console.error(`Error extracting social profiles from ${url}:`, error);
    return [];
  }
}

async function updateOpportunityContactInfo() {
  console.log('Starting to update contact information for opportunities...');
  
  // Get all opportunities without contact info
  const opportunities = await db.select()
    .from(discoveredOpportunities)
    .where(sql`contactInfo IS NULL`)
    .limit(50); // Process in batches
  
  console.log(`Found ${opportunities.length} opportunities that need contact info`);
  
  let updatedCount = 0;
  let failedCount = 0;
  
  for (const opp of opportunities) {
    try {
      console.log(`Processing opportunity #${opp.id}: ${opp.domain}`);
      
      let contactInfoObj: Record<string, any> = {};
      let metadataObj: Record<string, any> = {};
      
      // Parse existing metadata if available
      if (opp.metadataRaw) {
        try {
          metadataObj = JSON.parse(typeof opp.metadataRaw === 'string' ? opp.metadataRaw : '{}');
        } catch (e) {
          console.log(`Error parsing metadata for opportunity #${opp.id}`);
        }
      }
      
      // Check if we already have email info in metadata
      if (metadataObj.allEmails && Array.isArray(metadataObj.allEmails) && metadataObj.allEmails.length > 0) {
        contactInfoObj.additionalEmails = metadataObj.allEmails;
        
        // Use first email as primary if not already set
        if (!opp.contactEmail && metadataObj.allEmails.length > 0) {
          contactInfoObj.email = metadataObj.allEmails[0];
        }
      } 
      // If we don't have stored emails but have a contactEmail
      else if (opp.contactEmail) {
        contactInfoObj.email = opp.contactEmail;
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
      
      // Check for contact form
      if (opp.hasContactForm) {
        const contactFormUrl = await findContactFormUrl(opp.url);
        if (contactFormUrl) {
          contactInfoObj.form = contactFormUrl;
          metadataObj.contactFormUrl = contactFormUrl;
        } else {
          contactInfoObj.form = opp.url; // Default to the page URL
        }
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
      
      // Update the database
      await db.update(discoveredOpportunities)
        .set({ 
          contactInfo: Object.keys(contactInfoObj).length > 0 ? contactInfoObj : null,
          metadataRaw: JSON.stringify(metadataObj)
        })
        .where(eq(discoveredOpportunities.id, opp.id));
      
      updatedCount++;
      console.log(`Updated contact info for opportunity #${opp.id}`);
    } catch (error) {
      console.error(`Error updating opportunity #${opp.id}:`, error);
      failedCount++;
    }
    
    // Add a small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`Contact info update complete. Updated: ${updatedCount}, Failed: ${failedCount}`);
  
  // If there are more opportunities to process, you can run again
  const remainingCount = await db.select({ count: sql`count(*)` })
    .from(discoveredOpportunities)
    .where(sql`contactInfo IS NULL`);
  
  console.log(`Remaining opportunities to process: ${remainingCount[0]?.count || 0}`);
}

// Run the script
updateOpportunityContactInfo()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });