import { db, pool } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { eq, gt, lt, and } from "drizzle-orm";

/**
 * This script marks high-quality opportunities as premium
 * It uses direct database operations rather than complex Drizzle queries
 * to make it more resilient
 */
async function markPremiumOpportunitiesSimple() {
  console.log('Marking premium opportunities (simplified version)...');
  
  try {
    // Get opportunity count
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM "discoveredOpportunities"
    `);
    const totalCount = parseInt(countResult.rows[0].count);
    console.log(`Total opportunities in database: ${totalCount}`);
    
    // Step 1: Select potential premium candidates using simple SQL
    const highQualityCandidates = await pool.query(`
      SELECT id, domain, "domainAuthority", "spamScore", "validationData" 
      FROM "discoveredOpportunities"
      WHERE "domainAuthority" > 30 
      AND "isPremium" = false
      ORDER BY "domainAuthority" DESC
      LIMIT 100
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
    
    // Step 3: Score and sort candidates
    const scoredCandidates = processedCandidates.map(opp => {
      const daFactor = Math.min(100, Math.max(0, opp.domainAuthority || 0));
      const spamFactor = 100 - (Math.min(10, Math.max(0, opp.spamScore || 0)) * 10);
      const relevanceFactor = Math.min(100, Math.max(0, (opp.relevanceScore || 0) * 10));
      
      // Calculate quality score - weighted combination
      const qualityScore = (daFactor * 0.5) + (spamFactor * 0.2) + (relevanceFactor * 0.3);
      
      return {
        ...opp,
        qualityScore
      };
    }).sort((a, b) => b.qualityScore - a.qualityScore);
    
    // Step 4: Select top 50 candidates to mark as premium
    const premiumCandidates = scoredCandidates.slice(0, 50);
    
    console.log(`Selected ${premiumCandidates.length} opportunities as premium based on quality score.`);
    
    // Step 5: Update opportunities as premium one by one with error handling
    let markedCount = 0;
    for (const opp of premiumCandidates) {
      try {
        // Log some of the top opportunities
        if (markedCount < 5) {
          console.log(`Premium opportunity #${markedCount+1}: ${opp.domain} - DA: ${opp.domainAuthority || 'unknown'}, Quality: ${opp.qualityScore.toFixed(1)}`);
        }
        
        // Create metadata with quality score information
        const metadataObj = {
          qualityScore: opp.qualityScore,
          premiumTier: opp.qualityScore >= 80 ? 'top' : 
                      opp.qualityScore >= 60 ? 'high' : 'standard',
          premiumDate: new Date().toISOString()
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

markPremiumOpportunitiesSimple().then(() => {
  console.log('Done marking premium opportunities.');
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});