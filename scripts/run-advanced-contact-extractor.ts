/**
 * Run Advanced Contact Extractor
 * 
 * This script executes the comprehensive advanced contact extractor
 * to significantly improve contact information coverage for all opportunities.
 * 
 * Target coverage goals:
 * - 65-80% overall contact information coverage
 * - 90-95% coverage for premium opportunities
 */

import { runAdvancedContactExtraction } from './advanced-contact-extractor';

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const premiumOnly = args.includes('--premium-only');

// Parse batch size if provided
let batchSize = 15; // Default batch size
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
if (batchSizeArg) {
  const batchSizeValue = parseInt(batchSizeArg.split('=')[1], 10);
  if (!isNaN(batchSizeValue) && batchSizeValue > 0) {
    batchSize = batchSizeValue;
  }
}

// Parse limit if provided
let limit = Infinity;
const limitArg = args.find(arg => arg.startsWith('--limit='));
if (limitArg) {
  const limitValue = parseInt(limitArg.split('=')[1], 10);
  if (!isNaN(limitValue) && limitValue > 0) {
    limit = limitValue;
  }
}

// Configuration object for the contact extraction process
const config = {
  isDryRun,
  premiumOnly,
  batchSize,
  limit
};

(async () => {
  console.log('Starting advanced contact extraction process...');
  
  // Log configuration options
  if (isDryRun) {
    console.log('DRY RUN MODE: No actual database updates will be performed');
  }
  
  if (premiumOnly) {
    console.log('PREMIUM ONLY MODE: Only processing premium opportunities');
  }
  
  if (batchSize !== 15) {
    console.log(`BATCH SIZE: Processing opportunities in batches of ${batchSize}`);
  }
  
  if (limit !== Infinity) {
    console.log(`LIMIT: Processing a maximum of ${limit} opportunities`);
  }
  
  try {
    await runAdvancedContactExtraction(config);
    console.log('Advanced contact extraction completed successfully.');
  } catch (error) {
    console.error('Error during advanced contact extraction:', error);
    process.exit(1);
  }
  
  process.exit(0);
})();