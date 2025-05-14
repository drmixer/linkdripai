/**
 * Update Email Outreach Functionality
 * 
 * This script updates the email outreach functionality to handle cases
 * where emails might not be available, providing alternative contact options.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";

interface ContactInfo {
  emails: string[];
  socialProfiles: Array<{
    platform: string;
    url: string;
    username: string;
  }>;
  contactForms: string[];
  extractionDetails: {
    normalized: boolean;
    source: string;
    version: string;
    lastUpdated: string;
  };
}

/**
 * Set the status note for opportunities without email
 */
async function updateOpportunitiesWithoutEmail() {
  console.log("Starting update to email outreach functionality...");
  
  try {
    // Get all opportunities with contact info but no emails
    const opportunitiesWithoutEmail = await db.execute(sql`
      SELECT * FROM "discoveredOpportunities" 
      WHERE "contactInfo" IS NOT NULL 
      AND ("contactInfo"::jsonb->'emails' IS NULL 
           OR jsonb_array_length("contactInfo"::jsonb->'emails') = 0)
    `);
    
    console.log(`Found ${opportunitiesWithoutEmail.length} opportunities with contact info but no emails`);
    
    let withSocialOnly = 0;
    let withFormsOnly = 0;
    let withBoth = 0;
    
    // Process each opportunity to update status note
    for (const opportunity of opportunitiesWithoutEmail) {
      try {
        let contactInfo: ContactInfo;
        
        // Parse the contact info
        if (typeof opportunity.contactInfo === 'string') {
          if (opportunity.contactInfo.startsWith('"') && opportunity.contactInfo.endsWith('"')) {
            const unquoted = opportunity.contactInfo.slice(1, -1);
            const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            contactInfo = JSON.parse(unescaped);
          } else {
            contactInfo = JSON.parse(opportunity.contactInfo);
          }
        } else {
          contactInfo = opportunity.contactInfo as ContactInfo;
        }
        
        // Check what contact methods are available
        const hasSocial = contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0;
        const hasForms = contactInfo.contactForms && contactInfo.contactForms.length > 0;
        
        let statusNote = "";
        
        if (hasSocial && hasForms) {
          // Both social profiles and contact forms are available
          withBoth++;
          
          // Create status note with alternative contact methods
          const socialLinks = contactInfo.socialProfiles.map(p => `${p.platform}: ${p.url}`).join(", ");
          const formLinks = contactInfo.contactForms.slice(0, 1).join(", "); // Just use the first form
          
          statusNote = `No email available. Alternative contact methods: Via contact form (${formLinks}) or social media (${socialLinks})`;
        } else if (hasSocial) {
          // Only social profiles available
          withSocialOnly++;
          
          // Create status note with social profiles
          const socialLinks = contactInfo.socialProfiles.map(p => `${p.platform}: ${p.url}`).join(", ");
          statusNote = `No email available. Contact via social media: ${socialLinks}`;
        } else if (hasForms) {
          // Only contact forms available
          withFormsOnly++;
          
          // Create status note with contact form
          const formLinks = contactInfo.contactForms.slice(0, 2).join(", ");
          statusNote = `No email available. Use contact form: ${formLinks}`;
        }
        
        // Update the status note
        if (statusNote) {
          await db.update(discoveredOpportunities)
            .set({ statusNote })
            .where(sql`id = ${opportunity.id}`);
        }
      } catch (error) {
        console.error(`Error processing opportunity ${opportunity.id}:`, error);
      }
    }
    
    console.log("\nUpdate Summary:");
    console.log(`- Opportunities with social profiles only: ${withSocialOnly}`);
    console.log(`- Opportunities with contact forms only: ${withFormsOnly}`);
    console.log(`- Opportunities with both: ${withBoth}`);
    console.log(`- Total updated: ${withSocialOnly + withFormsOnly + withBoth}`);
    
  } catch (error) {
    console.error("Error in updating email outreach functionality:", error);
  }
  
  console.log("\nUpdate completed!");
}

// Run the function
updateOpportunitiesWithoutEmail().catch(console.error);