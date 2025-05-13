// Script to mark high-quality opportunities as premium
import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { eq, and, isNull, gt, lt } from 'drizzle-orm';

/**
 * Mark high-quality opportunities as premium
 * Criteria:
 * - Domain Authority (DA) of 40+
 * - Spam Score < 2
 */
async function markPremiumOpportunities() {
  console.log('Marking premium opportunities...');
  
  // Find opportunities that meet the criteria - first try with original criteria
  let highQualityOpportunities = await db.select({
    id: discoveredOpportunities.id,
    domain: discoveredOpportunities.domain,
    domainAuthority: discoveredOpportunities.domainAuthority,
    spamScore: discoveredOpportunities.spamScore
  })
  .from(discoveredOpportunities)
  .where(
    and(
      gt(discoveredOpportunities.domainAuthority, 39),
      lt(discoveredOpportunities.spamScore, 2),
      eq(discoveredOpportunities.isPremium, false)
    )
  );
  
  // If no opportunities meet the strict criteria, relax the criteria
  if (highQualityOpportunities.length === 0) {
    console.log('No opportunities meet the strict criteria. Relaxing criteria...');
    
    // First, check for high DA opportunities
    highQualityOpportunities = await db.select({
      id: discoveredOpportunities.id,
      domain: discoveredOpportunities.domain,
      domainAuthority: discoveredOpportunities.domainAuthority,
      spamScore: discoveredOpportunities.spamScore
    })
    .from(discoveredOpportunities)
    .where(
      and(
        gt(discoveredOpportunities.domainAuthority, 50),  // Higher DA requirement
        eq(discoveredOpportunities.isPremium, false)      // Not already premium
      )
    );
    
    // If still no results, try a more relaxed approach
    if (highQualityOpportunities.length === 0) {
      console.log('No high DA opportunities found. Trying more relaxed criteria...');
      
      highQualityOpportunities = await db.select({
        id: discoveredOpportunities.id,
        domain: discoveredOpportunities.domain,
        domainAuthority: discoveredOpportunities.domainAuthority,
        spamScore: discoveredOpportunities.spamScore
      })
      .from(discoveredOpportunities)
      .where(
        and(
          gt(discoveredOpportunities.domainAuthority, 30),  // Lower DA requirement
          lt(discoveredOpportunities.spamScore, 3),         // Still low spam score
          eq(discoveredOpportunities.isPremium, false)      // Not already premium
        )
      );
    }
    
    // Limit to 50 premium opportunities (about 10% of total)
    if (highQualityOpportunities.length > 50) {
      console.log(`Found ${highQualityOpportunities.length} opportunities, limiting to top 50 by domain authority.`);
      highQualityOpportunities = highQualityOpportunities
        .sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0))
        .slice(0, 50);
    }
  }
  
  console.log(`Found ${highQualityOpportunities.length} high-quality opportunities to mark as premium.`);
  
  // Mark opportunities as premium
  let markedCount = 0;
  for (const opportunity of highQualityOpportunities) {
    try {
      await db.update(discoveredOpportunities)
        .set({
          isPremium: true
        })
        .where(eq(discoveredOpportunities.id, opportunity.id));
      
      markedCount++;
    } catch (error) {
      console.error(`Error marking opportunity ${opportunity.id} as premium:`, error.message);
    }
  }
  
  console.log(`Successfully marked ${markedCount} opportunities as premium.`);
}

markPremiumOpportunities().then(() => {
  console.log('Done marking premium opportunities.');
  process.exit(0);
}).catch(error => {
  console.error('Error in script:', error);
  process.exit(1);
});