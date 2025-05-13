import { db } from '../db';
import { getWebsiteAnalyzer } from './website-analyzer';
import { 
  discoveredOpportunities, 
  opportunityMatches, 
  websiteProfiles, 
  websites, 
  dailyDrips,
  users,
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
   * Process newly discovered and validated opportunities
   * Creates matches between opportunities and website profiles
   */
  async processNewOpportunities(): Promise<number> {
    try {
      // Get all validated opportunities that haven't been matched yet
      const newOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(
          and(
            eq(discoveredOpportunities.status, 'validated'),
            sql`NOT EXISTS (
              SELECT 1 FROM ${opportunityMatches}
              WHERE ${opportunityMatches.opportunityId} = ${discoveredOpportunities.id}
            )`
          )
        );
      
      if (newOpportunities.length === 0) {
        console.log('[OpportunityMatcher] No new opportunities to process');
        return 0;
      }
      
      console.log(`[OpportunityMatcher] Processing ${newOpportunities.length} new opportunities`);
      
      // Get all website profiles
      const profiles = await db.select({
        profile: websiteProfiles,
        website: websites
      })
      .from(websiteProfiles)
      .innerJoin(
        websites,
        eq(websiteProfiles.websiteId, websites.id)
      );
      
      if (profiles.length === 0) {
        console.log('[OpportunityMatcher] No website profiles found for matching');
        return 0;
      }
      
      let matchCount = 0;
      
      // For each opportunity, find matching websites
      for (const opportunity of newOpportunities) {
        // Score each website profile against this opportunity
        const scores = await Promise.all(
          profiles.map(async ({ profile, website }) => {
            const relevanceScore = this.websiteAnalyzer.calculateRelevance(
              profile,
              opportunity
            );
            
            return {
              websiteId: website.id,
              userId: website.userId,
              relevanceScore,
              isPremium: opportunity.isPremium || false
            };
          })
        );
        
        // Get the top matches (relevanceScore > 60)
        const topMatches = scores
          .filter(score => score.relevanceScore > 60)
          .sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        // Create matches for the top websites
        for (const match of topMatches) {
          await db.insert(opportunityMatches)
            .values({
              opportunityId: opportunity.id,
              userId: match.userId,
              websiteId: match.websiteId,
              assignedAt: new Date(),
              status: 'pending', // Will be assigned to daily feed later
              isPremium: match.isPremium
            });
          
          matchCount++;
        }
        
        // Update the opportunity status
        if (topMatches.length > 0) {
          await db.update(discoveredOpportunities)
            .set({ status: 'matched' })
            .where(eq(discoveredOpportunities.id, opportunity.id));
        }
      }
      
      console.log(`[OpportunityMatcher] Created ${matchCount} matches from new opportunities`);
      return matchCount;
    } catch (error) {
      console.error('[OpportunityMatcher] Error processing new opportunities:', error);
      return 0;
    }
  }
  
  /**
   * Assign daily opportunities to users' feeds
   */
  async assignDailyOpportunities(): Promise<number> {
    try {
      // Get all users
      const allUsers = await db.select().from(users);
      
      if (allUsers.length === 0) {
        console.log('[OpportunityMatcher] No users found for assigning daily opportunities');
        return 0;
      }
      
      let totalAssigned = 0;
      
      // Process each user
      for (const user of allUsers) {
        const result = await this.assignDailyMatches(user.id);
        totalAssigned += result.count + result.premium;
      }
      
      console.log(`[OpportunityMatcher] Assigned ${totalAssigned} daily opportunities to users`);
      return totalAssigned;
    } catch (error) {
      console.error('[OpportunityMatcher] Error assigning daily opportunities:', error);
      return 0;
    }
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
   * Get the opportunities assigned to a user's daily feed
   * @param userId The user ID
   * @param websiteId Optional website ID filter
   */
  async getUserDailyOpportunities(userId: number, websiteId?: number): Promise<any[]> {
    try {
      // Get today's date (without time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Build the query to fetch daily drips
      let query = db.select({
        drip: dailyDrips,
        opportunity: discoveredOpportunities
      })
      .from(dailyDrips)
      .innerJoin(
        discoveredOpportunities,
        eq(dailyDrips.opportunityId, discoveredOpportunities.id)
      )
      .where(
        and(
          eq(dailyDrips.userId, userId),
          gte(dailyDrips.dripDate, today)
        )
      )
      .orderBy(desc(dailyDrips.dripDate));
      
      // Add website filter if specified
      if (websiteId) {
        const matches = db.select()
          .from(opportunityMatches)
          .where(
            and(
              eq(opportunityMatches.userId, userId),
              eq(opportunityMatches.websiteId, websiteId)
            )
          );
        
        query = query.where(
          inArray(
            dailyDrips.opportunityId,
            matches.select({ id: opportunityMatches.opportunityId })
          )
        );
      }
      
      // Execute the query
      const results = await query;
      
      // Format the response
      return results.map(result => {
        return {
          ...result.opportunity,
          dripId: result.drip.id,
          dripDate: result.drip.dripDate,
          isPremium: result.drip.isPremium,
          matchedWebsiteId: websiteId || null
        };
      });
    } catch (error) {
      console.error(`[OpportunityMatcher] Error fetching daily opportunities for user ${userId}:`, error);
      return [];
    }
  }
  
  /**
   * Calculate and explain why an opportunity was matched to a website
   * @param opportunity Either the opportunity object or the opportunity ID
   * @param websiteId The website ID
   */
  async explainMatch(opportunity: DiscoveredOpportunity | number, websiteId?: number): Promise<{
    reasons: string[];
    score: number;
    metrics: any;
  }> {
    try {
      let opportunityObj: DiscoveredOpportunity | undefined;
      
      // Handle both object and ID inputs for flexibility
      if (typeof opportunity === 'number') {
        const [foundOpportunity] = await db.select()
          .from(discoveredOpportunities)
          .where(eq(discoveredOpportunities.id, opportunity));
        opportunityObj = foundOpportunity;
      } else {
        opportunityObj = opportunity;
      }
      
      if (!websiteId && typeof opportunity !== 'number') {
        // Try to find most relevant website for this opportunity
        const [match] = await db.select()
          .from(opportunityMatches)
          .where(eq(opportunityMatches.opportunityId, opportunityObj.id))
          .limit(1);
        
        if (match) {
          websiteId = match.websiteId;
        }
      }
      
      if (!websiteId) {
        return {
          reasons: ['No website specified for match explanation'],
          score: 0,
          metrics: {}
        };
      }
      
      const [websiteProfile] = await db.select()
        .from(websiteProfiles)
        .where(eq(websiteProfiles.websiteId, websiteId));
      
      if (!opportunityObj || !websiteProfile) {
        return {
          reasons: ['Not enough data to explain match'],
          score: 0,
          metrics: {}
        };
      }
      
      const relevanceScore = this.websiteAnalyzer.calculateRelevance(
        websiteProfile,
        opportunityObj
      );
      
      // Calculate additional metrics for the explanation
      const contentRelevance = Math.min(100, Math.round(relevanceScore * 1.1)); // Slightly enhanced for UI
      const topicMatchCount = websiteProfile.topics?.filter(topic => 
        opportunityObj.pageContent?.toLowerCase().includes(topic.toLowerCase())
      ).length || 0;
      const topicMatch = Math.min(100, topicMatchCount > 0 ? 60 + (topicMatchCount * 8) : 50);
      
      // Calculate keyword density
      const keywords = websiteProfile.keywords || [];
      let keywordMatches = 0;
      
      if (keywords.length > 0 && opportunityObj.pageContent) {
        const content = opportunityObj.pageContent.toLowerCase();
        keywords.forEach(keyword => {
          if (content.includes(keyword.toLowerCase())) {
            keywordMatches++;
          }
        });
      }
      
      const keywordDensity = keywords.length > 0 
        ? Math.min(100, Math.round((keywordMatches / keywords.length) * 100))
        : 50;
      
      // Calculate link potential based on source type
      let linkPotential = 60; // Default moderate potential
      
      switch (opportunityObj.sourceType) {
        case 'resource_page':
          linkPotential = 85; // Resource pages have high link potential
          break;
        case 'guest_post':
          linkPotential = 90; // Guest posts have very high link potential
          break;
        case 'blog':
          linkPotential = 75; // Blogs have good link potential
          break;
        case 'directory':
          linkPotential = 65; // Directories have moderate link potential
          break;
      }
      
      // Calculate overall quality score
      const daScore = opportunityObj.domainAuthority ? Math.min(100, opportunityObj.domainAuthority * 2) : 50;
      const spamPenalty = opportunityObj.spamScore ? Math.min(50, opportunityObj.spamScore * 10) : 20;
      const qualityScore = Math.min(100, Math.round(daScore - spamPenalty + (linkPotential * 0.2)));
      
      const reasons = [];
      const metrics = {
        contentRelevance,
        topicMatch,
        keywordDensity,
        linkPotential,
        domainAuthority: daScore,
        qualityScore
      };
      
      // Generate explanation based on the calculated metrics
      
      // Content relevance explanation
      if (contentRelevance > 80) {
        reasons.push('High content relevance to your website');
      } else if (contentRelevance > 60) {
        reasons.push('Good content relevance to your website');
      } else {
        reasons.push('Some content relevance to your website');
      }
      
      // Domain authority explanation
      if (opportunityObj.domainAuthority && opportunityObj.domainAuthority >= 40) {
        reasons.push(`High domain authority (${opportunityObj.domainAuthority})`);
      } else if (opportunityObj.domainAuthority && opportunityObj.domainAuthority >= 20) {
        reasons.push(`Moderate domain authority (${opportunityObj.domainAuthority})`);
      } else if (opportunityObj.domainAuthority) {
        reasons.push(`Basic domain authority (${opportunityObj.domainAuthority})`);
      }
      
      // Spam score explanation
      if (opportunityObj.spamScore !== undefined && opportunityObj.spamScore < 2) {
        reasons.push('Very low spam risk');
      } else if (opportunityObj.spamScore !== undefined && opportunityObj.spamScore < 5) {
        reasons.push('Acceptable spam risk');
      }
      
      // Topic match explanation
      const matchedTopics = websiteProfile.topics?.filter(topic => 
        opportunityObj.pageContent?.toLowerCase().includes(topic.toLowerCase())
      ) || [];
      
      if (matchedTopics.length > 0) {
        reasons.push(`Matches ${matchedTopics.length} topics from your website`);
        
        // Add a few specific topics if available
        if (matchedTopics.length > 2) {
          const topThree = matchedTopics.slice(0, 3);
          reasons.push(`Topics include: ${topThree.join(', ')}`);
        }
      }
      
      // Source type explanation
      switch (opportunityObj.sourceType) {
        case 'resource_page':
          reasons.push('Resource page: High potential for quality backlinks');
          break;
        case 'guest_post':
          reasons.push('Guest post opportunity: Excellent for authoritative backlinks');
          break;
        case 'blog':
          reasons.push('Blog: Good potential for contextual backlinks');
          break;
        case 'directory':
          reasons.push('Directory: Standard backlink opportunity');
          break;
      }
      
      // Add keyword match explanation if relevant
      if (keywordMatches > 0 && keywords.length > 0) {
        reasons.push(`Matches ${keywordMatches} of your target keywords`);
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