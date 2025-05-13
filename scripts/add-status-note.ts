import { db } from '../server/db';
import { sql } from 'drizzle-orm';

/**
 * This script adds the statusNote column to the discoveredOpportunities table
 */
async function addStatusNoteColumn() {
  try {
    console.log('Adding statusNote column to discoveredOpportunities table...');
    
    await db.execute(sql`
      ALTER TABLE "discoveredOpportunities" 
      ADD COLUMN IF NOT EXISTS "statusNote" TEXT
    `);
    
    console.log('Successfully added statusNote column');
  } catch (error) {
    console.error('Error adding statusNote column:', error);
  }
}

// Run the script
addStatusNoteColumn().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});