import { db, pool } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq, gt, lt, and } from "drizzle-orm";

/**
 * This script marks high-quality opportunities as premium
 * Refined version that's more selective about spam scores
 */
async function markPremiumOpportunitiesRefined() {
  console.log('Marking premium opportunities (refined version)...');
  
  try {
    // Reset premium status first
    await pool.query(`
      UPDATE "discoveredOpportunities" 
      SET "isPremium" = false, 
          status = CASE WHEN status = 'premium' THEN 'validated' ELSE status END
      WHERE "isPremium" = true
    `);
    
    console.log('Reset premium status for all opportunities.');
    
    // Step 1: Select potential premium candidates using more rigorous criteria
    const highQualityCandidates = await pool.query(`
      SELECT id, domain, "domainAuthority", "spamScore", "validationData" 
      FROM "discoveredOpportunities"
      WHERE "domainAuthority" >= 35 
      AND "spamScore" < 10
      ORDER BY "domainAuthority" DESC
      LIMIT 200
    `);
    
    console.log(`Found ${highQualityCandidates.rows.length} potential high-quality candidates.`);
    
    // Step 2: Process the relevance scores from validationData
    const processedCandidates = highQualityCandidates.rows.map(opp => {
      let relevanceScore = 0;
      
      // Extract relevance score from validation data if available
      if (opp.validationData) {
        try {
          if (typeof opp.validationData === 'string') {
            const data = JSON.parse(opp.validationData);
            relevanceScore = data.relevanceScore || data.relevance || 0;
          } else if (typeof opp.validationData === 'object') {
            relevanceScore = opp.validationData.relevanceScore || opp.validationData.relevance || 0;
          }
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
      
      return {
        ...opp,
        relevanceScore
      };
    });
    
    // Step 3: Score and sort candidates with improved weighting (higher penalty for spam)
    const scoredCandidates = processedCandidates.map(opp => {
      const daFactor = Math.min(100, Math.max(0, opp.domainAuthority || 0));
      
      // More severe spam penalty: 10 = 0%, 0 = 100%
      const spamScore = Math.min(10, Math.max(0, opp.spamScore || 0));
      const spamFactor = 100 - (spamScore * 10);
      
      const relevanceFactor = Math.min(100, Math.max(0, (opp.relevanceScore || 0) * 10));
      
      // Adjusted weighting formula (increases spam penalty)
      const qualityScore = (daFactor * 0.4) + (spamFactor * 0.4) + (relevanceFactor * 0.2);
      
      return {
        ...opp,
        qualityScore,
        spamFactor
      };
    }).sort((a, b) => b.qualityScore - a.qualityScore);
    
    // Step 4: Apply additional filters to ensure spam quality
    // - Ensure at least 70% of DA 70+ sites are included regardless of spam 
    // - Cap opportunities with poor spam scores but preserve diversity
    const premiumCandidates = [];
    
    // First, ensure top DA sites are included
    const topDaSites = scoredCandidates.filter(opp => (opp.domainAuthority || 0) >= 70);
    const topDaSitesToInclude = Math.ceil(topDaSites.length * 0.7);
    premiumCandidates.push(...topDaSites.slice(0, topDaSitesToInclude));
    
    // Then, add remaining sites with better balance
    const remainingCandidates = scoredCandidates.filter(opp => (opp.domainAuthority || 0) < 70)
      .filter(opp => {
        // Higher spam filter for lower DA sites
        const maxAllowedSpam = ((opp.domainAuthority || 0) >= 50) ? 7 : 5;
        return (opp.spamScore || 0) <= maxAllowedSpam;
      });
    
    // Cap at 120 total candidates
    const additionalCount = Math.min(120 - premiumCandidates.length, remainingCandidates.length);
    premiumCandidates.push(...remainingCandidates.slice(0, additionalCount));
    
    // Sort one more time to ensure best opportunities are marked first
    premiumCandidates.sort((a, b) => b.qualityScore - a.qualityScore);
    
    // Limit to 100 candidates
    const finalCandidates = premiumCandidates.slice(0, 100);
    
    console.log(`Selected ${finalCandidates.length} opportunities as premium based on quality score.`);
    
    // Step 5: Update opportunities as premium
    let markedCount = 0;
    for (const opp of finalCandidates) {
      try {
        // Log top opportunities
        if (markedCount < 10) {
          console.log(`Premium opportunity #${markedCount+1}: ${opp.domain} - DA: ${opp.domainAuthority || 'unknown'}, Spam: ${opp.spamScore || 'unknown'}, Quality: ${opp.qualityScore.toFixed(1)}`);
        }
        
        // Create metadata with quality score information
        const metadataObj = {
          qualityScore: opp.qualityScore,
          premiumTier: opp.qualityScore >= 80 ? 'top' : 
                      opp.qualityScore >= 60 ? 'high' : 'standard',
          premiumDate: new Date().toISOString(),
          premiumReason: `High quality opportunity (DA: ${opp.domainAuthority}, Spam: ${opp.spamScore}, Score: ${opp.qualityScore.toFixed(1)})`
        };
        
        // Update using simple SQL query for maximum compatibility
        await pool.query(`
          UPDATE "discoveredOpportunities"
          SET "isPremium" = true,
              status = 'premium',
              "validationData" = $1
          WHERE id = $2
        `, [metadataObj, opp.id]);
        
        markedCount++;
      } catch (error) {
        console.error(`Error marking opportunity ${opp.id} as premium:`, error.message);
      }
    }
    
    console.log(`Successfully marked ${markedCount} opportunities as premium.`);
    
    // Step 6: Update non-premium opportunities to validated status
    try {
      const updateResult = await pool.query(`
        UPDATE "discoveredOpportunities"
        SET status = 'validated'
        WHERE "isPremium" = false
        AND status = 'discovered'
      `);
      
      console.log(`Updated ${updateResult.rowCount} non-premium opportunities to validated status.`);
    } catch (error) {
      console.error(`Error updating non-premium opportunities:`, error.message);
    }
  } catch (error) {
    console.error('Error in mark premium script:', error.message);
  } finally {
    // Make sure to release the DB pool
    await pool.end();
  }
}

markPremiumOpportunitiesRefined().then(() => {
  console.log('Done marking premium opportunities.');
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});