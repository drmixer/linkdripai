/**
 * Run Contact Coverage Improvement
 * 
 * This script executes the improved contact coverage process
 * to significantly increase contact information extraction
 * for both regular and premium opportunities.
 * 
 * Target coverage goals:
 * - 65-80% overall contact information coverage
 * - 90-95% coverage for premium opportunities
 */

import { increaseContactCoverage } from './increase-contact-coverage';

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

(async () => {
  console.log('Starting contact coverage improvement process...');
  
  if (isDryRun) {
    console.log('DRY RUN MODE: No actual database updates will be performed');
  }
  
  try {
    await increaseContactCoverage(isDryRun);
    console.log('Contact coverage improvement completed successfully.');
  } catch (error) {
    console.error('Error during contact coverage improvement:', error);
    process.exit(1);
  }
  
  process.exit(0);
})();