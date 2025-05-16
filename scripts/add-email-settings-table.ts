/**
 * Script to add the emailSettings table to the database
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addEmailSettingsTable() {
  console.log('Creating emailSettings table...');
  
  try {
    // Check if table already exists
    const checkTable = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'emailSettings'
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('emailSettings table already exists');
      return;
    }
    
    // Create the emailSettings table
    await db.execute(sql`
      CREATE TABLE "emailSettings" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider" TEXT NOT NULL,
        "fromEmail" TEXT NOT NULL,
        "providerSettings" JSONB NOT NULL DEFAULT '{}',
        "requiresVerification" BOOLEAN NOT NULL DEFAULT TRUE,
        "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        "termsAccepted" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create an index for faster lookups by userId
    await db.execute(sql`
      CREATE INDEX "emailSettings_userId_idx" ON "emailSettings" ("userId")
    `);
    
    console.log('Successfully created emailSettings table');
  } catch (error) {
    console.error('Error creating emailSettings table:', error);
    throw error;
  }
}

// Run the script
addEmailSettingsTable()
  .then(() => {
    console.log('Email settings table creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Email settings table creation failed:', error);
    process.exit(1);
  });