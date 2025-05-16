/**
 * Normalize Contact Information
 * 
 * This script standardizes all contact information into a consistent format:
 * {
 *   emails: string[],
 *   socialProfiles: Array<{platform: string, url: string, username: string}>,
 *   contactForms: string[],
 *   extractionDetails: {
 *     normalized: boolean,
 *     source: string,
 *     version: string,
 *     lastUpdated: string
 *   }
 * }
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, not, isNull, sql } from 'drizzle-orm';
import * as schema from '../shared/schema';
import ws from 'ws';

// Configure neon to use the WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

// Define the standardized contact info interface
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

/**
 * Normalize contact information to a standard format
 */
async function normalizeContactInfo() {
  try {
    console.log('Starting contact information normalization...');
    
    // Get opportunities with non-null contactInfo
    const opportunities = await db
      .select({
        id: schema.discoveredOpportunities.id,
        domain: schema.discoveredOpportunities.domain,
        contactInfo: schema.discoveredOpportunities.contactInfo
      })
      .from(schema.discoveredOpportunities)
      .where(not(isNull(schema.discoveredOpportunities.contactInfo)));
    
    console.log(`Found ${opportunities.length} opportunities with contact information to process`);
    
    let normalized = 0;
    let alreadyNormalized = 0;
    let failed = 0;
    
    for (const opportunity of opportunities) {
      try {
        let contactInfo;
        const rawContactInfo = opportunity.contactInfo;
        
        // Skip if already in new format
        if (typeof rawContactInfo === 'object' && 
            rawContactInfo !== null && 
            'extractionDetails' in rawContactInfo && 
            rawContactInfo.extractionDetails?.normalized === true) {
          alreadyNormalized++;
          continue;
        }
        
        // Initialize with empty values
        const normalizedInfo: NormalizedContactInfo = {
          emails: [],
          socialProfiles: [],
          contactForms: [],
          extractionDetails: {
            normalized: true,
            source: 'contact-normalizer',
            version: '1.0',
            lastUpdated: new Date().toISOString()
          }
        };
        
        // Handle case where contactInfo is a string (escaped JSON)
        if (typeof rawContactInfo === 'string') {
          try {
            contactInfo = JSON.parse(rawContactInfo);
            
            // Check if it's already in the new format
            if (contactInfo && 
                typeof contactInfo === 'object' && 
                'extractionDetails' in contactInfo && 
                contactInfo.extractionDetails?.normalized === true) {
              alreadyNormalized++;
              continue;
            }
          } catch (e) {
            console.error(`Could not parse contactInfo string for ${opportunity.domain} (ID: ${opportunity.id}):`, e);
            
            // Try to extract data using regex if JSON parsing fails
            const emailRegex = /"email":\\s*\\["([^"]+)"\\]/g;
            const formRegex = /"form":\\s*"([^"]+)"/g;
            
            // Extract emails using regex
            const emailMatches = (rawContactInfo as string).match(emailRegex);
            if (emailMatches) {
              emailMatches.forEach(match => {
                const email = match.replace(/"email":\s*\["/, '').replace(/"\]/, '');
                normalizedInfo.emails.push(email);
              });
            }
            
            // Extract contact form using regex
            const formMatches = (rawContactInfo as string).match(formRegex);
            if (formMatches) {
              formMatches.forEach(match => {
                const form = match.replace(/"form":\s*"/, '').replace(/"/, '');
                normalizedInfo.contactForms.push(form);
              });
            }
            
            contactInfo = null;
          }
        } else {
          contactInfo = rawContactInfo;
        }
        
        // Process old format (form, social, email)
        if (contactInfo && typeof contactInfo === 'object') {
          // Extract form URLs
          if ('form' in contactInfo && typeof contactInfo.form === 'string') {
            normalizedInfo.contactForms.push(contactInfo.form);
          }
          
          // Extract alternative format form URLs
          if ('forms' in contactInfo && Array.isArray(contactInfo.forms)) {
            contactInfo.forms.forEach((form: string) => {
              normalizedInfo.contactForms.push(form);
            });
          }
          
          // Process social profiles
          if ('social' in contactInfo && Array.isArray(contactInfo.social)) {
            contactInfo.social.forEach((profile: any) => {
              if (profile && typeof profile === 'object' && 'url' in profile && 'platform' in profile) {
                normalizedInfo.socialProfiles.push({
                  platform: profile.platform,
                  url: profile.url,
                  username: profile.username || profile.platform
                });
              }
            });
          }
          
          // Extract old format emails
          if ('email' in contactInfo) {
            if (typeof contactInfo.email === 'string') {
              normalizedInfo.emails.push(contactInfo.email);
            } else if (Array.isArray(contactInfo.email)) {
              contactInfo.email.forEach((email: string) => {
                if (typeof email === 'string' && email.trim() !== '') {
                  normalizedInfo.emails.push(email);
                }
              });
            }
          }
          
          // Double-escaped JSON string handling
          if (contactInfo.emails && typeof contactInfo.emails === 'string') {
            try {
              const parsedEmails = JSON.parse(contactInfo.emails);
              if (Array.isArray(parsedEmails)) {
                normalizedInfo.emails = normalizedInfo.emails.concat(parsedEmails);
              }
            } catch (e) {
              // Not valid JSON, skip
            }
          }
          
          // Already has emails array
          if (contactInfo.emails && Array.isArray(contactInfo.emails)) {
            normalizedInfo.emails = normalizedInfo.emails.concat(contactInfo.emails);
          }
          
          // Already has socialProfiles array
          if (contactInfo.socialProfiles && Array.isArray(contactInfo.socialProfiles)) {
            normalizedInfo.socialProfiles = normalizedInfo.socialProfiles.concat(contactInfo.socialProfiles);
          }
          
          // Already has contactForms array
          if (contactInfo.contactForms && Array.isArray(contactInfo.contactForms)) {
            normalizedInfo.contactForms = normalizedInfo.contactForms.concat(contactInfo.contactForms);
          }
        }
        
        // Remove duplicates
        normalizedInfo.emails = [...new Set(normalizedInfo.emails)];
        normalizedInfo.contactForms = [...new Set(normalizedInfo.contactForms)];
        
        // Remove duplicates in socialProfiles by URL
        const uniqueSocialUrls = new Set();
        normalizedInfo.socialProfiles = normalizedInfo.socialProfiles.filter(profile => {
          if (uniqueSocialUrls.has(profile.url)) {
            return false;
          }
          uniqueSocialUrls.add(profile.url);
          return true;
        });
        
        // Update the database with normalized contact info
        await db.update(schema.discoveredOpportunities)
          .set({
            contactInfo: normalizedInfo as any
          })
          .where(eq(schema.discoveredOpportunities.id, opportunity.id));
        
        normalized++;
        
        // Log progress every 50 records
        if (normalized % 50 === 0) {
          console.log(`Normalized ${normalized} records so far...`);
        }
      } catch (error) {
        console.error(`Failed to normalize contact info for ${opportunity.domain} (ID: ${opportunity.id}):`, error);
        failed++;
      }
    }
    
    console.log('\n=== Normalization Complete ===');
    console.log(`Total opportunities processed: ${opportunities.length}`);
    console.log(`Already normalized: ${alreadyNormalized}`);
    console.log(`Newly normalized: ${normalized}`);
    console.log(`Failed to normalize: ${failed}`);
    
  } catch (error) {
    console.error('Error in contact info normalization:', error);
  } finally {
    await pool.end();
  }
}

// Run the normalization
normalizeContactInfo();