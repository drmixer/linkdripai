/**
 * This script is used to run the deep contact extractor process
 * which will significantly improve contact information coverage
 * for all opportunities in the database.
 */

import { extractDeepContactInfo } from './deep-contact-extractor';

// Execute the deep contact extractor
(async () => {
  console.log('Starting the deep contact information extraction process...');
  
  try {
    await extractDeepContactInfo();
    console.log('Deep contact information extraction process completed successfully.');
  } catch (error) {
    console.error('Error during deep contact information extraction:', error);
    process.exit(1);
  }
  
  process.exit(0);
})();