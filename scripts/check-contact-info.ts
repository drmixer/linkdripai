/**
 * This script checks the status of contact information for opportunities
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function checkContactInfo() {
  console.log('Analyzing contact information for opportunities...');
  
  try {
    // Get all opportunities
    const allOpportunities = await db.select()
      .from(discoveredOpportunities);
    
    // Get opportunities with contactInfo
    const opportunitiesWithContactInfo = allOpportunities.filter(
      opp => opp.contactInfo !== null
    );
    
    // Basic stats
    console.log(`
Total opportunities in database: ${allOpportunities.length}
Opportunities with contact info: ${opportunitiesWithContactInfo.length} (${((opportunitiesWithContactInfo.length / allOpportunities.length) * 100).toFixed(2)}%)
    `);
    
    // Detailed contact info analysis
    let opportunitiesWithEmail = 0;
    let opportunitiesWithForm = 0;
    let opportunitiesWithSocial = 0;
    let opportunitiesWithMultipleEmails = 0;
    let opportunitiesWithMultipleSocial = 0;
    
    // Premium opportunity stats
    const premiumOpportunities = allOpportunities.filter(opp => opp.isPremium === true);
    const premiumWithContactInfo = premiumOpportunities.filter(opp => opp.contactInfo !== null);
    
    // Count by social platform type
    const socialPlatformCounts: Record<string, number> = {};
    
    // Collect sample opportunities with good contact info
    const sampleOpportunitiesWithGoodContactInfo: any[] = [];
    
    for (const opp of opportunitiesWithContactInfo) {
      try {
        // Parse contact info
        const contactInfo = typeof opp.contactInfo === 'string' 
          ? JSON.parse(opp.contactInfo) 
          : opp.contactInfo;
          
        // Check for email
        let hasEmail = false;
        if (contactInfo.email) {
          opportunitiesWithEmail++;
          hasEmail = true;
        }
        
        // Check for additional emails
        if (contactInfo.emails && Array.isArray(contactInfo.emails) && contactInfo.emails.length > 0) {
          opportunitiesWithMultipleEmails++;
          hasEmail = true;
        }
        
        // For backwards compatibility, check additionalEmails field too
        if (contactInfo.additionalEmails && Array.isArray(contactInfo.additionalEmails) && contactInfo.additionalEmails.length > 0) {
          opportunitiesWithMultipleEmails++;
          hasEmail = true;
        }
        
        // If we didn't find email in the standard fields, do one more check
        if (!hasEmail && typeof contactInfo === 'object') {
          // Try to find any property that might contain an email
          for (const key in contactInfo) {
            const value = contactInfo[key];
            if (typeof value === 'string' && value.includes('@') && !value.includes('.jpg') && !value.includes('.png')) {
              opportunitiesWithEmail++;
              hasEmail = true;
              break;
            }
          }
        }
        
        // Check for contact form
        let hasForm = false;
        if (contactInfo.form) {
          opportunitiesWithForm++;
          hasForm = true;
        } else if (contactInfo.contactForm) {
          opportunitiesWithForm++;
          hasForm = true;
        }
        
        // Check for social profiles
        let hasSocial = false;
        let socialProfiles: any[] = [];
        
        if (contactInfo.social && Array.isArray(contactInfo.social)) {
          socialProfiles = contactInfo.social;
          hasSocial = socialProfiles.length > 0;
        } else if (contactInfo.socialProfiles && Array.isArray(contactInfo.socialProfiles)) {
          socialProfiles = contactInfo.socialProfiles;
          hasSocial = socialProfiles.length > 0;
        }
        
        if (hasSocial) {
          opportunitiesWithSocial++;
          
          if (socialProfiles.length > 1) {
            opportunitiesWithMultipleSocial++;
          }
          
          // Count by platform
          for (const profile of socialProfiles) {
            if (profile.platform) {
              socialPlatformCounts[profile.platform] = (socialPlatformCounts[profile.platform] || 0) + 1;
            }
          }
        }
        
        // Collect sample opportunities with good contact info
        if ((hasEmail || hasForm) && hasSocial) {
          // Only collect a max of 5 samples
          if (sampleOpportunitiesWithGoodContactInfo.length < 5) {
            sampleOpportunitiesWithGoodContactInfo.push({
              id: opp.id,
              domain: opp.domain,
              isPremium: opp.isPremium,
              email: contactInfo.email,
              form: contactInfo.form || contactInfo.contactForm,
              socialCount: socialProfiles.length,
              platforms: socialProfiles.map((p: any) => p.platform).join(', ')
            });
          }
        }
        
      } catch (error) {
        console.error(`Error parsing contact info for opportunity ${opp.id}: ${error.message}`);
      }
    }
    
    // Print detailed stats
    console.log(`
Detailed contact information analysis:
- Opportunities with email: ${opportunitiesWithEmail} (${((opportunitiesWithEmail / allOpportunities.length) * 100).toFixed(2)}%)
- Opportunities with multiple emails: ${opportunitiesWithMultipleEmails} (${((opportunitiesWithMultipleEmails / allOpportunities.length) * 100).toFixed(2)}%)
- Opportunities with contact form: ${opportunitiesWithForm} (${((opportunitiesWithForm / allOpportunities.length) * 100).toFixed(2)}%)
- Opportunities with social profiles: ${opportunitiesWithSocial} (${((opportunitiesWithSocial / allOpportunities.length) * 100).toFixed(2)}%)
- Opportunities with multiple social profiles: ${opportunitiesWithMultipleSocial} (${((opportunitiesWithMultipleSocial / allOpportunities.length) * 100).toFixed(2)}%)

Premium opportunity stats:
- Total premium opportunities: ${premiumOpportunities.length} (${((premiumOpportunities.length / allOpportunities.length) * 100).toFixed(2)}% of total)
- Premium opportunities with contact info: ${premiumWithContactInfo.length} (${((premiumWithContactInfo.length / premiumOpportunities.length) * 100).toFixed(2)}% of premium)

Social platform distribution:
${Object.entries(socialPlatformCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([platform, count]) => `- ${platform}: ${count} (${((count / opportunitiesWithSocial) * 100).toFixed(2)}% of social profiles)`)
  .join('\n')}

Sample opportunities with good contact info:
${sampleOpportunitiesWithGoodContactInfo.map(sample => 
  `- ID: ${sample.id}, Domain: ${sample.domain}, Premium: ${sample.isPremium ? 'Yes' : 'No'}
   Email: ${sample.email || 'None'}, Form: ${sample.form ? 'Yes' : 'No'}, Social: ${sample.socialCount} (${sample.platforms})`
).join('\n')}
    `);
    
  } catch (error: any) {
    console.error(`Error analyzing contact information: ${error.message}`);
  }
}

// Run the script
checkContactInfo()
  .catch(error => {
    console.error('Error running script:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script execution completed');
  });