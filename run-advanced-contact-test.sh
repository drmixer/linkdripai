#!/bin/bash

# Run a test of the advanced contact extractor on a single opportunity
# This lets us verify the extraction methods work correctly

# Import the .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Set proper Node options for memory optimization
export NODE_OPTIONS="--max-old-space-size=2048"

# Create a simple test script that uses the advanced extractor on a single URL
cat > scripts/test-advanced-extraction.ts << EOL
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
  
  console.log(\`Testing advanced contact extraction on \${testUrl}...\`);
  
  try {
    // Extract emails
    console.log("\\nExtracting emails...");
    const emails = await extractEmailsFromPage(testUrl);
    console.log(\`Found \${emails.length} emails: \${JSON.stringify(emails)}\`);
    
    // Find contact pages
    console.log("\\nFinding contact pages...");
    const contactPages = await findContactPages(testUrl);
    console.log(\`Found \${contactPages.length} contact pages: \${JSON.stringify(contactPages)}\`);
    
    // Find contact form
    console.log("\\nFinding contact form...");
    const contactForm = await findContactFormUrl(testUrl);
    console.log(\`Contact form: \${contactForm}\`);
    
    // Extract social profiles
    console.log("\\nExtracting social profiles...");
    const socialProfiles = await extractSocialProfiles(testUrl);
    console.log(\`Found \${socialProfiles.length} social profiles:\`);
    socialProfiles.forEach(profile => {
      console.log(\`- \${profile.platform}: \${profile.username} (\${profile.url})\`);
    });
    
    console.log("\\nTest completed successfully!");
  } catch (error) {
    console.error("Error during testing:", error);
  }
}

// Run the test
testAdvancedExtraction().catch(console.error);
EOL

echo "Running advanced contact extraction test..."
npx tsx scripts/test-advanced-extraction.ts

echo "Test completed!"