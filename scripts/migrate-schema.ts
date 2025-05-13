import { db } from '../server/db';
import { sql } from 'drizzle-orm';

// This script runs direct SQL commands to update schemas
// Useful for testing without requiring user input

async function migrateSchema() {
  console.log('Starting schema migration...');
  
  try {
    // Create or update the discovery_status enum
    console.log('Creating/updating discovery_status enum...');
    try {
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discovery_status') THEN
            CREATE TYPE discovery_status AS ENUM (
              'discovered',
              'analyzed',
              'validated',
              'rejected',
              'matched',
              'assigned',
              'premium',
              'unlocked',
              'contacted',
              'converted',
              'failed',
              'expired'
            );
          END IF;
        END
        $$;
      `);
      console.log('discovery_status enum created or already exists');
    } catch (error) {
      console.error('Error creating discovery_status enum:', error);
    }
    
    // Create or update the source_type enum
    console.log('Creating/updating source_type enum...');
    try {
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
            CREATE TYPE source_type AS ENUM (
              'resource_page',
              'directory',
              'blog',
              'guest_post',
              'competitor_backlink',
              'social_mention',
              'forum',
              'comment_section'
            );
          END IF;
        END
        $$;
      `);
      console.log('source_type enum created or already exists');
    } catch (error) {
      console.error('Error creating source_type enum:', error);
    }

    // Check if discoveredOpportunities table exists
    console.log('Checking for discoveredOpportunities table...');
    try {
      await db.execute(sql`SELECT 1 FROM "discoveredOpportunities" LIMIT 1`);
      console.log('discoveredOpportunities table exists');
    } catch (error) {
      console.log('Creating discoveredOpportunities table...');
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "discoveredOpportunities" (
          "id" SERIAL PRIMARY KEY,
          "url" TEXT NOT NULL UNIQUE,
          "domain" TEXT NOT NULL,
          "sourceType" source_type NOT NULL,
          "pageTitle" TEXT,
          "pageContent" TEXT,
          "contactInfo" JSONB,
          "domainAuthority" INTEGER DEFAULT 0,
          "pageAuthority" INTEGER DEFAULT 0,
          "spamScore" INTEGER DEFAULT 0,
          "isPremium" BOOLEAN DEFAULT false,
          "discoveredAt" TIMESTAMP DEFAULT NOW(),
          "lastChecked" TIMESTAMP DEFAULT NOW(),
          "status" discovery_status DEFAULT 'discovered',
          "rawData" JSONB,
          "validationData" JSONB
        )
      `);
    }

    // Make sure discoveredOpportunities has the right columns
    console.log('Updating discoveredOpportunities table...');
    await db.execute(sql`
      ALTER TABLE IF EXISTS "discoveredOpportunities" 
      ADD COLUMN IF NOT EXISTS "domainAuthority" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "pageAuthority" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "spamScore" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "validationData" JSONB
    `);
    
    // Update opportunityMatches table to add opportunityId and userId fields
    console.log('Updating opportunityMatches table...');
    await db.execute(sql`
      ALTER TABLE IF EXISTS "opportunityMatches" 
      ADD COLUMN IF NOT EXISTS "userId" INTEGER REFERENCES "users"("id"),
      ADD COLUMN IF NOT EXISTS "opportunityId" INTEGER REFERENCES "discoveredOpportunities"("id"),
      ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN DEFAULT false
    `);
    
    // Update dailyDrips table
    console.log('Updating dailyDrips table...');
    await db.execute(sql`
      ALTER TABLE IF EXISTS "dailyDrips" 
      ADD COLUMN IF NOT EXISTS "opportunityId" INTEGER REFERENCES "discoveredOpportunities"("id"),
      ADD COLUMN IF NOT EXISTS "dripDate" TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active'
    `);
    
    console.log('Schema migration completed successfully!');
  } catch (error) {
    console.error('Error during schema migration:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

migrateSchema();