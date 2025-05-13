import { db } from '../server/db';
import { sql } from 'drizzle-orm';

// This script runs direct SQL commands to update schemas
// Useful for testing without requiring user input

async function migrateSchema() {
  console.log('Starting schema migration...');
  
  try {
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
          "sourceType" TEXT NOT NULL,
          "pageTitle" TEXT,
          "pageContent" TEXT,
          "contactInfo" JSONB,
          "domainAuthority" INTEGER DEFAULT 0,
          "pageAuthority" INTEGER DEFAULT 0,
          "spamScore" INTEGER DEFAULT 0,
          "isPremium" BOOLEAN DEFAULT false,
          "discoveredAt" TIMESTAMP DEFAULT NOW(),
          "lastChecked" TIMESTAMP DEFAULT NOW(),
          "status" TEXT DEFAULT 'discovered',
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