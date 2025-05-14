/**
 * Run Fixed Contact Coverage Script
 * 
 * This script executes the improved contact coverage process
 * to significantly increase contact information extraction
 * for both regular and premium opportunities.
 * 
 * Target coverage goals:
 * - 65-80% overall contact information coverage
 * - 90-95% coverage for premium opportunities
 */

import { increaseContactCoverage } from './fixed-contact-coverage';

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const premiumOnly = args.includes('--premium-only');

// Parse batch size if provided
let batchSize = 20; // Default batch size
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
if (batchSizeArg) {
  const batchSizeValue = parseInt(batchSizeArg.split('=')[1], 10);
  if (!isNaN(batchSizeValue) && batchSizeValue > 0) {
    batchSize = batchSizeValue;
  }
}

// Configuration object for the contact coverage process
const config = {
  isDryRun,
  premiumOnly,
  batchSize
};

(async () => {
  console.log('Starting fixed contact coverage improvement process...');
  
  // Log configuration options
  if (isDryRun) {
    console.log('DRY RUN MODE: No actual database updates will be performed');
  }
  
  if (premiumOnly) {
    console.log('PREMIUM ONLY MODE: Only processing premium opportunities');
  }
  
  if (batchSize !== 20) {
    console.log(`BATCH SIZE: Processing opportunities in batches of ${batchSize}`);
  }
  
  try {
    await increaseContactCoverage(config);
    console.log('Contact coverage improvement completed successfully.');
  } catch (error) {
    console.error('Error during contact coverage improvement:', error);
    process.exit(1);
  }
  
  process.exit(0);
})();