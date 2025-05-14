/**
 * Contact Information Coverage Analysis
 * 
 * This script analyzes the current contact information coverage
 * for all opportunities, breaking down by type and premium status.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";

interface ContactInfo {
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
    const allOpportunities = await db.select().from(discoveredOpportunities);
    const totalOpps = allOpportunities.length;
    console.log(`Total opportunities: ${totalOpps}`);
    
    // Filter premium opportunities
    const premiumOpps = allOpportunities.filter(opp => opp.isPremium);
    console.log(`Premium opportunities: ${premiumOpps.length}`);
    
    // Count opportunities with contact info
    const withContactInfo = allOpportunities.filter(opp => opp.contactInfo);
    console.log(`\nOpportunities with contact info: ${withContactInfo.length} (${((withContactInfo.length / totalOpps) * 100).toFixed(2)}%)`);
    
    // Count premium opportunities with contact info
    const premiumWithContactInfo = premiumOpps.filter(opp => opp.contactInfo);
    console.log(`Premium opportunities with contact info: ${premiumWithContactInfo.length} (${((premiumWithContactInfo.length / premiumOpps.length) * 100).toFixed(2)}%)`);
    
    // Initialize counters
    let withEmails = 0;
    let withSocial = 0;
    let withForms = 0;
    let premiumWithEmails = 0;
    let premiumWithSocial = 0;
    let premiumWithForms = 0;
    
    // Analyze contact methods
    for (const opp of withContactInfo) {
      try {
        // Parse contact info
        let contactInfo: ContactInfo;
        if (typeof opp.contactInfo === 'string') {
          contactInfo = JSON.parse(opp.contactInfo);
        } else {
          contactInfo = opp.contactInfo as any;
        }
        
        // Count contact methods
        if (contactInfo.emails && contactInfo.emails.length > 0) {
          withEmails++;
          if (opp.isPremium) premiumWithEmails++;
        }
        
        if (contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0) {
          withSocial++;
          if (opp.isPremium) premiumWithSocial++;
        }
        
        if (contactInfo.contactForms && contactInfo.contactForms.length > 0) {
          withForms++;
          if (opp.isPremium) premiumWithForms++;
        }
      } catch (error) {
        console.error(`Error processing opportunity ${opp.id}:`, error);
      }
    }
    
    // Calculate percentages
    const emailPercentage = (withEmails / withContactInfo.length) * 100;
    const socialPercentage = (withSocial / withContactInfo.length) * 100;
    const formPercentage = (withForms / withContactInfo.length) * 100;
    
    const premiumEmailPercentage = (premiumWithEmails / premiumWithContactInfo.length) * 100;
    const premiumSocialPercentage = (premiumWithSocial / premiumWithContactInfo.length) * 100;
    const premiumFormPercentage = (premiumWithForms / premiumWithContactInfo.length) * 100;
    
    // Print results
    console.log("\nContact Method Coverage (All Opportunities):");
    console.log(`- Email addresses: ${withEmails} (${emailPercentage.toFixed(2)}%)`);
    console.log(`- Social profiles: ${withSocial} (${socialPercentage.toFixed(2)}%)`);
    console.log(`- Contact forms: ${withForms} (${formPercentage.toFixed(2)}%)`);
    
    console.log("\nContact Method Coverage (Premium Opportunities):");
    console.log(`- Email addresses: ${premiumWithEmails} (${premiumEmailPercentage.toFixed(2)}%)`);
    console.log(`- Social profiles: ${premiumWithSocial} (${premiumSocialPercentage.toFixed(2)}%)`);
    console.log(`- Contact forms: ${premiumWithForms} (${premiumFormPercentage.toFixed(2)}%)`);
    
    // Determine status
    const anyContact = withEmails + withSocial + withForms;
    const anyContactPercentage = (anyContact / (withContactInfo.length * 3)) * 100;
    
    console.log("\nOverall Contact Availability:");
    console.log(`- At least one contact method: ${withContactInfo.length} (${((withContactInfo.length / totalOpps) * 100).toFixed(2)}%)`);
    console.log(`- Overall contact method coverage: ${anyContactPercentage.toFixed(2)}%`);
    
    // Status Notes Analysis
    const withStatusNotes = allOpportunities.filter(opp => opp.statusNote && opp.statusNote.length > 0);
    console.log(`\nOpportunities with status notes: ${withStatusNotes.length} (${((withStatusNotes.length / totalOpps) * 100).toFixed(2)}%)`);
    
  } catch (error) {
    console.error("Error analyzing contact coverage:", error);
  }
  
  console.log("\nAnalysis completed!");
}

// Run the function
analyzeContactCoverage().catch(console.error);