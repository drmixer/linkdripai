/**
 * Contact Information Coverage Analysis
 * 
 * This script analyzes the current contact information coverage
 * and provides detailed metrics on various aspects of the data.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq, and, isNull, not } from "drizzle-orm";

async function analyzeContactCoverage() {
  console.log("Starting contact coverage analysis...");

  try {
    // Get all opportunities with contact info
    const opportunities = await db.select()
      .from(discoveredOpportunities)
      .where(not(isNull(discoveredOpportunities.contactInfo)));
    
    console.log(`\nAnalyzing ${opportunities.length} opportunities with contact information...`);
    
    // Track metrics
    let withEmails = 0;
    let withSocial = 0;
    let withContactForms = 0;
    let withAllThree = 0;
    let withTwo = 0;
    let withOne = 0;
    let withEmailAndSocial = 0;
    let withEmailAndForm = 0;
    let withSocialAndForm = 0;
    let totalEmailsFound = 0;
    let totalSocialProfilesFound = 0;
    let totalContactFormsFound = 0;
    
    // Social platform breakdown
    const socialPlatforms: Record<string, number> = {};
    
    // Initialize with common platforms
    ['twitter', 'facebook', 'linkedin', 'instagram', 'youtube', 'pinterest'].forEach(platform => {
      socialPlatforms[platform] = 0;
    });
    
    // Analyze each opportunity
    for (const opportunity of opportunities) {
      try {
        // The contactInfo field is already an object, so we don't need to parse it
        const contactInfo = typeof opportunity.contactInfo === 'string' 
          ? JSON.parse(opportunity.contactInfo)
          : opportunity.contactInfo;
        
        // Standardize access to avoid errors with different formats
        let emails: string[] = [];
        let socialProfiles: any[] = [];
        let contactForms: string[] = [];
        
        // Handle different contact info structures
        if (Array.isArray(contactInfo.emails)) {
          emails = contactInfo.emails;
        } else if (contactInfo.email) {
          emails = [contactInfo.email];
        }
        
        if (Array.isArray(contactInfo.socialProfiles)) {
          socialProfiles = contactInfo.socialProfiles;
        } else if (Array.isArray(contactInfo.social)) {
          socialProfiles = contactInfo.social;
        }
        
        if (Array.isArray(contactInfo.contactForms)) {
          contactForms = contactInfo.contactForms;
        } else if (contactInfo.form) {
          contactForms = [contactInfo.form];
        }
        
        // Count total items found
        totalEmailsFound += emails.length;
        totalSocialProfilesFound += socialProfiles.length;
        totalContactFormsFound += contactForms.length;
        
        // Update metrics
        const hasEmails = emails.length > 0;
        const hasSocial = socialProfiles.length > 0;
        const hasForm = contactForms.length > 0;
        
        if (hasEmails) withEmails++;
        if (hasSocial) withSocial++;
        if (hasForm) withContactForms++;
        
        // Count combinations
        if (hasEmails && hasSocial && hasForm) {
          withAllThree++;
        } else if ((hasEmails && hasSocial) || (hasEmails && hasForm) || (hasSocial && hasForm)) {
          withTwo++;
          
          if (hasEmails && hasSocial) withEmailAndSocial++;
          if (hasEmails && hasForm) withEmailAndForm++;
          if (hasSocial && hasForm) withSocialAndForm++;
        } else {
          withOne++;
        }
        
        // Count social platforms
        for (const profile of socialProfiles) {
          const platform = profile.platform?.toLowerCase();
          if (platform) {
            socialPlatforms[platform] = (socialPlatforms[platform] || 0) + 1;
          }
        }
        
      } catch (error) {
        console.error(`Error parsing contact info for opportunity ${opportunity.id}:`, error);
      }
    }
    
    // Calculate percentages
    const total = opportunities.length;
    const emailsPercent = (withEmails / total * 100).toFixed(2);
    const socialPercent = (withSocial / total * 100).toFixed(2);
    const formPercent = (withContactForms / total * 100).toFixed(2);
    const allThreePercent = (withAllThree / total * 100).toFixed(2);
    const twoPercent = (withTwo / total * 100).toFixed(2);
    const onePercent = (withOne / total * 100).toFixed(2);
    
    // Premium opportunities stats
    const premiumOpps = await db.select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.isPremium, true));
    
    const premiumWithContact = await db.select()
      .from(discoveredOpportunities)
      .where(
        and(
          eq(discoveredOpportunities.isPremium, true),
          not(isNull(discoveredOpportunities.contactInfo))
        )
      );
    
    const premiumCoverage = (premiumWithContact.length / premiumOpps.length * 100).toFixed(2);
    
    // Output detailed analysis
    console.log("\n============================================");
    console.log("CONTACT INFORMATION COVERAGE ANALYSIS");
    console.log("============================================");
    
    console.log(`\nOverall Coverage:
    • Total Opportunities: ${opportunities.length}
    • Premium Opportunities Coverage: ${premiumWithContact.length}/${premiumOpps.length} (${premiumCoverage}%)

Contact Types Coverage:
    • With Email Addresses: ${withEmails} (${emailsPercent}%)
    • With Social Profiles: ${withSocial} (${socialPercent}%)
    • With Contact Forms: ${withContactForms} (${formPercent}%)

Contact Combinations:
    • With all three types: ${withAllThree} (${allThreePercent}%)
    • With two types: ${withTwo} (${twoPercent}%)
    • With only one type: ${withOne} (${onePercent}%)
    
    • Email + Social: ${withEmailAndSocial}
    • Email + Form: ${withEmailAndForm}
    • Social + Form: ${withSocialAndForm}

Total Items Found:
    • Email Addresses: ${totalEmailsFound}
    • Social Profiles: ${totalSocialProfilesFound}
    • Contact Forms: ${totalContactFormsFound}

Social Platform Breakdown:`);

    // Sort platforms by frequency
    const sortedPlatforms = Object.entries(socialPlatforms)
      .filter(([_, count]) => count > 0)
      .sort(([_, countA], [__, countB]) => countB - countA);
    
    for (const [platform, count] of sortedPlatforms) {
      const platformPercent = (count / withSocial * 100).toFixed(2);
      console.log(`    • ${platform}: ${count} (${platformPercent}%)`);
    }
    
    console.log("\n============================================");
    
  } catch (error) {
    console.error("Error in contact coverage analysis:", error);
  }
}

// Run the analysis
analyzeContactCoverage().catch(console.error);