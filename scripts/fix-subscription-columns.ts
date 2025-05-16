/**
 * Direct SQL migration to add subscription-related columns to users table
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addSubscriptionColumns() {
  console.log('Checking subscription columns...');
  
  try {
    // Check if the columns exist with a different name or add missing columns
    // Check subscriptionRenewsAt
    const checkRenewsAt = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscriptionRenewsAt'
    `);
    
    if (checkRenewsAt.rows.length === 0) {
      console.log('Adding subscriptionRenewsAt column to users table');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS "subscriptionRenewsAt" TIMESTAMP
      `);
    }
    
    // Check subscriptionEndsAt
    const checkEndsAt = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscriptionEndsAt'
    `);
    
    if (checkEndsAt.rows.length === 0) {
      console.log('Adding subscriptionEndsAt column to users table');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMP
      `);
    }
    
    // Check subscriptionId
    const checkSubId = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscriptionId'
    `);
    
    if (checkSubId.rows.length === 0) {
      console.log('Adding subscriptionId column to users table');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT
      `);
    }
    
    // Check subscriptionStatus
    const checkStatus = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'subscriptionStatus'
    `);
    
    if (checkStatus.rows.length === 0) {
      console.log('Adding subscriptionStatus column to users table');
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT DEFAULT 'none'
      `);
    }
    
    console.log('Subscription columns check complete');
  } catch (error) {
    console.error('Error checking subscription columns:', error);
    throw error;
  }
}

// Run the migration
addSubscriptionColumns()
  .then(() => {
    console.log('Subscription columns migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Subscription columns migration failed:', error);
    process.exit(1);
  });