/**
 * Fix the splashCredits column to match the database
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function fixSplashCreditsColumn() {
  console.log('Checking splash credits column...');
  
  try {
    // Check if the column exists with a different name (splash_credits)
    const checkAltColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'splash_credits'
    `);
    
    if (checkAltColumn.rows.length) {
      console.log('Found splash_credits column in database');
      console.log('Please update schema.ts to use splash_credits instead of splashCredits');
    } else {
      // Check if splashCredits exists
      const checkColumn = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'splashCredits'
      `);
      
      if (checkColumn.rows.length) {
        console.log('splashCredits column already exists, no need to add it');
      } else {
        // Column doesn't exist at all, add it
        console.log('Adding splash_credits column to users table...');
        await db.execute(sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS "splash_credits" INTEGER DEFAULT 0
        `);
        console.log('Added splash_credits column with default value 0');
      }
    }
    
    console.log('Splash credits column check complete');
  } catch (error) {
    console.error('Error checking splash credits column:', error);
    throw error;
  }
}

// Run the script
fixSplashCreditsColumn()
  .then(() => {
    console.log('Splash credits column fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Splash credits column fix failed:', error);
    process.exit(1);
  });