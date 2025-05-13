import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function rebuildDiscoveryTables() {
  console.log('Starting discovery tables rebuild...');
  
  try {
    // Drop existing tables to start fresh
    console.log('Dropping existing discovery-related tables...');
    await db.execute(sql`
      DROP TABLE IF EXISTS "dailyDrips" CASCADE;
      DROP TABLE IF EXISTS "opportunityMatches" CASCADE;
      DROP TABLE IF EXISTS "discoveredOpportunities" CASCADE;
      DROP TYPE IF EXISTS discovery_status;
      DROP TYPE IF EXISTS source_type;
    `);
    
    // Create enums
    console.log('Creating enums...');
    await db.execute(sql`
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
    `);
    
    // Create tables
    console.log('Creating discoveredOpportunities table...');
    await db.execute(sql`
      CREATE TABLE "discoveredOpportunities" (
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

    console.log('Creating opportunityMatches table...');
    await db.execute(sql`
      CREATE TABLE "opportunityMatches" (
        "id" SERIAL PRIMARY KEY,
        "websiteId" INTEGER REFERENCES "websites"("id"),
        "userId" INTEGER REFERENCES "users"("id"),
        "opportunityId" INTEGER REFERENCES "discoveredOpportunities"("id"),
        "matchScore" INTEGER DEFAULT 0,
        "matchReason" JSONB,
        "assignedAt" TIMESTAMP DEFAULT NOW(),
        "showDate" TIMESTAMP,
        "status" TEXT DEFAULT 'pending',
        "userDismissed" BOOLEAN DEFAULT false,
        "userSaved" BOOLEAN DEFAULT false,
        "isPremium" BOOLEAN DEFAULT false
      )
    `);
    
    console.log('Creating dailyDrips table...');
    await db.execute(sql`
      CREATE TABLE "dailyDrips" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES "users"("id"),
        "opportunityId" INTEGER REFERENCES "discoveredOpportunities"("id"),
        "dripDate" TIMESTAMP DEFAULT NOW(),
        "status" TEXT DEFAULT 'active',
        "isPremium" BOOLEAN DEFAULT false
      )
    `);
    
    console.log('Discovery tables rebuild completed successfully!');
  } catch (error) {
    console.error('Error during tables rebuild:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

rebuildDiscoveryTables();