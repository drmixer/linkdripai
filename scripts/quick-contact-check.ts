/**
 * Quick Contact Info Check
 * 
 * This script performs a quick check of the contact information coverage
 * without the more complex analysis that might cause timeouts.
 */

import { db } from "../server/db";
import { count, and, isNotNull, ne, sql } from "drizzle-orm";
import { discoveredOpportunities } from "../shared/schema";

async function quickCheckContactInfo() {
  console.log("Running quick contact information coverage check...");
  
  try {
    // Count total opportunities
    const [totalResult] = await db.select({ 
      value: count() 
    }).from(discoveredOpportunities);
    
    const totalOpportunities = totalResult.value;
    
    // Count opportunities with contact info
    const [withContactResult] = await db.select({
      value: count()
    }).from(discoveredOpportunities)
    .where(
      and(
        isNotNull(discoveredOpportunities.contactInfo),
        ne(discoveredOpportunities.contactInfo, '{}'),
        ne(discoveredOpportunities.contactInfo, '[]')
      )
    );
    
    const withContactInfo = withContactResult.value;
    
    // Count premium opportunities
    const [premiumResult] = await db.select({
      value: count()
    }).from(discoveredOpportunities)
    .where(discoveredOpportunities.isPremium);
    
    const premiumOpportunities = premiumResult.value;
    
    // Count premium opportunities with contact info
    const [premiumWithContactResult] = await db.select({
      value: count()
    }).from(discoveredOpportunities)
    .where(
      and(
        discoveredOpportunities.isPremium,
        isNotNull(discoveredOpportunities.contactInfo),
        ne(discoveredOpportunities.contactInfo, '{}'),
        ne(discoveredOpportunities.contactInfo, '[]')
      )
    );
    
    const premiumWithContactInfo = premiumWithContactResult.value;
    
    // Display results
    console.log(`\nContact Information Coverage`);
    console.log(`===========================`);
    console.log(`Total opportunities: ${totalOpportunities}`);
    console.log(`Opportunities with contact info: ${withContactInfo} (${(withContactInfo / totalOpportunities * 100).toFixed(2)}%)`);
    console.log(`\nPremium opportunities: ${premiumOpportunities}`);
    console.log(`Premium with contact info: ${premiumWithContactInfo} (${(premiumWithContactInfo / premiumOpportunities * 100).toFixed(2)}%)`);
    
    console.log(`\nCheck completed!`);
  } catch (error) {
    console.error("Error checking contact information coverage:", error);
  }
}

// Run the check
quickCheckContactInfo().catch(console.error);