/**
 * Quick Contact Coverage Check
 * 
 * This script checks the current contact information coverage rate
 * for both regular and premium opportunities.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq, not, isNull, sql } from "drizzle-orm";

async function checkContactCoverage() {
  console.log("🔍 Checking current contact information coverage...");

  try {
    // Count total opportunities
    const [totalResult] = await db.execute(sql`SELECT COUNT(*) as total FROM "discoveredOpportunities"`);
    const totalCount = Number(totalResult?.total || 0);
    
    // Count opportunities with contact info (non-null contactInfo)
    const [contactResult] = await db.execute(sql`SELECT COUNT(*) as contact_count FROM "discoveredOpportunities" WHERE "contactInfo" IS NOT NULL`);
    const contactCount = Number(contactResult?.contact_count || 0);
    
    // Count premium opportunities
    const [premiumResult] = await db.execute(sql`SELECT COUNT(*) as premium_count FROM "discoveredOpportunities" WHERE "isPremium" = true`);
    const premiumCount = Number(premiumResult?.premium_count || 0);
    
    // Count premium opportunities with contact info
    const [premiumContactResult] = await db.execute(sql`SELECT COUNT(*) as premium_contact_count FROM "discoveredOpportunities" WHERE "isPremium" = true AND "contactInfo" IS NOT NULL`);
    const premiumContactCount = Number(premiumContactResult?.premium_contact_count || 0);
    
    // Calculate coverage percentages
    const overallCoverage = totalCount > 0 ? (contactCount / totalCount) * 100 : 0;
    const premiumCoverage = premiumCount > 0 ? (premiumContactCount / premiumCount) * 100 : 0;
    
    console.log("📊 Contact Coverage Report");
    console.log("=======================");
    console.log(`Total opportunities: ${totalCount}`);
    console.log(`Opportunities with contact info: ${contactCount} (${overallCoverage.toFixed(2)}%)`);
    console.log(`\nPremium opportunities: ${premiumCount}`);
    console.log(`Premium with contact info: ${premiumContactCount} (${premiumCoverage.toFixed(2)}%)`);
    console.log("\n📈 Target coverage rates:");
    console.log(`  Overall: 65-80% (Current: ${overallCoverage.toFixed(2)}%)`);
    console.log(`  Premium: 90-95% (Current: ${premiumCoverage.toFixed(2)}%)`);
    
    // Check progress toward targets
    if (overallCoverage < 65) {
      console.log("\n⚠️ Overall coverage below target range. Continue running contact extraction.");
    } else if (overallCoverage >= 65 && overallCoverage <= 80) {
      console.log("\n✅ Overall coverage within target range!");
    } else {
      console.log("\n🎉 Overall coverage exceeds target range!");
    }
    
    if (premiumCoverage < 90) {
      console.log("⚠️ Premium coverage below target range. Prioritize premium opportunities.");
    } else if (premiumCoverage >= 90 && premiumCoverage <= 95) {
      console.log("✅ Premium coverage within target range!");
    } else {
      console.log("🎉 Premium coverage exceeds target range!");
    }
    
  } catch (error) {
    console.error("Error checking contact coverage:", error);
  }
}

// Run the check
checkContactCoverage().catch(console.error);