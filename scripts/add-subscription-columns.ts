/**
 * Direct SQL migration to add subscription-related columns to users table
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addSubscriptionColumns() {
  console.log("[Migration] Starting subscription columns migration...");

  try {
    // Add each column individually with direct SQL
    const alterStatements = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_variant_id TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS splash_credits INTEGER DEFAULT 0`
    ];
    
    for (const statement of alterStatements) {
      try {
        // Execute each statement separately
        console.log(`[Migration] Executing: ${statement}`);
        await db.execute(sql.raw(statement));
        console.log(`[Migration] Successfully executed statement`);
      } catch (err) {
        console.error(`[Migration] Error executing statement: ${statement}`, err);
      }
    }

    console.log("[Migration] Subscription columns migration completed");
  } catch (error) {
    console.error("[Migration] Error during migration:", error);
  }
}

// Run the migration
addSubscriptionColumns()
  .then(() => {
    console.log("[Migration] All done!");
    process.exit(0);
  })
  .catch(error => {
    console.error("[Migration] Uncaught error:", error);
    process.exit(1);
  });