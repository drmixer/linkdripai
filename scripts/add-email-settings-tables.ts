/**
 * Script to add the userEmailSettings and websiteEmailSettings tables to the database
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Add the email settings tables to track user-level and per-website email configurations
 */
async function addEmailSettingsTables() {
  console.log("Creating email settings tables...");
  
  try {
    // Check if userEmailSettings table already exists
    const userTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'userEmailSettings'
      );
    `);
    
    if (userTableExists.rows[0].exists) {
      console.log("userEmailSettings table already exists, skipping creation.");
    } else {
      // Create the user email settings table
      await db.execute(sql`
        CREATE TABLE "userEmailSettings" (
          "id" SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL REFERENCES "users"("id"),
          "provider" TEXT,
          "fromEmail" TEXT,
          "fromName" TEXT,
          "isConfigured" BOOLEAN DEFAULT false,
          "isVerified" BOOLEAN DEFAULT false,
          "termsAccepted" BOOLEAN DEFAULT false,
          "sendgridApiKey" TEXT,
          "smtpHost" TEXT,
          "smtpPort" INTEGER,
          "smtpUsername" TEXT,
          "smtpPassword" TEXT,
          "gmailClientId" TEXT,
          "gmailClientSecret" TEXT,
          "gmailRefreshToken" TEXT,
          "verificationToken" TEXT,
          "verificationExpires" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log("Successfully created userEmailSettings table!");
    }

    // Check if websiteEmailSettings table already exists
    const websiteTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'websiteEmailSettings'
      );
    `);
    
    if (websiteTableExists.rows[0].exists) {
      console.log("websiteEmailSettings table already exists, skipping creation.");
    } else {
      // Create the website email settings table
      await db.execute(sql`
        CREATE TABLE "websiteEmailSettings" (
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
      console.log("Successfully created websiteEmailSettings table!");
    }
  } catch (error) {
    console.error("Error creating email settings tables:", error);
    throw error;
  }
}

// Run the migration
addEmailSettingsTables()
  .then(() => {
    console.log("Migration completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });