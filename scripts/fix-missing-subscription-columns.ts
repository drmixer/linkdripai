/**
 * This script adds the missing subscription columns to the users table
 * to fix the login issue
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { users } from '../shared/schema';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

async function fixMissingSubscriptionColumns() {
  console.log('Checking for missing subscription columns...');
  
  try {
    // Check if subscriptionId column exists
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscriptionId'
    `);
    
    // If column doesn't exist, add it
    if (!checkColumn.rows.length) {
      console.log('Adding missing subscription columns to users table...');
      
      // Add subscriptionId column
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT`);
      console.log('Added subscriptionId column');
      
      // Add stripeCustomerId column if missing
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT`);
      console.log('Added stripeCustomerId column');
      
      // Add subscription status column if missing
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT`);
      console.log('Added subscriptionStatus column');
      
      // Add subscription expiry date if missing
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP WITH TIME ZONE`);
      console.log('Added subscriptionExpiresAt column');
      
      console.log('Successfully added all missing subscription columns');
    } else {
      console.log('Subscription columns already exist, no changes needed');
    }
  } catch (error) {
    console.error('Error fixing subscription columns:', error);
    throw error;
  }
}

// Run the script
fixMissingSubscriptionColumns()
  .then(() => {
    console.log('Completed subscription column fix script');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to fix subscription columns:', error);
    process.exit(1);
  });