/**
 * Fix Inconsistent Contact Information Format
 * 
 * This script fixes contact information records that weren't properly normalized
 * to ensure all follow the new standardized format.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";

// Standard contact info structure
interface NormalizedContactInfo {
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

async function fixInconsistentContactInfo() {
  console.log("Starting contact information format fix...");
  
  try {
    // Get all opportunities with contact info
    const opportunities = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"contactInfo" IS NOT NULL`);
    
    console.log(`Found ${opportunities.length} opportunities with contact information`);
    
    let fixedCount = 0;
    let alreadyNormalizedCount = 0;
    let errorCount = 0;
    
    for (const opportunity of opportunities) {
      const { id } = opportunity;
      let contactInfo = opportunity.contactInfo;
      
      try {
        // Try to parse the contact info
        let parsedInfo: any;
        
        try {
          parsedInfo = typeof contactInfo === 'string' ? JSON.parse(contactInfo) : contactInfo;
        } catch (e) {
          console.error(`Error parsing contact info for opportunity ${id}: ${e.message}`);
          errorCount++;
          continue;
        }
        
        // Check if it's already in the normalized format
        const hasNewFormat = parsedInfo.emails !== undefined && 
                             parsedInfo.socialProfiles !== undefined && 
                             parsedInfo.contactForms !== undefined &&
                             parsedInfo.extractionDetails !== undefined;
        
        if (hasNewFormat) {
          alreadyNormalizedCount++;
          continue;
        }
        
        // Convert from old format to new format
        const normalizedInfo: NormalizedContactInfo = {
          emails: [],
          socialProfiles: [],
          contactForms: [],
          extractionDetails: {
            normalized: true,
            source: "contact-format-fixer",
            version: "1.0",
            lastUpdated: new Date().toISOString()
          }
        };
        
        // Handle old 'form' field
        if (parsedInfo.form) {
          if (typeof parsedInfo.form === 'string') {
            normalizedInfo.contactForms.push(parsedInfo.form);
          } else if (Array.isArray(parsedInfo.form)) {
            normalizedInfo.contactForms = [...parsedInfo.form];
          }
        }
        
        // Handle old 'forms' field
        if (parsedInfo.forms && Array.isArray(parsedInfo.forms)) {
          normalizedInfo.contactForms = [...normalizedInfo.contactForms, ...parsedInfo.forms];
        }
        
        // Handle old 'social' field
        if (parsedInfo.social && Array.isArray(parsedInfo.social)) {
          normalizedInfo.socialProfiles = parsedInfo.social.map((s: any) => ({
            platform: s.platform || '',
            url: s.url || '',
            username: s.username || ''
          }));
        }
        
        // Handle old 'email' field
        if (parsedInfo.email) {
          if (typeof parsedInfo.email === 'string') {
            normalizedInfo.emails.push(parsedInfo.email);
          } else if (Array.isArray(parsedInfo.email)) {
            normalizedInfo.emails = [...parsedInfo.email];
          }
        }
        
        // Handle old 'emails' field
        if (parsedInfo.emails && Array.isArray(parsedInfo.emails)) {
          normalizedInfo.emails = [...normalizedInfo.emails, ...parsedInfo.emails];
        }
        
        // Deduplicate arrays
        normalizedInfo.emails = [...new Set(normalizedInfo.emails)];
        normalizedInfo.contactForms = [...new Set(normalizedInfo.contactForms)];
        
        // Update the database
        await db.update(discoveredOpportunities)
          .set({ contactInfo: JSON.stringify(normalizedInfo) })
          .where(sql`id = ${id}`);
        
        console.log(`Fixed contact info for opportunity ${id}`);
        fixedCount++;
      } catch (error) {
        console.error(`Error processing opportunity ${id}:`, error);
        errorCount++;
      }
    }
    
    console.log("\nFix Summary:");
    console.log(`- Already normalized: ${alreadyNormalizedCount}`);
    console.log(`- Fixed: ${fixedCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log(`- Total processed: ${opportunities.length}`);
    
  } catch (error) {
    console.error("Error in fix process:", error);
  }
  
  console.log("Fix process completed!");
}

// Run the function
fixInconsistentContactInfo().catch(console.error);