import { db } from '../db';
import { getWebsiteAnalyzer } from './website-analyzer';
import { 
  discoveredOpportunities, 
  opportunityMatches, 
  websiteProfiles, 
  websites, 
  dailyDrips,
  DiscoveredOpportunity
} from '@shared/schema';
import { eq, and, inArray, sql, lte, desc, gte } from 'drizzle-orm';

/**
 * Opportunity Matcher Service
 * 
 * This service handles the matching of validated opportunities to user websites
 * based on relevance, user preferences, and website profiles.
 */
export class OpportunityMatcher {
  private websiteAnalyzer = getWebsiteAnalyzer();
  
  constructor() {
    console.log('[OpportunityMatcher] Initialized');
  }
  
  /**
   * Find matching opportunities for a specific website
   */
  async findMatchesForWebsite(websiteId: number, limit = 10): Promise<DiscoveredOpportunity[]> {
    try {
      // Get website profile
      const [websiteProfile] = await db.select()
        .from(websiteProfiles)
        .where(eq(websiteProfiles.websiteId, websiteId));
      
      if (!websiteProfile) {
        console.log(`[OpportunityMatcher] No profile found for website ID ${websiteId}`);
        return [];
      }
      
      // Get website details including preferences
      const [websiteDetails] = await db.select()
        .from(websites)
        .where(eq(websites.id, websiteId));
      
      if (!websiteDetails) {
        console.log(`[OpportunityMatcher] Website ID ${websiteId} not found`);
        return [];
      }
      
      // Get validated opportunities
      const validatedOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(eq(discoveredOpportunities.status, 'validated'))
        .limit(100);
      
      // Score and rank opportunities
      const scoredOpportunities = await Promise.all(
        validatedOpportunities.map(async opportunity => {
          const relevanceScore = this.websiteAnalyzer.calculateRelevance(
            websiteProfile,
            opportunity
          );
          
          // Apply filters from preferences
          const preferences = websiteDetails.preferences || {};
          let qualityScore = 0;
          
          // Calculate quality score based on DA and other metrics
          if (opportunity.domainAuthority) {
            qualityScore += Math.min(50, opportunity.domainAuthority);
          }
          
          if (opportunity.spamScore !== undefined && opportunity.spamScore <= 3) {
            qualityScore += 20;
          }
          
          // Include business logic filters - for example:
          let passesFilter = true;
          
          // Minimum DA filter
          if (preferences.minDomainAuthority && 
              opportunity.domainAuthority < preferences.minDomainAuthority) {
            passesFilter = false;
          }
          
          // Maximum spam score filter
          if (preferences.maxSpamScore !== undefined && 
              opportunity.spamScore !== undefined && 
              opportunity.spamScore > preferences.maxSpamScore) {
            passesFilter = false;
          }
          
          // Source type filters
          if (preferences.excludedSourceTypes && 
              preferences.excludedSourceTypes.includes(opportunity.sourceType)) {
            passesFilter = false;
          }
          
          // Calculate final score - weighted combination of relevance and quality
          const finalScore = passesFilter ? 
            (relevanceScore * 0.7) + (qualityScore * 0.3) : 0;
          
          return {
            opportunity,
            relevanceScore,
            qualityScore,
            finalScore
          };
        })
      );
      
      // Sort by final score and take the top matches
      const topMatches = scoredOpportunities
        .filter(item => item.finalScore > 40) // Minimum threshold
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, limit);
      
      console.log(`[OpportunityMatcher] Found ${topMatches.length} matches for website ID ${websiteId}`);
      
      return topMatches.map(match => match.opportunity);
    } catch (error) {
      console.error(`[OpportunityMatcher] Error finding matches for website ${websiteId}:`, error);
      return [];
    }
  }
  
  /**
   * Find premium matches for a website (higher quality threshold)
   */
  async findPremiumMatchesForWebsite(websiteId: number, limit = 1): Promise<DiscoveredOpportunity[]> {
    try {
      // Get website profile
      const [websiteProfile] = await db.select()
        .from(websiteProfiles)
        .where(eq(websiteProfiles.websiteId, websiteId));
      
      if (!websiteProfile) {
        return [];
      }
      
      // Get premium opportunities that haven't been assigned yet
      const premiumOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(
          and(
            eq(discoveredOpportunities.isPremium, true),
            eq(discoveredOpportunities.status, 'validated')
          )
        )
        .limit(50);
      
      // Score and rank opportunities
      const scoredOpportunities = await Promise.all(
        premiumOpportunities.map(async opportunity => {
          const relevanceScore = this.websiteAnalyzer.calculateRelevance(
            websiteProfile,
            opportunity
          );
          
          // Higher quality threshold for premium opportunities
          const qualityScore = 
            (opportunity.domainAuthority || 0) * 0.5 + 
            (100 - (opportunity.spamScore || 0) * 10) * 0.3 +
            (opportunity.pageAuthority || 0) * 0.2;
          
          // Calculate final score with higher emphasis on quality for premium
          const finalScore = (relevanceScore * 0.4) + (qualityScore * 0.6);
          
          return {
            opportunity,
            relevanceScore,
            qualityScore,
            finalScore
          };
        })
      );
      
      // Sort by final score and take the top matches
      const topMatches = scoredOpportunities
        .filter(item => item.finalScore > 60) // Higher threshold for premium
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, limit);
      
      console.log(`[OpportunityMatcher] Found ${topMatches.length} premium matches for website ID ${websiteId}`);
      
      return topMatches.map(match => match.opportunity);
    } catch (error) {
      console.error(`[OpportunityMatcher] Error finding premium matches for website ${websiteId}:`, error);
      return [];
    }
  }
  
  /**
   * Assign matches to a user's daily feed
   */
  async assignDailyMatches(userId: number): Promise<{ count: number, premium: number }> {
    try {
      // Get user's websites
      const userWebsites = await db.select()
        .from(websites)
        .where(eq(websites.userId, userId));
      
      if (userWebsites.length === 0) {
        console.log(`[OpportunityMatcher] No websites found for user ID ${userId}`);
        return { count: 0, premium: 0 };
      }
      
      // Get today's date (without time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if we already assigned drips today
      const existingDrips = await db.select()
        .from(dailyDrips)
        .where(
          and(
            eq(dailyDrips.userId, userId),
            gte(dailyDrips.dripDate, today)
          )
        );
      
      if (existingDrips.length > 0) {
        console.log(`[OpportunityMatcher] Already assigned drips to user ${userId} today`);
        return { 
          count: existingDrips.length, 
          premium: existingDrips.filter(drip => drip.isPremium).length 
        };
      }
      
      let regularMatchCount = 0;
      let premiumMatchCount = 0;
      
      // Get user's plan details (this would come from the user record in a real implementation)
      const userPlan = await this.getUserPlan(userId);
      
      // Process each website
      for (const website of userWebsites) {
        if (regularMatchCount < userPlan.dailyDrips) {
          // Find regular matches
          const regularMatches = await this.findMatchesForWebsite(
            website.id, 
            userPlan.dailyDrips - regularMatchCount
          );
          
          // Assign matches
          for (const match of regularMatches) {
            await this.assignMatch(match, userId, website.id, false);
            regularMatchCount++;
          }
        }
        
        // If user has remaining premium drips, find premium matches
        if (premiumMatchCount < userPlan.remainingSplashes) {
          const premiumMatches = await this.findPremiumMatchesForWebsite(
            website.id,
            userPlan.remainingSplashes - premiumMatchCount
          );
          
          for (const match of premiumMatches) {
            await this.assignMatch(match, userId, website.id, true);
            premiumMatchCount++;
          }
        }
      }
      
      console.log(`[OpportunityMatcher] Assigned ${regularMatchCount} regular and ${premiumMatchCount} premium matches to user ${userId}`);
      
      return { count: regularMatchCount, premium: premiumMatchCount };
    } catch (error) {
      console.error(`[OpportunityMatcher] Error assigning daily matches for user ${userId}:`, error);
      return { count: 0, premium: 0 };
    }
  }
  
  /**
   * Assign a specific opportunity to a user
   */
  private async assignMatch(
    opportunity: DiscoveredOpportunity, 
    userId: number, 
    websiteId: number, 
    isPremium: boolean
  ): Promise<void> {
    try {
      // Mark opportunity as assigned
      await db.update(discoveredOpportunities)
        .set({
          status: isPremium ? 'premium' : 'assigned',
          lastChecked: new Date()
        })
        .where(eq(discoveredOpportunities.id, opportunity.id));
      
      // Create opportunity match record
      await db.insert(opportunityMatches)
        .values({
          opportunityId: opportunity.id,
          userId,
          websiteId,
          assignedAt: new Date(),
          status: 'active',
          isPremium
        });
      
      // Create daily drip record
      await db.insert(dailyDrips)
        .values({
          userId,
          opportunityId: opportunity.id,
          dripDate: new Date(),
          isPremium,
          status: 'active'
        });
    } catch (error) {
      console.error(`[OpportunityMatcher] Error assigning opportunity ${opportunity.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Helper method to get user's plan details
   */
  private async getUserPlan(userId: number): Promise<{
    dailyDrips: number;
    remainingSplashes: number;
  }> {
    // This would be fetched from the user record and subscription details in a real impl
    // Default to free plan limits
    return {
      dailyDrips: 5,
      remainingSplashes: 1
    };
  }
  
  /**
   * Calculate and explain why an opportunity was matched to a website
   */
  async explainMatch(opportunityId: number, websiteId: number): Promise<{
    reasons: string[];
    score: number;
    metrics: any;
  }> {
    try {
      const [opportunity] = await db.select()
        .from(discoveredOpportunities)
        .where(eq(discoveredOpportunities.id, opportunityId));
      
      const [websiteProfile] = await db.select()
        .from(websiteProfiles)
        .where(eq(websiteProfiles.websiteId, websiteId));
      
      if (!opportunity || !websiteProfile) {
        return {
          reasons: ['Not enough data to explain match'],
          score: 0,
          metrics: {}
        };
      }
      
      const relevanceScore = this.websiteAnalyzer.calculateRelevance(
        websiteProfile,
        opportunity
      );
      
      const reasons = [];
      const metrics = {
        relevanceScore,
        domainAuthority: opportunity.domainAuthority,
        spamScore: opportunity.spamScore,
        topics: websiteProfile.topics?.filter(topic => 
          opportunity.pageContent?.toLowerCase().includes(topic.toLowerCase())
        ).slice(0, 5)
      };
      
      // Generate explanation
      if (relevanceScore > 80) {
        reasons.push('High content relevance to your website');
      } else if (relevanceScore > 60) {
        reasons.push('Good content relevance to your website');
      } else {
        reasons.push('Some content relevance to your website');
      }
      
      // DA explanation
      if (opportunity.domainAuthority && opportunity.domainAuthority >= 40) {
        reasons.push(`High domain authority (${opportunity.domainAuthority})`);
      } else if (opportunity.domainAuthority && opportunity.domainAuthority >= 20) {
        reasons.push(`Moderate domain authority (${opportunity.domainAuthority})`);
      }
      
      // Spam score explanation
      if (opportunity.spamScore !== undefined && opportunity.spamScore < 2) {
        reasons.push('Very low spam risk');
      } else if (opportunity.spamScore !== undefined && opportunity.spamScore < 5) {
        reasons.push('Acceptable spam risk');
      }
      
      // Topic match explanation
      const matchedTopics = websiteProfile.topics?.filter(topic => 
        opportunity.pageContent?.toLowerCase().includes(topic.toLowerCase())
      ) || [];
      
      if (matchedTopics.length > 0) {
        reasons.push(`Matches ${matchedTopics.length} topics from your website`);
      }
      
      return {
        reasons,
        score: relevanceScore,
        metrics
      };
    } catch (error) {
      console.error(`[OpportunityMatcher] Error explaining match:`, error);
      return {
        reasons: ['Error generating explanation'],
        score: 0,
        metrics: {}
      };
    }
  }
}

// Singleton instance
let opportunityMatcher: OpportunityMatcher | null = null;

export function getOpportunityMatcher(): OpportunityMatcher {
  if (!opportunityMatcher) {
    opportunityMatcher = new OpportunityMatcher();
  }
  
  return opportunityMatcher;
}