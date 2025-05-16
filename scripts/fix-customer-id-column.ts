/**
 * This script fixes issues with the customerId column
 * It aligns the schema and actual database to match and prevent login errors
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function fixCustomerIdColumn() {
  console.log('Starting customer ID column fix...');
  
  try {
    // First check if the column exists in database with the schema name
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'customerId'
    `);
    
    if (checkColumn.rows.length) {
      console.log('customerId column exists, no need to add it');
    } else {
      // Check if the column exists with a different name (customer_id)
      const checkAltColumn = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'customer_id'
      `);
      
      if (checkAltColumn.rows.length) {
        console.log('Found customer_id column, will use this instead');
        // Update the shared schema reference to use customer_id
        console.log('Please update shared/schema.ts to use customer_id instead of customerId');
      } else {
        // Column doesn't exist at all, add it
        console.log('Adding customer_id column to users table...');
        await db.execute(sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS "customer_id" TEXT DEFAULT ''
        `);
        console.log('Added customer_id column');
      }
    }
    
    console.log('Customer ID column fix completed');
  } catch (error) {
    console.error('Error fixing customer ID column:', error);
    throw error;
  }
}

// Run the script
fixCustomerIdColumn()
  .then(() => {
    console.log('Customer ID fix script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Customer ID fix script failed:', error);
    process.exit(1);
  });