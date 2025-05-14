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

(async () => {
  console.log('Starting contact coverage improvement process...');
  
  try {
    await increaseContactCoverage();
    console.log('Contact coverage improvement completed successfully.');
  } catch (error) {
    console.error('Error during contact coverage improvement:', error);
    process.exit(1);
  }
  
  process.exit(0);
})();