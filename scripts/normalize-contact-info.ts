/**
 * This script normalizes the contact information structure in the database
 * to ensure consistent field names and formats
 */
import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";

async function normalizeContactInfo() {
  try {
    console.log("Normalizing contact information structure...");

    // Get all opportunities with any contact info
    const opportunities = await db.select({
      id: discoveredOpportunities.id,
      domain: discoveredOpportunities.domain,
      contactInfo: discoveredOpportunities.contactInfo
    })
    .from(discoveredOpportunities)
    .where(sql`"contactInfo" IS NOT NULL`);

    console.log(`Found ${opportunities.length} opportunities with contact information to normalize`);
    
    let normalizedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const opportunity of opportunities) {
      try {
        // Parse the contact info
        const contactInfo = typeof opportunity.contactInfo === 'string'
          ? JSON.parse(opportunity.contactInfo)
          : opportunity.contactInfo;
        
        // Skip if contactInfo is null or empty object
        if (!contactInfo || Object.keys(contactInfo).length === 0) {
          console.log(`Skipping opportunity ${opportunity.id} (${opportunity.domain}) - empty contact info`);
          continue;
        }

        // Create the normalized structure
        const normalizedInfo: any = {};
        
        // Handle email(s)
        if (contactInfo.email && typeof contactInfo.email === 'string') {
          // Only include if it looks like an email
          if (contactInfo.email.includes('@') && !contactInfo.email.includes('.jpg') && !contactInfo.email.includes('.png')) {
            normalizedInfo.email = contactInfo.email;
          }
        }
        
        // Handle additional emails array
        normalizedInfo.emails = [];
        
        // Add from additionalEmails if it exists
        if (contactInfo.additionalEmails && Array.isArray(contactInfo.additionalEmails)) {
          for (const email of contactInfo.additionalEmails) {
            if (typeof email === 'string' && email.includes('@') && !email.includes('.jpg') && !email.includes('.png')) {
              normalizedInfo.emails.push(email);
            }
          }
        }
        
        // Add from emails if it exists
        if (contactInfo.emails && Array.isArray(contactInfo.emails)) {
          for (const email of contactInfo.emails) {
            if (typeof email === 'string' && email.includes('@') && !email.includes('.jpg') && !email.includes('.png')) {
              // Avoid duplicates
              if (!normalizedInfo.emails.includes(email)) {
                normalizedInfo.emails.push(email);
              }
            }
          }
        }
        
        // Handle contact form
        if (contactInfo.contactForm && typeof contactInfo.contactForm === 'string') {
          normalizedInfo.form = contactInfo.contactForm;
        } else if (contactInfo.form && typeof contactInfo.form === 'string') {
          normalizedInfo.form = contactInfo.form;
        }
        
        // Handle social profiles
        normalizedInfo.social = [];
        
        // Add from social if it exists
        if (contactInfo.social && Array.isArray(contactInfo.social)) {
          normalizedInfo.social = [...contactInfo.social];
        }
        
        // Add from socialProfiles if it exists
        if (contactInfo.socialProfiles && Array.isArray(contactInfo.socialProfiles)) {
          for (const profile of contactInfo.socialProfiles) {
            // Check if we already have this platform and URL
            const exists = normalizedInfo.social.some((p: any) => 
              p.platform === profile.platform && p.url === profile.url
            );
            
            if (!exists) {
              normalizedInfo.social.push(profile);
            }
          }
        }
        
        // Only update if there are actual changes
        const originalJson = JSON.stringify(contactInfo);
        const normalizedJson = JSON.stringify(normalizedInfo);
        
        if (originalJson !== normalizedJson) {
          // Update the database
          await db.update(discoveredOpportunities)
            .set({ contactInfo: normalizedInfo })
            .where(sql`id = ${opportunity.id}`);
          
          normalizedCount++;
          
          if (normalizedCount % 50 === 0) {
            console.log(`Normalized ${normalizedCount} opportunities so far...`);
          }
        } else {
          unchangedCount++;
        }
      } catch (error) {
        console.error(`Error normalizing contact info for opportunity ${opportunity.id}:`, error);
        errorCount++;
      }
    }
    
    console.log("\nNormalization complete!");
    console.log(`Normalized: ${normalizedCount} opportunities`);
    console.log(`Unchanged: ${unchangedCount} opportunities`);
    console.log(`Errors: ${errorCount} opportunities`);
    
  } catch (error) {
    console.error("Error in normalizeContactInfo:", error);
  }
}

// Run the normalization
normalizeContactInfo();