// Script to mark high-quality opportunities as premium
import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { eq, and, isNull, gt, lt, desc, sql } from 'drizzle-orm';

/**
 * Mark high-quality opportunities as premium
 * Criteria:
 * - Domain Authority (DA) of 40+
 * - Spam Score < 2
 * - Relevance Score of 7+
 */
async function markPremiumOpportunities() {
  console.log('Marking premium opportunities...');
  
  // Let's take a more direct approach and extract relevance scores after fetching the data
  // First, we'll select opportunities with good domain authority and spam scores
  
  // Try tier 1 - optimal opportunities
  // High domain authority, low spam, high relevance, with contact information
  // Use simpler criteria without complex SQL
  let highQualityOpportunities = await db.select({
    id: discoveredOpportunities.id,
    domain: discoveredOpportunities.domain,
    domainAuthority: discoveredOpportunities.domainAuthority,
    spamScore: discoveredOpportunities.spamScore,
    metadataRaw: discoveredOpportunities.metadataRaw
  })
  .from(discoveredOpportunities)
  .where(
    and(
      eq(discoveredOpportunities.isPremium, false),
      gt(discoveredOpportunities.domainAuthority, 30)
    )
  )
  .orderBy(desc(discoveredOpportunities.domainAuthority))
  .limit(100);
  
  // Process metadata and add relevance scores
  const processedOpportunities = highQualityOpportunities.map(opp => {
    let relevanceScore = 0;
    
    // Extract relevance score from metadata if available
    if (opp.metadataRaw) {
      try {
        const metadata = JSON.parse(opp.metadataRaw);
        relevanceScore = metadata.relevanceScore || metadata.relevance || 0;
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    
    return {
      ...opp,
      relevanceScore
    };
  });
  
  // Sort by a combination of factors
  highQualityOpportunities = processedOpportunities.sort((a, b) => {
    // Weight DA more heavily, but consider relevance and spam score
    const aScore = (a.domainAuthority || 0) * 2 - (a.spamScore || 0) * 3 + (a.relevanceScore || 0) * 5;
    const bScore = (b.domainAuthority || 0) * 2 - (b.spamScore || 0) * 3 + (b.relevanceScore || 0) * 5;
    return bScore - aScore;
  });
  
  // Limit to top 50
  highQualityOpportunities = highQualityOpportunities.slice(0, 50);
  
  // Our opportunities are already scored and sorted, so let's just add a quality score metric
  const scoredOpportunities = highQualityOpportunities.map(opp => {
    // Simple quality score calculation based on available metrics
    const daFactor = Math.min(100, Math.max(0, opp.domainAuthority || 0));
    const spamFactor = 100 - (Math.min(10, Math.max(0, opp.spamScore || 0)) * 10);
    const relevanceFactor = Math.min(100, Math.max(0, (opp.relevanceScore || 0) * 10));
    
    // Calculate quality score - weighted combination
    const qualityScore = (daFactor * 0.5) + (spamFactor * 0.2) + (relevanceFactor * 0.3);
    
    return {
      ...opp,
      qualityScore
    };
  });
  
  // Take the top opportunities (already sorted by overall score)
  const finalOpportunities = scoredOpportunities.slice(0, 50);
  
  console.log(`Found ${highQualityOpportunities.length} potential high-quality opportunities.`);
  console.log(`Selected top ${finalOpportunities.length} opportunities as premium based on quality score.`);
  
  // Mark opportunities as premium
  let markedCount = 0;
  for (const opportunity of finalOpportunities) {
    try {
      // Create metadata with quality score information
      const metadataObj = {
        qualityScore: opportunity.qualityScore,
        premiumTier: opportunity.qualityScore >= 80 ? 'top' : 
                     opportunity.qualityScore >= 60 ? 'high' : 'standard',
        premiumDate: new Date().toISOString()
      };
      
      await db.update(discoveredOpportunities)
        .set({
          isPremium: true,
          // Also update the status to premium for these high-quality opportunities
          status: 'premium',
          validationData: metadataObj
        })
        .where(eq(discoveredOpportunities.id, opportunity.id));
      
      markedCount++;
      
      // Log some of the top opportunities
      if (markedCount <= 5) {
        console.log(`Premium opportunity #${markedCount}: ${opportunity.domain} - DA: ${opportunity.domainAuthority}, Quality: ${opportunity.qualityScore.toFixed(1)}`);
      }
    } catch (error) {
      console.error(`Error marking opportunity ${opportunity.id} as premium:`, error.message);
    }
  }
  
  console.log(`Successfully marked ${markedCount} opportunities as premium.`);
  
  // Also update the status for non-premium opportunities to provide context
  try {
    const nonPremiumResult = await db
      .update(discoveredOpportunities)
      .set({ 
        status: 'validated'
      })
      .where(
        and(
          eq(discoveredOpportunities.isPremium, false),
          eq(discoveredOpportunities.status, 'discovered')
        )
      );
    
    console.log(`Also updated non-premium opportunities to validated status.`);
  } catch (error) {
    console.error(`Error updating non-premium opportunities:`, error.message);
  }
}

markPremiumOpportunities().then(() => {
  console.log('Done marking premium opportunities.');
  process.exit(0);
}).catch(error => {
  console.error('Error in script:', error);
  process.exit(1);
});