/**
 * This script adds the contactActivities table and related enums to the database
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

// Configure NeonDB to use the ws package
neonConfig.webSocketConstructor = ws;

// Setup the connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Add the contactActivities table to track all outreach efforts
 */
async function addContactActivitiesTable() {
  console.log("📊 Starting creation of contact activities tracking table and enums...");
  
  try {
    // Create contact method enum if it doesn't exist
    const createContactMethodEnum = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_method') THEN
          CREATE TYPE contact_method AS ENUM (
            'email', 
            'social_message', 
            'contact_form', 
            'phone_call', 
            'in_person', 
            'other'
          );
        END IF;
      END$$;
    `;
    
    await pool.query(createContactMethodEnum);
    console.log("✅ Created contact_method enum");
    
    // Create contact status enum if it doesn't exist
    const createContactStatusEnum = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_status') THEN
          CREATE TYPE contact_status AS ENUM (
            'planned',
            'in_progress',
            'sent',
            'delivered',
            'opened',
            'clicked',
            'replied',
            'converted',
            'rejected',
            'bounced',
            'no_response',
            'postponed',
            'cancelled'
          );
        END IF;
      END$$;
    `;
    
    await pool.query(createContactStatusEnum);
    console.log("✅ Created contact_status enum");
    
    // Check if the table already exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contactactivities'
      );
    `);
    
    // Only create if the table doesn't exist
    if (!tableExists.rows[0].exists) {
      const createContactActivitiesTable = `
        CREATE TABLE "contactActivities" (
          "id" SERIAL PRIMARY KEY,
          
          -- Relations
          "userId" INTEGER NOT NULL REFERENCES "users" ("id"),
          "websiteId" INTEGER REFERENCES "websites" ("id"),
          "opportunityId" INTEGER NOT NULL REFERENCES "discoveredOpportunities" ("id"),
          "emailId" INTEGER REFERENCES "outreachEmails" ("id"),
          
          -- Contact method tracking
          "contactMethod" contact_method NOT NULL,
          "contactPlatform" TEXT,
          "contactDetails" TEXT,
          
          -- Content
          "subject" TEXT,
          "message" TEXT,
          "attachments" JSONB,
          
          -- Status tracking
          "status" contact_status DEFAULT 'planned',
          "statusNote" TEXT,
          "isFollowUp" BOOLEAN DEFAULT FALSE,
          "parentActivityId" INTEGER,
          
          -- Timing
          "plannedAt" TIMESTAMP,
          "executedAt" TIMESTAMP,
          "respondedAt" TIMESTAMP,
          "lastStatusChange" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          -- Tracking
          "trackingId" TEXT,
          "responseContent" TEXT,
          "responseMetadata" JSONB,
          
          -- Reminders & follow-up
          "reminderDate" TIMESTAMP,
          "followUpScheduled" TIMESTAMP,
          
          -- Timestamps
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await pool.query(createContactActivitiesTable);
      console.log("✅ Created contactActivities table");
      
      // Create indexes for faster lookups
      const createIndexes = `
        CREATE INDEX idx_contact_activities_user ON "contactActivities" ("userId");
        CREATE INDEX idx_contact_activities_website ON "contactActivities" ("websiteId");
        CREATE INDEX idx_contact_activities_opportunity ON "contactActivities" ("opportunityId");
        CREATE INDEX idx_contact_activities_email ON "contactActivities" ("emailId");
        CREATE INDEX idx_contact_activities_status ON "contactActivities" ("status");
        CREATE INDEX idx_contact_activities_method ON "contactActivities" ("contactMethod");
        CREATE INDEX idx_contact_activities_executed ON "contactActivities" ("executedAt");
      `;
      
      await pool.query(createIndexes);
      console.log("✅ Created indexes for contactActivities table");
    } else {
      console.log("⚠️ Table contactActivities already exists, skipping creation");
    }
    
    console.log("✅ Contact activities table setup complete");
  } catch (err) {
    console.error("❌ Error creating contact activities table:", err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run the migration
addContactActivitiesTable()
  .then(() => console.log("🎉 Migration completed successfully"))
  .catch(err => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });