/**
 * Contact Information Coverage Analysis
 * 
 * This script provides a detailed analysis of the current contact information
 * coverage across all opportunities, broken down by contact type and premium status.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";

// Standard contact info structure
interface NormalizedContactInfo {
  emails: string[];
  socialProfiles: Array<{
    platform: string;
    url: string;
    username: string;
  }>;
  contactForms: string[];
  extractionDetails: {
    normalized: boolean;
    source: string;
    version: string;
    lastUpdated: string;
  };
}

async function analyzeContactCoverage() {
  console.log("Starting contact information coverage analysis...");
  
  try {
    // Get all opportunities
    const allOpportunities = await db.select()
      .from(discoveredOpportunities);
      
    const totalOpportunities = allOpportunities.length;
    const premiumOpportunities = allOpportunities.filter(o => o.isPremium).length;
    const regularOpportunities = totalOpportunities - premiumOpportunities;
    
    console.log(`\nTotal Opportunities: ${totalOpportunities}`);
    console.log(`Premium Opportunities: ${premiumOpportunities}`);
    console.log(`Regular Opportunities: ${regularOpportunities}`);
    
    // Get all opportunities with contact info
    const opportunitiesWithContact = allOpportunities.filter(o => o.contactInfo !== null);
    const totalWithContact = opportunitiesWithContact.length;
    const premiumWithContact = opportunitiesWithContact.filter(o => o.isPremium).length;
    const regularWithContact = totalWithContact - premiumWithContact;
    
    console.log(`\nOpportunities with Contact Info: ${totalWithContact} (${((totalWithContact / totalOpportunities) * 100).toFixed(2)}%)`);
    console.log(`Premium with Contact Info: ${premiumWithContact} (${((premiumWithContact / premiumOpportunities) * 100).toFixed(2)}%)`);
    console.log(`Regular with Contact Info: ${regularWithContact} (${((regularWithContact / regularOpportunities) * 100).toFixed(2)}%)`);
    
    // Analyze by contact type
    let withEmails = 0;
    let withSocial = 0;
    let withForms = 0;
    
    let premiumWithEmails = 0;
    let premiumWithSocial = 0;
    let premiumWithForms = 0;
    
    for (const opportunity of opportunitiesWithContact) {
      try {
        // Parse the contact info which might be stored in various formats
        let contactInfo: NormalizedContactInfo;
        
        if (typeof opportunity.contactInfo === 'string') {
          // Try to parse it as JSON
          try {
            // Handle doubly-escaped JSON strings
            if (opportunity.contactInfo.startsWith('"') && opportunity.contactInfo.endsWith('"')) {
              const unquoted = opportunity.contactInfo.slice(1, -1);
              const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              contactInfo = JSON.parse(unescaped);
            } else {
              contactInfo = JSON.parse(opportunity.contactInfo);
            }
          } catch (e) {
            console.error(`Error parsing contact info for opportunity ${opportunity.id}: ${e.message}`);
            continue;
          }
        } else {
          // It's already an object
          contactInfo = opportunity.contactInfo as unknown as NormalizedContactInfo;
        }
        
        // Count by type
        const hasEmails = contactInfo.emails && contactInfo.emails.length > 0;
        const hasSocial = contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0;
        const hasForms = contactInfo.contactForms && contactInfo.contactForms.length > 0;
        
        if (hasEmails) withEmails++;
        if (hasSocial) withSocial++;
        if (hasForms) withForms++;
        
        if (opportunity.isPremium) {
          if (hasEmails) premiumWithEmails++;
          if (hasSocial) premiumWithSocial++;
          if (hasForms) premiumWithForms++;
        }
      } catch (error) {
        console.error(`Error analyzing opportunity ${opportunity.id}:`, error);
      }
    }
    
    console.log(`\nContact Info by Type:`);
    console.log(`- With Email: ${withEmails} (${((withEmails / totalWithContact) * 100).toFixed(2)}%)`);
    console.log(`- With Social: ${withSocial} (${((withSocial / totalWithContact) * 100).toFixed(2)}%)`);
    console.log(`- With Contact Forms: ${withForms} (${((withForms / totalWithContact) * 100).toFixed(2)}%)`);
    
    console.log(`\nPremium Contact Info by Type:`);
    console.log(`- With Email: ${premiumWithEmails} (${((premiumWithEmails / premiumWithContact) * 100).toFixed(2)}%)`);
    console.log(`- With Social: ${premiumWithSocial} (${((premiumWithSocial / premiumWithContact) * 100).toFixed(2)}%)`);
    console.log(`- With Contact Forms: ${premiumWithForms} (${((premiumWithForms / premiumWithContact) * 100).toFixed(2)}%)`);
    
    // Additional metrics for premium opportunities
    const highDAOpportunities = allOpportunities.filter(o => o.domainAuthority >= 50).length;
    const highDAWithContact = opportunitiesWithContact.filter(o => o.domainAuthority >= 50).length;
    
    console.log(`\nHigh Domain Authority (DA≥50) Coverage:`);
    console.log(`- High DA Opportunities: ${highDAOpportunities}`);
    console.log(`- With Contact Info: ${highDAWithContact} (${((highDAWithContact / highDAOpportunities) * 100).toFixed(2)}%)`);
    
  } catch (error) {
    console.error("Error in analysis:", error);
  }
  
  console.log("\nAnalysis completed!");
}

// Run the function
analyzeContactCoverage().catch(console.error);