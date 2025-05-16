/**
 * This script adds a test user for development purposes
 * Run with: npx tsx scripts/fix-auth-registration.ts
 */

import { db } from "../server/db";
import { users } from "../shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createTestUser() {
  try {
    console.log("Starting test user creation...");
    
    // Check if test user already exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, "testuser")
    });
    
    if (existingUser) {
      console.log("Test user already exists. Updating password...");
      
      // Update the password for the existing user
      await db.update(users)
        .set({
          password: await hashPassword("testpassword")
        })
        .where((users, { eq }) => eq(users.username, "testuser"));
      
      console.log("Test user password updated successfully!");
      return;
    }
    
    // Create a new test user
    const hashedPassword = await hashPassword("testpassword");
    
    await db.insert(users).values({
      username: "testuser",
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      subscription: "Grow",
      dailyOpportunitiesLimit: 20,
      splashesAllowed: 3,
      onboardingCompleted: true,
      createdAt: new Date()
    });
    
    console.log("Test user created successfully!");
    console.log("Login Credentials:");
    console.log("Username: testuser");
    console.log("Password: testpassword");
  } catch (error) {
    console.error("Error creating test user:", error);
  } finally {
    process.exit(0);
  }
}

// Run the function
createTestUser();