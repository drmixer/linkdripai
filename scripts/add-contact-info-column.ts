/**
 * This script adds the contactInfo column to the discoveredOpportunities table
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addContactInfoColumn() {
  try {
    console.log('Adding contactInfo column to discoveredOpportunities table...');
    
    // Check if column already exists
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'discoveredOpportunities' 
      AND column_name = 'contactInfo'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('contactInfo column already exists');
      return;
    }
    
    // Add the column with jsonb type
    await db.execute(sql`
      ALTER TABLE "discoveredOpportunities" 
      ADD COLUMN "contactInfo" JSONB
    `);
    
    console.log('Successfully added contactInfo column!');
  } catch (error) {
    console.error('Error adding contactInfo column:', error);
    throw error;
  }
}

// Run the script
addContactInfoColumn()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });