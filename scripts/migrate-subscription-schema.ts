/**
 * This script adds subscription-related columns to the users table
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateSubscriptionSchema() {
  console.log("[Migration] Starting subscription schema migration...");

  try {
    // Check if the subscription column already exists
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'subscription'
    `);

    if (result.rows.length > 0) {
      console.log("[Migration] Users table already has subscription column, proceeding with new columns");
    } else {
      throw new Error("Users table not found or doesn't have a subscription column");
    }

    // Add any missing columns
    const columnsToAdd = [
      { name: 'subscriptionId', type: 'text', default: null },
      { name: 'subscriptionStatus', type: 'text', default: "'none'" },
      { name: 'planVariantId', type: 'text', default: null },
      { name: 'customerId', type: 'text', default: null },
      { name: 'subscriptionRenewsAt', type: 'timestamp', default: null },
      { name: 'subscriptionEndsAt', type: 'timestamp', default: null },
      { name: 'splashCredits', type: 'integer', default: '0' }
    ];

    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const columnExists = await db.execute(sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'users'
          AND column_name = ${column.name}
        `);

        if (columnExists.rows.length === 0) {
          // Add column if it doesn't exist
          console.log(`[Migration] Adding column ${column.name} to users table...`);
          
          // Build the SQL based on column type and default value
          let alterSql;
          if (column.default === null) {
            alterSql = sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column.name} ${sql.raw(column.type)}`;
          } else {
            alterSql = sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column.name} ${sql.raw(column.type)} DEFAULT ${sql.raw(column.default)}`;
          }
          
          await db.execute(alterSql);
          console.log(`[Migration] Successfully added column ${column.name}`);
        } else {
          console.log(`[Migration] Column ${column.name} already exists, skipping`);
        }
      } catch (columnError) {
        console.error(`[Migration] Error adding column ${column.name}:`, columnError);
      }
    }

    console.log("[Migration] Subscription schema migration completed successfully");
  } catch (error) {
    console.error("[Migration] Error during subscription schema migration:", error);
    throw error;
  }
}

// Execute the migration
migrateSubscriptionSchema()
  .then(() => {
    console.log("[Migration] Successfully migrated subscription schema");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Migration] Failed to migrate subscription schema:", error);
    process.exit(1);
  });