/**
 * This script adds the missing planVariantId column to the users table
 * to fix the login issue
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function fixMissingPlanVariantColumn() {
  console.log('Checking for missing planVariantId column...');
  
  try {
    // Check if planVariantId column exists
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'planVariantId'
    `);
    
    // If column doesn't exist, add it
    if (!checkColumn.rows.length) {
      console.log('Adding missing planVariantId column to users table...');
      
      // Add planVariantId column
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS "planVariantId" TEXT`);
      console.log('Added planVariantId column');
      
      console.log('Successfully added missing planVariantId column');
    } else {
      console.log('PlanVariantId column already exists, no changes needed');
    }
  } catch (error) {
    console.error('Error fixing planVariantId column:', error);
    throw error;
  }
}

// Run the script
fixMissingPlanVariantColumn()
  .then(() => {
    console.log('Completed planVariantId column fix script');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to fix planVariantId column:', error);
    process.exit(1);
  });