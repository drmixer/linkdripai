/**
 * Simple migration script to add subscription columns to users table
 */
import pg from 'pg';
const { Pool } = pg;

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('Starting migration...');

  try {
    // Add columns for subscription management
    const alterTableQueries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_variant_id TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS splash_credits INTEGER DEFAULT 0`
    ];

    for (const query of alterTableQueries) {
      console.log(`Running: ${query}`);
      await pool.query(query);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await pool.end();
  }
}

run();