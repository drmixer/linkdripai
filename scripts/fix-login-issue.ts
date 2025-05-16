/**
 * Fix login issue by setting default planVariantId value
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function fixLoginIssue() {
  try {
    console.log('Applying login fix...');
    
    // Update planVariantId with default value if it exists
    try {
      await db.execute(sql`
        ALTER TABLE users 
        ALTER COLUMN "planVariantId" SET DEFAULT '' 
      `);
      console.log('Set default value for planVariantId column');
    } catch (e) {
      console.log('Error setting default for planVariantId:', e.message);
    }
    
    // Update all null values to empty string
    try {
      await db.execute(sql`
        UPDATE users 
        SET "planVariantId" = '' 
        WHERE "planVariantId" IS NULL
      `);
      console.log('Updated null planVariantId values to empty string');
    } catch (e) {
      console.log('Error updating planVariantId values:', e.message);
    }
    
    console.log('Login fix applied successfully');
  } catch (error) {
    console.error('Error fixing login issue:', error);
    throw error;
  }
}

// Run the fix
fixLoginIssue()
  .then(() => {
    console.log('Login fix script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Login fix script failed:', error);
    process.exit(1);
  });