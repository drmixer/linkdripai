/**
 * Contact Information Format Normalizer
 * 
 * This script normalizes the format of contact information across all opportunities
 * to ensure a consistent structure that works with our frontend and email integration.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";

async function normalizeContactInfo() {
  console.log("Starting contact information normalization process...");
  
  try {
    // Get all opportunities with contact info
    const opportunities = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"contactInfo" IS NOT NULL`);
    
    console.log(`Found ${opportunities.length} opportunities with contact information`);
    
    // Track various formats
    let standardFormat = 0;
    let oldFormat = 0;
    let unknownFormat = 0;
    
    // Process each opportunity
    for (const opportunity of opportunities) {
      const id = opportunity.id;
      let contactInfo: any;
      
      try {
        // Parse the contact info from string/json
        if (typeof opportunity.contactInfo === 'string') {
          contactInfo = JSON.parse(opportunity.contactInfo);
        } else {
          contactInfo = opportunity.contactInfo;
        }
        
        // Check the format and normalize if needed
        let needsUpdate = false;
        let normalizedInfo: any = {
          emails: [],
          socialProfiles: [],
          contactForms: [],
          extractionDetails: {
            normalized: true,
            source: "contact-normalizer",
            version: "1.0",
            lastUpdated: new Date().toISOString()
          }
        };
        
        // Case 1: New format from premium contact booster (1.1)
        if (contactInfo.emails !== undefined && 
            contactInfo.socialProfiles !== undefined && 
            contactInfo.contactForms !== undefined) {
          // Already in the right format
          normalizedInfo = contactInfo;
          
          // Just ensure extractionDetails exists
          if (!normalizedInfo.extractionDetails) {
            normalizedInfo.extractionDetails = {
              normalized: true,
              source: "contact-normalizer",
              version: "1.0",
              lastUpdated: new Date().toISOString()
            };
            needsUpdate = true;
          }
          
          standardFormat++;
        }
        // Case 2: Legacy format with email, social, form fields
        else if (contactInfo.email !== undefined || 
                contactInfo.social !== undefined || 
                contactInfo.form !== undefined) {
          // Convert old format to new format
          if (contactInfo.email) {
            if (Array.isArray(contactInfo.email)) {
              normalizedInfo.emails = contactInfo.email;
            } else {
              normalizedInfo.emails.push(contactInfo.email);
            }
          }
          
          if (contactInfo.additionalEmails && Array.isArray(contactInfo.additionalEmails)) {
            normalizedInfo.emails.push(...contactInfo.additionalEmails);
          }
          
          if (contactInfo.social && Array.isArray(contactInfo.social)) {
            normalizedInfo.socialProfiles = contactInfo.social.map((profile: any) => ({
              platform: profile.platform,
              url: profile.url,
              username: profile.username
            }));
          }
          
          if (contactInfo.form) {
            if (Array.isArray(contactInfo.form)) {
              normalizedInfo.contactForms = contactInfo.form;
            } else {
              normalizedInfo.contactForms.push(contactInfo.form);
            }
          }
          
          needsUpdate = true;
          oldFormat++;
        }
        // Case 3: Unknown format, try to extract what we can
        else {
          console.log(`Unknown format for opportunity ${id}:`, contactInfo);
          
          // Look for email-like strings
          if (typeof contactInfo === 'object') {
            Object.entries(contactInfo).forEach(([key, value]) => {
              if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
                normalizedInfo.emails.push(value);
                needsUpdate = true;
              } else if (typeof value === 'string' && value.includes('http') && value.includes('contact')) {
                normalizedInfo.contactForms.push(value);
                needsUpdate = true;
              }
            });
          }
          
          unknownFormat++;
        }
        
        // Deduplicate arrays
        normalizedInfo.emails = [...new Set(normalizedInfo.emails)];
        normalizedInfo.contactForms = [...new Set(normalizedInfo.contactForms)];
        
        // Update the database if needed
        if (needsUpdate) {
          await db.update(discoveredOpportunities)
            .set({ contactInfo: JSON.stringify(normalizedInfo) })
            .where(sql`id = ${id}`);
          
          console.log(`Updated contact info for opportunity ${id}`);
        }
      } catch (error) {
        console.error(`Error processing opportunity ${id}:`, error);
      }
    }
    
    console.log("\nNormalization Summary:");
    console.log(`- Standard format: ${standardFormat}`);
    console.log(`- Old format converted: ${oldFormat}`);
    console.log(`- Unknown format: ${unknownFormat}`);
    console.log(`- Total processed: ${opportunities.length}`);
    
  } catch (error) {
    console.error("Error in normalization process:", error);
  }
}

normalizeContactInfo().catch(console.error);