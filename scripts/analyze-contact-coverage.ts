/**
 * Contact Information Coverage Analysis
 * 
 * This script analyzes the current contact information coverage
 * and provides detailed metrics on various aspects of the data.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { count, eq, and, not, isNull, sql, gt, lt } from 'drizzle-orm';
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

async function analyzeContactCoverage() {
  try {
    console.log('=== LinkDripAI Contact Information Coverage Analysis ===\n');
    
    // Get total count of opportunities
    const [totalCount] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities);
    
    console.log(`Total Opportunities: ${totalCount.count}`);
    
    // Count opportunities with any contact information
    const [withContactInfo] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(not(isNull(schema.discoveredOpportunities.contactInfo)));
    
    console.log(`Opportunities with Any Contact Info: ${withContactInfo.count} (${((withContactInfo.count / totalCount.count) * 100).toFixed(2)}%)`);
    
    // Count opportunities with email contacts
    const [withEmailContacts] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          not(isNull(schema.discoveredOpportunities.contactInfo)),
          sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'emails' IS NOT NULL`,
          sql`jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'emails') > 0`
        )
      );
    
    console.log(`Opportunities with Email Contacts: ${withEmailContacts.count} (${((withEmailContacts.count / totalCount.count) * 100).toFixed(2)}%)`);
    
    // Count opportunities with social profiles
    const [withSocialProfiles] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          not(isNull(schema.discoveredOpportunities.contactInfo)),
          sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'socialProfiles' IS NOT NULL`,
          sql`jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'socialProfiles') > 0`
        )
      );
    
    console.log(`Opportunities with Social Profiles: ${withSocialProfiles.count} (${((withSocialProfiles.count / totalCount.count) * 100).toFixed(2)}%)`);
    
    // Count opportunities with contact forms
    const [withContactForms] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          not(isNull(schema.discoveredOpportunities.contactInfo)),
          sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'contactForms' IS NOT NULL`,
          sql`jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'contactForms') > 0`
        )
      );
    
    console.log(`Opportunities with Contact Forms: ${withContactForms.count} (${((withContactForms.count / totalCount.count) * 100).toFixed(2)}%)`);
    
    // Count premium opportunities (DA 40+)
    const [premiumCount] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(sql`${schema.discoveredOpportunities.domainAuthority}::float >= 40`);
    
    console.log(`\nPremium Opportunities (DA 40+): ${premiumCount.count} (${((premiumCount.count / totalCount.count) * 100).toFixed(2)}%)`);
    
    // Count premium opportunities with any contact information
    const [premiumWithContactInfo] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          sql`${schema.discoveredOpportunities.domainAuthority}::float >= 40`,
          not(isNull(schema.discoveredOpportunities.contactInfo))
        )
      );
    
    console.log(`Premium Opportunities with Any Contact Info: ${premiumWithContactInfo.count} (${((premiumWithContactInfo.count / premiumCount.count) * 100).toFixed(2)}%)`);
    
    // Count premium opportunities with email contacts
    const [premiumWithEmailContacts] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          sql`${schema.discoveredOpportunities.domainAuthority}::float >= 40`,
          not(isNull(schema.discoveredOpportunities.contactInfo)),
          sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'emails' IS NOT NULL`,
          sql`jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'emails') > 0`
        )
      );
    
    console.log(`Premium Opportunities with Email Contacts: ${premiumWithEmailContacts.count} (${((premiumWithEmailContacts.count / premiumCount.count) * 100).toFixed(2)}%)`);
    
    // Get DA ranges distribution
    console.log('\n=== Domain Authority Distribution ===');
    
    const daRanges = [
      { min: 0, max: 10, label: '0-10' },
      { min: 10, max: 20, label: '10-20' },
      { min: 20, max: 30, label: '20-30' },
      { min: 30, max: 40, label: '30-40' },
      { min: 40, max: 50, label: '40-50' },
      { min: 50, max: 60, label: '50-60' },
      { min: 60, max: 70, label: '60-70' },
      { min: 70, max: 80, label: '70-80' },
      { min: 80, max: 90, label: '80-90' },
      { min: 90, max: 100, label: '90-100' }
    ];
    
    for (const range of daRanges) {
      const [rangeCount] = await db
        .select({ count: count() })
        .from(schema.discoveredOpportunities)
        .where(
          and(
            sql`${schema.discoveredOpportunities.domainAuthority}::float >= ${range.min}`,
            sql`${schema.discoveredOpportunities.domainAuthority}::float < ${range.max}`
          )
        );
      
      console.log(`DA ${range.label}: ${rangeCount.count} opportunities`);
    }
    
    // Get contact info by extraction method
    console.log('\n=== Contact Info by Extraction Method ===');
    
    const extractionMethods = await db
      .select({
        source: sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'extractionDetails'->>'source'`,
        count: count()
      })
      .from(schema.discoveredOpportunities)
      .where(not(isNull(schema.discoveredOpportunities.contactInfo)))
      .groupBy(sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'extractionDetails'->>'source'`);
    
    for (const method of extractionMethods) {
      console.log(`Method: ${method.source || 'Unknown'}, Count: ${method.count}`);
    }
    
    // Get most common social profile platforms
    console.log('\n=== Most Common Social Profile Platforms ===');
    
    const topSocialPlatforms = await db.execute(sql`
      WITH social_platforms AS (
        SELECT jsonb_array_elements(${schema.discoveredOpportunities.contactInfo}::jsonb->'socialProfiles')->>'platform' as platform
        FROM "discoveredOpportunities"
        WHERE ${schema.discoveredOpportunities.contactInfo}::jsonb->'socialProfiles' IS NOT NULL
        AND jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'socialProfiles') > 0
      )
      SELECT platform, COUNT(*) as count
      FROM social_platforms
      WHERE platform IS NOT NULL
      GROUP BY platform
      ORDER BY count DESC
      LIMIT 10
    `);
    
    if (Array.isArray(topSocialPlatforms.rows)) {
      for (const platform of topSocialPlatforms.rows) {
        console.log(`Platform: ${platform.platform || 'Unknown'}, Count: ${platform.count}`);
      }
    } else {
      console.log("No social platform data available");
    }
    
    // Get most common email domains
    console.log('\n=== Most Common Email Domains ===');
    
    const topEmailDomains = await db.execute(sql`
      WITH email_domains AS (
        SELECT split_part(jsonb_array_elements_text(${schema.discoveredOpportunities.contactInfo}::jsonb->'emails'), '@', 2) as domain
        FROM ${schema.discoveredOpportunities._.name}
        WHERE ${schema.discoveredOpportunities.contactInfo}::jsonb->'emails' IS NOT NULL
        AND jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'emails') > 0
      )
      SELECT domain, COUNT(*) as count
      FROM email_domains
      WHERE domain != ''
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 10
    `);
    
    for (const domain of topEmailDomains) {
      console.log(`Domain: ${domain.domain || 'Unknown'}, Count: ${domain.count}`);
    }
    
    // Get number of normalized vs non-normalized records
    console.log('\n=== Normalization Status ===');
    
    const [normalizedCount] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          not(isNull(schema.discoveredOpportunities.contactInfo)),
          sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'extractionDetails'->>'normalized' = 'true'`
        )
      );
    
    const [nonNormalizedCount] = await db
      .select({ count: count() })
      .from(schema.discoveredOpportunities)
      .where(
        and(
          not(isNull(schema.discoveredOpportunities.contactInfo)),
          sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'extractionDetails' IS NULL OR
              ${schema.discoveredOpportunities.contactInfo}::jsonb->'extractionDetails'->>'normalized' != 'true'`
        )
      );
    
    console.log(`Normalized Records: ${normalizedCount.count}`);
    console.log(`Non-Normalized Records: ${nonNormalizedCount.count}`);

    console.log('\n=== Analysis Complete ===');
  } catch (error) {
    console.error('Error in contact coverage analysis:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeContactCoverage();