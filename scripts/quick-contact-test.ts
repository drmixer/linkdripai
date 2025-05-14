/**
 * Quick Contact Test
 * 
 * This script runs a quick test of the advanced contact extractor
 * on a small set of actual opportunities from the database.
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { runAdvancedContactExtraction } from './advanced-contact-extractor';

async function runQuickTest() {
  try {
    console.log('Running quick test of advanced contact extractor...');
    
    // Get current contact coverage statistics
    const totalStats = await db.select({
      total: sql`COUNT(*)`,
      with_contact: sql`COUNT(*) FILTER (WHERE "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}')`
    }).from(discoveredOpportunities);
    
    const premiumStats = await db.select({
      total: sql`COUNT(*) FILTER (WHERE "isPremium" = true)`,
      with_contact: sql`COUNT(*) FILTER (WHERE "isPremium" = true AND "contactInfo" IS NOT NULL AND "contactInfo" != '[]' AND "contactInfo" != '{}')`
    }).from(discoveredOpportunities);
    
    console.log('\nCurrent Contact Information Coverage:');
    console.log(`- Total opportunities: ${totalStats[0].total}`);
    console.log(`- With contact info: ${totalStats[0].with_contact} (${((totalStats[0].with_contact / totalStats[0].total) * 100).toFixed(1)}%)`);
    console.log(`- Premium opportunities: ${premiumStats[0].total}`);
    console.log(`- Premium with contact info: ${premiumStats[0].with_contact} (${((premiumStats[0].with_contact / premiumStats[0].total) * 100).toFixed(1)}%)`);
    
    // Run the advanced contact extractor on a small sample (5 premium opportunities)
    // Use dry run mode to avoid making database changes during the test
    await runAdvancedContactExtraction({
      isDryRun: true,
      premiumOnly: true,
      batchSize: 5,
      limit: 5
    });
    
  } catch (error) {
    console.error('Error during quick test:', error);
  }
}

// Run the quick test
console.log('Starting quick contact extraction test...');
runQuickTest().then(() => {
  console.log('\nQuick test completed!');
}).catch(err => {
  console.error('Test failed with error:', err);
});