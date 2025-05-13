/**
 * This script normalizes the contact information structure in the database
 * to ensure consistent field names and formats
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function normalizeContactInfo() {
  console.log('Starting contact information normalization process...');
  
  try {
    // Get all opportunities with contactInfo
    const opportunities = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"contactInfo" IS NOT NULL`);
    
    console.log(`Found ${opportunities.length} opportunities with contact information to normalize`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const opportunity of opportunities) {
      try {
        // Parse existing contact info
        let contactInfoObj: any = {};
        
        if (opportunity.contactInfo) {
          // Parse contact info if it's a string
          contactInfoObj = typeof opportunity.contactInfo === 'string' 
            ? JSON.parse(opportunity.contactInfo) 
            : opportunity.contactInfo;
        } else {
          // Skip if no contact info
          skippedCount++;
          continue;
        }
        
        // Skip if already in standardized format
        const hasStandardFormat = 
          (contactInfoObj.email !== undefined) && 
          (contactInfoObj.emails !== undefined && Array.isArray(contactInfoObj.emails)) &&
          (contactInfoObj.form !== undefined) &&
          (contactInfoObj.social !== undefined && Array.isArray(contactInfoObj.social)) &&
          (contactInfoObj.lastUpdated !== undefined) &&
          (contactInfoObj.extractionDetails !== undefined);
        
        if (hasStandardFormat) {
          skippedCount++;
          continue;
        }
        
        // Create standardized contact info structure
        const normalizedInfo: any = {
          email: null,      // Primary email (first in the list)
          emails: [],       // Additional emails array
          form: null,       // Contact form URL
          social: [],       // Social profiles array
          lastUpdated: new Date().toISOString(),
          extractionDetails: {
            normalized: true,
            source: 'contact-info-normalization-script',
            version: '1.0'
          }
        };
        
        // Collect existing emails from different possible fields
        const allEmails: string[] = [];
        
        // Get primary email if it exists
        if (contactInfoObj.email && 
            typeof contactInfoObj.email === 'string' && 
            contactInfoObj.email.includes('@') && 
            !contactInfoObj.email.includes('.jpg') && 
            !contactInfoObj.email.includes('.png')) {
          allEmails.push(contactInfoObj.email);
        }
        
        // Get from emails array if it exists
        if (contactInfoObj.emails && Array.isArray(contactInfoObj.emails)) {
          allEmails.push(...contactInfoObj.emails.filter((email: string) => 
            typeof email === 'string' && 
            email.includes('@') && 
            !email.includes('.jpg') && 
            !email.includes('.png')
          ));
        }
        
        // Get from additionalEmails array if it exists
        if (contactInfoObj.additionalEmails && Array.isArray(contactInfoObj.additionalEmails)) {
          allEmails.push(...contactInfoObj.additionalEmails.filter((email: string) => 
            typeof email === 'string' && 
            email.includes('@') && 
            !email.includes('.jpg') && 
            !email.includes('.png')
          ));
        }
        
        // Deduplicate emails
        const uniqueEmails = [...new Set(allEmails)];
        
        // Set primary email (first one in the list)
        if (uniqueEmails.length > 0) {
          normalizedInfo.email = uniqueEmails[0];
          
          // Set additional emails (excluding primary)
          if (uniqueEmails.length > 1) {
            normalizedInfo.emails = uniqueEmails.slice(1);
          }
        }
        
        // Get form URL from different possible fields
        normalizedInfo.form = 
          contactInfoObj.form || 
          contactInfoObj.contactForm || 
          contactInfoObj.formUrl || 
          contactInfoObj.contactFormUrl || 
          null;
        
        // Get social profiles from different possible fields
        if (contactInfoObj.social && Array.isArray(contactInfoObj.social)) {
          normalizedInfo.social = contactInfoObj.social;
        } else if (contactInfoObj.socialProfiles && Array.isArray(contactInfoObj.socialProfiles)) {
          normalizedInfo.social = contactInfoObj.socialProfiles;
        }
        
        // Copy over any existing extraction details
        if (contactInfoObj.extractionDetails) {
          normalizedInfo.extractionDetails = {
            ...contactInfoObj.extractionDetails,
            normalized: true,
            source: 'contact-info-normalization-script',
            version: '1.0'
          };
        }
        
        // Update the database
        await db.update(discoveredOpportunities)
          .set({
            contactInfo: JSON.stringify(normalizedInfo)
          })
          .where(sql`id = ${opportunity.id}`);
        
        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`Normalized ${updatedCount} contact info records so far...`);
        }
      } catch (error: any) {
        console.error(`Error normalizing contact info for opportunity #${opportunity.id}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`
Contact information normalization complete:
- Total opportunities with contact info: ${opportunities.length}
- Successfully normalized: ${updatedCount}
- Already in standard format: ${skippedCount}
- Errors: ${errorCount}
    `);
  } catch (error: any) {
    console.error(`Error running normalization script: ${error.message}`);
  }
}

// Run the script
normalizeContactInfo()
  .catch(error => {
    console.error('Error running script:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script execution completed');
  });