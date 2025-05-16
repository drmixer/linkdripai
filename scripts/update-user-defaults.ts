/**
 * This script updates all users with default values for new columns
 * to ensure compatibility with updated login system
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function updateUserDefaults() {
  console.log('Updating users with default values for new columns...');
  
  try {
    // Update all users with default values for subscription-related columns
    const result = await db.execute(sql`
      UPDATE users SET 
        "planVariantId" = COALESCE("planVariantId", ''),
        "subscriptionId" = COALESCE("subscriptionId", ''),
        "subscriptionStatus" = COALESCE("subscriptionStatus", 'none'),
        "customerId" = COALESCE("customerId", ''),
        "splashCredits" = COALESCE("splashCredits", 0)
      WHERE "planVariantId" IS NULL 
         OR "subscriptionId" IS NULL 
         OR "subscriptionStatus" IS NULL
         OR "customerId" IS NULL
         OR "splashCredits" IS NULL
    `);
    
    console.log('Successfully updated user defaults');
    
    // Get count of updated rows
    const updatedCount = await db.execute(sql`SELECT count(*) FROM users`);
    console.log(`Updated ${updatedCount.rows[0].count} users with default values`);
    
  } catch (error) {
    console.error('Error updating user defaults:', error);
    throw error;
  }
}

// Run the script
updateUserDefaults()
  .then(() => {
    console.log('Completed user defaults update script');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to update user defaults:', error);
    process.exit(1);
  });