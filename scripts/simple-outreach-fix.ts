/**
 * Simple Email Outreach Fix
 * 
 * This script updates status notes for opportunities without email
 * to provide guidance on alternative contact methods
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq } from "drizzle-orm";

async function updateStatusNotes() {
  console.log("Starting simple outreach fix...");
  
  try {
    // Get all opportunities
    const allOpportunities = await db.select().from(discoveredOpportunities);
    console.log(`Found ${allOpportunities.length} total opportunities`);
    
    let updatedCount = 0;
    
    // Process each opportunity
    for (const opp of allOpportunities) {
      if (!opp.contactInfo) continue;
      
      try {
        // Parse contact info
        let contactInfo: any;
        if (typeof opp.contactInfo === 'string') {
          contactInfo = JSON.parse(opp.contactInfo);
        } else {
          contactInfo = opp.contactInfo;
        }
        
        // Skip if has emails
        if (contactInfo.emails && contactInfo.emails.length > 0) continue;
        
        // Check available contact methods
        const hasSocial = contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0;
        const hasForms = contactInfo.contactForms && contactInfo.contactForms.length > 0;
        
        let statusNote = "";
        
        // Create appropriate status note
        if (hasSocial && hasForms) {
          const socialPlatforms = contactInfo.socialProfiles.map(p => p.platform).join(", ");
          statusNote = `No email found. Alternative contact options: contact form and ${socialPlatforms}`;
        } else if (hasSocial) {
          const socialPlatforms = contactInfo.socialProfiles.map(p => p.platform).join(", ");
          statusNote = `No email found. Can contact via ${socialPlatforms}`;
        } else if (hasForms) {
          statusNote = `No email found. Use contact form to reach out`;
        }
        
        // Update status note if we created one
        if (statusNote) {
          await db.update(discoveredOpportunities)
            .set({ statusNote })
            .where(eq(discoveredOpportunities.id, opp.id));
          
          updatedCount++;
          console.log(`Updated status note for opportunity ${opp.id}`);
        }
      } catch (error) {
        console.error(`Error processing opportunity ${opp.id}:`, error);
      }
    }
    
    console.log(`\nSuccessfully updated ${updatedCount} opportunities with alternative contact info guidance`);
    
  } catch (error) {
    console.error("Error updating status notes:", error);
  }
}

// Run the function
updateStatusNotes().then(() => {
  console.log("Simple outreach fix completed!");
}).catch(console.error);