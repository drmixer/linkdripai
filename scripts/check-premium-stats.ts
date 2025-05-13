import { pool } from "../server/db";

/**
 * This script checks premium opportunity statistics
 * to verify the quality of our premium opportunities
 */
async function checkPremiumStats() {
  console.log('Checking premium opportunity statistics...');
  
  try {
    // Count total opportunities
    const totalResult = await pool.query(`
      SELECT COUNT(*) FROM "discoveredOpportunities"
    `);
    const totalCount = parseInt(totalResult.rows[0].count);
    
    // Count premium opportunities
    const premiumResult = await pool.query(`
      SELECT COUNT(*) FROM "discoveredOpportunities"
      WHERE "isPremium" = true
    `);
    const premiumCount = parseInt(premiumResult.rows[0].count);
    
    // Calculate premium percentage
    const premiumPercentage = (premiumCount / totalCount * 100).toFixed(1);
    
    console.log(`Total opportunities: ${totalCount}`);
    console.log(`Premium opportunities: ${premiumCount} (${premiumPercentage}%)`);
    
    // Check domain authority distribution
    const daDistribution = await pool.query(`
      SELECT 
        CASE 
          WHEN "domainAuthority" >= 70 THEN '70-100'
          WHEN "domainAuthority" >= 50 THEN '50-69'
          WHEN "domainAuthority" >= 30 THEN '30-49'
          WHEN "domainAuthority" >= 10 THEN '10-29'
          ELSE '0-9'
        END as "daRange",
        COUNT(*) as "count",
        COUNT(*) FILTER (WHERE "isPremium" = true) as "premiumCount"
      FROM "discoveredOpportunities"
      GROUP BY "daRange"
      ORDER BY "daRange" DESC
    `);
    
    console.log('\nDomain Authority Distribution:');
    console.log('------------------------------');
    console.log('DA Range | Total | Premium | % Premium');
    console.log('------------------------------');
    daDistribution.rows.forEach(row => {
      const percentage = row.count > 0 ? (row.premiumCount / row.count * 100).toFixed(1) : '0.0';
      console.log(`${row.daRange.padEnd(9)} | ${row.count.toString().padEnd(5)} | ${row.premiumCount.toString().padEnd(7)} | ${percentage}%`);
    });
    
    // Check spam score distribution
    const spamDistribution = await pool.query(`
      SELECT 
        CASE 
          WHEN "spamScore" <= 1 THEN '0-1 (Excellent)'
          WHEN "spamScore" <= 3 THEN '2-3 (Good)'
          WHEN "spamScore" <= 5 THEN '4-5 (Average)'
          WHEN "spamScore" <= 7 THEN '6-7 (Poor)'
          ELSE '8+ (Bad)'
        END as "spamRange",
        COUNT(*) as "count",
        COUNT(*) FILTER (WHERE "isPremium" = true) as "premiumCount"
      FROM "discoveredOpportunities"
      GROUP BY "spamRange"
      ORDER BY "spamRange"
    `);
    
    console.log('\nSpam Score Distribution:');
    console.log('------------------------------');
    console.log('Spam Range | Total | Premium | % Premium');
    console.log('------------------------------');
    spamDistribution.rows.forEach(row => {
      const percentage = row.count > 0 ? (row.premiumCount / row.count * 100).toFixed(1) : '0.0';
      console.log(`${row.spamRange.padEnd(12)} | ${row.count.toString().padEnd(5)} | ${row.premiumCount.toString().padEnd(7)} | ${percentage}%`);
    });
    
    // Check source type distribution
    const sourceDistribution = await pool.query(`
      SELECT 
        "sourceType",
        COUNT(*) as "count",
        COUNT(*) FILTER (WHERE "isPremium" = true) as "premiumCount"
      FROM "discoveredOpportunities"
      GROUP BY "sourceType"
      ORDER BY "count" DESC
    `);
    
    console.log('\nSource Type Distribution:');
    console.log('------------------------------');
    console.log('Source Type | Total | Premium | % Premium');
    console.log('------------------------------');
    sourceDistribution.rows.forEach(row => {
      const percentage = row.count > 0 ? (row.premiumCount / row.count * 100).toFixed(1) : '0.0';
      console.log(`${(row.sourceType || 'unknown').padEnd(11)} | ${row.count.toString().padEnd(5)} | ${row.premiumCount.toString().padEnd(7)} | ${percentage}%`);
    });
    
    // Get top 10 premium domains by domain authority
    const topPremiumDomains = await pool.query(`
      SELECT domain, "domainAuthority", "spamScore", status
      FROM "discoveredOpportunities"
      WHERE "isPremium" = true
      ORDER BY "domainAuthority" DESC
      LIMIT 10
    `);
    
    console.log('\nTop 10 Premium Domains (by Domain Authority):');
    console.log('---------------------------------------------');
    console.log('Domain | DA | Spam Score | Status');
    console.log('---------------------------------------------');
    topPremiumDomains.rows.forEach(row => {
      console.log(`${row.domain.padEnd(30)} | ${(row.domainAuthority || 'N/A').toString().padEnd(3)} | ${(row.spamScore || 'N/A').toString().padEnd(10)} | ${row.status || 'unknown'}`);
    });
    
  } catch (error) {
    console.error('Error checking premium stats:', error.message);
  } finally {
    // Make sure to release the DB pool
    await pool.end();
  }
}

checkPremiumStats().then(() => {
  console.log('\nDone checking premium opportunity statistics.');
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});