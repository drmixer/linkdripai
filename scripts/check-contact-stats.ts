/**
 * This script provides a quick overview of current opportunities and contact information
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
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

async function checkContactStats() {
  try {
    // Get total count of opportunities
    const [totalCount] = await db
      .select({
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities);
      
    console.log(`Total opportunities: ${totalCount.count}`);
    
    // Get count of premium opportunities (DA 40+)
    const [premiumCount] = await db
      .select({
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities)
      .where(db.sql`${schema.discoveredOpportunities.domainAuthority}::float >= 40`);
      
    console.log(`Premium opportunities (DA 40+): ${premiumCount.count}`);
    
    // Get count of opportunities with contact info
    const [withContactCount] = await db
      .select({
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities)
      .where(db.sql`${schema.discoveredOpportunities.contactInfo} IS NOT NULL`);
      
    console.log(`Opportunities with any contact info: ${withContactCount.count}`);
    
    // Calculate percentage with contact info
    const contactPercentage = Math.round((Number(withContactCount.count) / Number(totalCount.count)) * 100 * 100) / 100;
    console.log(`Contact info coverage: ${contactPercentage}%`);
    
    // Get count of opportunities with email contacts
    const [withEmailCount] = await db
      .select({
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities)
      .where(db.sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'emails' IS NOT NULL AND 
                    jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'emails') > 0`);
      
    console.log(`Opportunities with email contacts: ${withEmailCount.count}`);
    
    // Calculate percentage with email contacts
    const emailPercentage = Math.round((Number(withEmailCount.count) / Number(totalCount.count)) * 100 * 100) / 100;
    console.log(`Email contact coverage: ${emailPercentage}%`);
    
    // Get count of premium opportunities with contact info
    const [premiumWithContactCount] = await db
      .select({
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities)
      .where(db.sql`${schema.discoveredOpportunities.domainAuthority}::float >= 40 AND
                   ${schema.discoveredOpportunities.contactInfo} IS NOT NULL`);
      
    // Calculate percentage of premium opportunities with contact info
    const premiumContactPercentage = Math.round((Number(premiumWithContactCount.count) / Number(premiumCount.count)) * 100 * 100) / 100;
    console.log(`Premium opportunities with contact info: ${premiumWithContactCount.count} (${premiumContactPercentage}%)`);
    
    // Get breakdown by contact type
    console.log('\nBreakdown by contact type:');
    
    // Get count with social profiles
    const [withSocialCount] = await db
      .select({
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities)
      .where(db.sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'socialProfiles' IS NOT NULL AND 
                    jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'socialProfiles') > 0`);
    
    const socialPercentage = Math.round((Number(withSocialCount.count) / Number(totalCount.count)) * 100 * 100) / 100;
    console.log(`With social profiles: ${withSocialCount.count} (${socialPercentage}%)`);
    
    // Get count with contact forms
    const [withFormsCount] = await db
      .select({
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities)
      .where(db.sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'contactForms' IS NOT NULL AND 
                    jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'contactForms') > 0`);
    
    const formsPercentage = Math.round((Number(withFormsCount.count) / Number(totalCount.count)) * 100 * 100) / 100;
    console.log(`With contact forms: ${withFormsCount.count} (${formsPercentage}%)`);
    
    // Get stats by opportunity type
    console.log('\nOpportunities by type:');
    
    const typeStats = await db
      .select({
        type: schema.discoveredOpportunities.type,
        count: db.fn.count()
      })
      .from(schema.discoveredOpportunities)
      .groupBy(schema.discoveredOpportunities.type);
    
    typeStats.forEach(stat => {
      const percentage = Math.round((Number(stat.count) / Number(totalCount.count)) * 100 * 100) / 100;
      console.log(`${stat.type}: ${stat.count} (${percentage}%)`);
    });
    
  } catch (error) {
    console.error('Error checking contact stats:', error);
  } finally {
    await pool.end();
  }
}

checkContactStats();