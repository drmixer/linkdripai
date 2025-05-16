/**
 * This script adds the emailSettings table to the database,
 * which is required for email outreach functionality
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addEmailSettingsTable() {
  console.log('Creating emailSettings table...');
  
  try {
    // Check if the table already exists
    const checkTable = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'emailSettings'
      )
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('emailSettings table already exists, no need to create');
      return;
    }
    
    // Create the emailSettings table
    await db.execute(sql`
      CREATE TABLE "emailSettings" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id),
        "provider" TEXT,
        "fromEmail" TEXT,
        "fromName" TEXT,
        "isConfigured" BOOLEAN DEFAULT false,
        "isVerified" BOOLEAN DEFAULT false,
        "termsAccepted" BOOLEAN DEFAULT false,
        "sendgridApiKey" TEXT,
        "smtpHost" TEXT,
        "smtpPort" INTEGER,
        "smtpUsername" TEXT,
        "smtpPassword" TEXT,
        "gmailClientId" TEXT,
        "gmailClientSecret" TEXT,
        "gmailRefreshToken" TEXT,
        "verificationToken" TEXT,
        "verificationExpires" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('emailSettings table created successfully');
    
    // Add fromEmail and emailConfigured fields to users table if they don't exist
    const checkFromEmailColumn = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'fromEmail'
      )
    `);
    
    if (!checkFromEmailColumn.rows[0].exists) {
      console.log('Adding fromEmail column to users table...');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "fromEmail" TEXT
      `);
    }
    
    const checkEmailConfiguredColumn = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'emailConfigured'
      )
    `);
    
    if (!checkEmailConfiguredColumn.rows[0].exists) {
      console.log('Adding emailConfigured column to users table...');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "emailConfigured" BOOLEAN DEFAULT false
      `);
    }
    
    const checkEmailVerifiedColumn = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'emailVerified'
      )
    `);
    
    if (!checkEmailVerifiedColumn.rows[0].exists) {
      console.log('Adding emailVerified column to users table...');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN "emailVerified" BOOLEAN DEFAULT false
      `);
    }
    
    console.log('Email-related columns added to users table');
  } catch (error) {
    console.error('Error creating emailSettings table:', error);
    throw error;
  }
}

// Run the script
addEmailSettingsTable()
  .then(() => {
    console.log('Email settings setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Email settings setup failed:', error);
    process.exit(1);
  });