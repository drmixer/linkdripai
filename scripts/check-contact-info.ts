/**
 * This script checks the status of contact information for opportunities
 */
import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function checkContactInfo() {
  console.log('Checking contact information status for opportunities...');
  
  try {
    // Count total opportunities
    const [totalCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities);
    
    // Count premium opportunities
    const [premiumCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`"isPremium" = true`);
    
    // Count opportunities with contact info
    const [withContactInfoCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`"contactInfo" IS NOT NULL`);
    
    // Count premium opportunities with contact info
    const [premiumWithContactInfoCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`"isPremium" = true AND "contactInfo" IS NOT NULL`);
    
    // Count opportunities with emails (checking both 'email' and 'emails' fields)
    const [withEmailCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`("contactInfo"->>'email' IS NOT NULL AND "contactInfo"->>'email' != 'null') OR 
               ("contactInfo"->'emails' IS NOT NULL AND jsonb_array_length("contactInfo"->'emails') > 0)`);
    
    // Count premium opportunities with emails
    const [premiumWithEmailCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`"isPremium" = true AND 
              (("contactInfo"->>'email' IS NOT NULL AND "contactInfo"->>'email' != 'null') OR 
               ("contactInfo"->'emails' IS NOT NULL AND jsonb_array_length("contactInfo"->'emails') > 0))`);
    
    // Count opportunities with contact forms (checking both 'form' and 'contactForm' fields)
    const [withFormCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`("contactInfo"->>'form' IS NOT NULL AND "contactInfo"->>'form' != 'null') OR
              ("contactInfo"->>'contactForm' IS NOT NULL AND "contactInfo"->>'contactForm' != 'null')`);
    
    // Count premium opportunities with contact forms
    const [premiumWithFormCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`"isPremium" = true AND 
              (("contactInfo"->>'form' IS NOT NULL AND "contactInfo"->>'form' != 'null') OR
               ("contactInfo"->>'contactForm' IS NOT NULL AND "contactInfo"->>'contactForm' != 'null'))`);
    
    // Count opportunities with social profiles
    const [withSocialCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`("contactInfo"->'social' IS NOT NULL AND jsonb_array_length("contactInfo"->'social') > 0) OR 
              ("contactInfo"->'socialProfiles' IS NOT NULL AND jsonb_array_length("contactInfo"->'socialProfiles') > 0)`);
    
    // Count premium opportunities with social profiles
    const [premiumWithSocialCount] = await db.select({
      count: sql`count(*)`
    })
    .from(discoveredOpportunities)
    .where(sql`"isPremium" = true AND 
              (("contactInfo"->'social' IS NOT NULL AND jsonb_array_length("contactInfo"->'social') > 0) OR 
               ("contactInfo"->'socialProfiles' IS NOT NULL AND jsonb_array_length("contactInfo"->'socialProfiles') > 0))`);
    
    // Calculate percentages
    const calculatePercentage = (value: number, total: number) => 
      total > 0 ? ((value / total) * 100).toFixed(2) + '%' : '0%';
    
    // Print statistics
    console.log('\n=== Contact Information Statistics ===\n');
    console.log(`Total opportunities: ${totalCount.count}`);
    console.log(`Premium opportunities: ${premiumCount.count} (${calculatePercentage(Number(premiumCount.count), Number(totalCount.count))} of total)`);
    
    console.log('\n--- Overall Contact Info ---');
    console.log(`Opportunities with any contact info: ${withContactInfoCount.count} (${calculatePercentage(Number(withContactInfoCount.count), Number(totalCount.count))})`);
    console.log(`Premium opportunities with any contact info: ${premiumWithContactInfoCount.count} (${calculatePercentage(Number(premiumWithContactInfoCount.count), Number(premiumCount.count))})`);
    
    console.log('\n--- Email Availability ---');
    console.log(`Opportunities with email addresses: ${withEmailCount.count} (${calculatePercentage(Number(withEmailCount.count), Number(totalCount.count))})`);
    console.log(`Premium opportunities with email addresses: ${premiumWithEmailCount.count} (${calculatePercentage(Number(premiumWithEmailCount.count), Number(premiumCount.count))})`);
    
    console.log('\n--- Contact Form Availability ---');
    console.log(`Opportunities with contact forms: ${withFormCount.count} (${calculatePercentage(Number(withFormCount.count), Number(totalCount.count))})`);
    console.log(`Premium opportunities with contact forms: ${premiumWithFormCount.count} (${calculatePercentage(Number(premiumWithFormCount.count), Number(premiumCount.count))})`);
    
    console.log('\n--- Social Profiles Availability ---');
    console.log(`Opportunities with social profiles: ${withSocialCount.count} (${calculatePercentage(Number(withSocialCount.count), Number(totalCount.count))})`);
    console.log(`Premium opportunities with social profiles: ${premiumWithSocialCount.count} (${calculatePercentage(Number(premiumWithSocialCount.count), Number(premiumCount.count))})`);
    
    // Sample opportunities with complete contact info (email, form, and social)
    const completeSamples = await db.select({
      id: discoveredOpportunities.id,
      domain: discoveredOpportunities.domain,
      url: discoveredOpportunities.url,
      contactInfo: discoveredOpportunities.contactInfo,
      isPremium: discoveredOpportunities.isPremium
    })
    .from(discoveredOpportunities)
    .where(sql`
      (("contactInfo"->>'email' IS NOT NULL AND "contactInfo"->>'email' != 'null') OR 
       ("contactInfo"->'emails' IS NOT NULL AND jsonb_array_length("contactInfo"->'emails') > 0))
      AND
      (("contactInfo"->>'form' IS NOT NULL AND "contactInfo"->>'form' != 'null') OR
       ("contactInfo"->>'contactForm' IS NOT NULL AND "contactInfo"->>'contactForm' != 'null'))
      AND
      (("contactInfo"->'social' IS NOT NULL AND jsonb_array_length("contactInfo"->'social') > 0) OR 
       ("contactInfo"->'socialProfiles' IS NOT NULL AND jsonb_array_length("contactInfo"->'socialProfiles') > 0))
    `)
    .limit(5);
    
    console.log('\n=== Sample Opportunities with Complete Contact Info ===\n');
    
    if (completeSamples.length > 0) {
      completeSamples.forEach(sample => {
        const contactInfo = typeof sample.contactInfo === 'string' 
          ? JSON.parse(sample.contactInfo) 
          : sample.contactInfo;
        
        console.log(`Domain: ${sample.domain} (Premium: ${sample.isPremium ? 'Yes' : 'No'})`);
        console.log(`URL: ${sample.url}`);
        
        // Display emails
        const emails = [];
        if (contactInfo.email) emails.push(contactInfo.email);
        if (contactInfo.emails && Array.isArray(contactInfo.emails)) {
          emails.push(...contactInfo.emails);
        }
        console.log(`Email(s): ${emails.length > 0 ? emails.join(', ') : 'None'}`);
        
        // Display form
        const form = contactInfo.contactForm || contactInfo.form || 'None';
        console.log(`Contact Form: ${form}`);
        
        // Display social profiles
        const socialProfiles = contactInfo.socialProfiles || contactInfo.social || [];
        console.log(`Social Profiles: ${socialProfiles.length} profiles`);
        if (socialProfiles.length > 0) {
          socialProfiles.forEach((profile: any) => {
            console.log(`  - ${profile.platform}: ${profile.url}`);
          });
        }
        
        console.log('---');
      });
    } else {
      console.log('No opportunities with complete contact information found.');
    }
    
  } catch (error) {
    console.error('Error checking contact information:', error);
  }
}

// Run the check function
checkContactInfo()
  .then(() => {
    console.log('Contact information check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });