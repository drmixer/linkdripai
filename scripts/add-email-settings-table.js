/**
 * Script to add the emailSettings table to the database
 */
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

/**
 * Add the emailSettings table to track per-website email configuration
 */
async function addEmailSettingsTable() {
  console.log("Creating emailSettings table...");
  
  try {
    // Check if table already exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'emailSettings'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log("emailSettings table already exists, skipping creation.");
      return;
    }

    // Create the email settings table
    await db.execute(sql`
      CREATE TABLE "emailSettings" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        "websiteId" INTEGER NOT NULL,
        "fromEmail" TEXT NOT NULL,
        "replyToEmail" TEXT,
        "defaultTemplateId" INTEGER,
        "signatureName" TEXT,
        "signatureTitle" TEXT,
        "signatureCompany" TEXT,
        "active" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("Successfully created emailSettings table!");
  } catch (error) {
    console.error("Error creating emailSettings table:", error);
    throw error;
  }
}

// Run the migration
addEmailSettingsTable()
  .then(() => {
    console.log("Migration completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });