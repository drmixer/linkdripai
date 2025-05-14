/**
 * Test Advanced Contact Extraction
 * 
 * This script tests the advanced contact extraction on a single website
 * to verify that the methods work correctly.
 */

import { cleanupUrl, extractEmailsFromPage, findContactPages, findContactFormUrl, extractSocialProfiles } from './advanced-contact-extractor';

async function testAdvancedExtraction() {
  // You can change this URL to test different websites
  const testUrl = 'https://moz.com';
  
  console.log(`Testing advanced contact extraction on ${testUrl}...`);
  
  try {
    // Extract emails
    console.log("\nExtracting emails...");
    const emails = await extractEmailsFromPage(testUrl);
    console.log(`Found ${emails.length} emails: ${JSON.stringify(emails)}`);
    
    // Find contact pages
    console.log("\nFinding contact pages...");
    const contactPages = await findContactPages(testUrl);
    console.log(`Found ${contactPages.length} contact pages: ${JSON.stringify(contactPages)}`);
    
    // Find contact form
    console.log("\nFinding contact form...");
    const contactForm = await findContactFormUrl(testUrl);
    console.log(`Contact form: ${contactForm}`);
    
    // Extract social profiles
    console.log("\nExtracting social profiles...");
    const socialProfiles = await extractSocialProfiles(testUrl);
    console.log(`Found ${socialProfiles.length} social profiles:`);
    socialProfiles.forEach(profile => {
      console.log(`- ${profile.platform}: ${profile.username} (${profile.url})`);
    });
    
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error during testing:", error);
  }
}

// Run the test
testAdvancedExtraction().catch(console.error);
