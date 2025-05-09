import { WebsiteProfile, DiscoveredOpportunity, OpportunityMatch, Prospect, User } from '@shared/schema';
import { db } from '../db';
import { eq, and, gte, lt, sql, desc, asc } from 'drizzle-orm';
import { websiteProfiles, discoveredOpportunities, opportunityMatches, prospects, users, websites, dailyDrips } from '@shared/schema';

/**
 * Opportunity Matcher Service
 * 
 * This service matches discovered opportunities to user websites based on:
 * 1. Niche alignment
 * 2. Content relevance
 * 3. Quality metrics (DA, spam score)
 * 4. User preferences
 */
export class OpportunityMatcher {
  
  /**
   * Calculate match score between a website and an opportunity
   * Returns a score from 0-100 and reasons for the match
   */
  calculateMatchScore(
    profile: WebsiteProfile, 
    opportunity: DiscoveredOpportunity, 
    opportunityData: any
  ): { score: number, reasons: string[] } {
    const reasons: string[] = [];
    let score = 50; // Base score
    
    // Extract opportunity data
    const oppNiche = opportunityData?.niche || '';
    const oppKeywords = opportunityData?.keywords || [];
    const oppDa = opportunityData?.mozMetrics?.domain_authority?.score || 0;
    const oppSpamScore = opportunityData?.mozMetrics?.spam_score || 50;
    
    // 1. Check niche alignment (up to +25 points)
    if (profile.targetNiches?.includes(oppNiche)) {
      score += 25;
      reasons.push(`Niche match: ${oppNiche}`);
    } else if (profile.avoidNiches?.includes(oppNiche)) {
      score -= 25;
      reasons.push(`Avoided niche: ${oppNiche}`);
    }
    
    // 2. Check keyword overlap (up to +15 points)
    const keywordMatches = (profile.keywords || []).filter(kw => 
      oppKeywords.some((ok: string) => ok.includes(kw))
    );
    
    if (keywordMatches.length > 0) {
      const keywordBonus = Math.min(15, keywordMatches.length * 3);
      score += keywordBonus;
      reasons.push(`${keywordMatches.length} matching keywords`);
    }
    
    // 3. Domain Authority bonus (up to +20 points)
    if (oppDa >= 50) {
      score += 20;
      reasons.push(`High DA: ${oppDa}`);
    } else if (oppDa >= 30) {
      score += 10;
      reasons.push(`Good DA: ${oppDa}`);
    } else if (oppDa < 20) {
      score -= 10;
      reasons.push(`Low DA: ${oppDa}`);
    }
    
    // 4. Spam Score penalty (up to -20 points)
    if (oppSpamScore > 10) {
      const spamPenalty = Math.min(20, (oppSpamScore - 10) * 2);
      score -= spamPenalty;
      reasons.push(`High spam score: ${oppSpamScore}`);
    }
    
    // 5. Source type bonus (up to +10 points)
    const sourceType = opportunity.sourceType;
    if (sourceType === 'resource_page') {
      score += 10;
      reasons.push('High-value resource page');
    } else if (sourceType === 'directory') {
      score += 5;
      reasons.push('Directory listing');
    }
    
    // Ensure score is between 0-100
    score = Math.max(0, Math.min(100, score));
    
    return { score, reasons };
  }
  
  /**
   * Convert a discovered opportunity to a prospect
   */
  async convertToProspect(opportunity: DiscoveredOpportunity): Promise<Prospect> {
    // Extract data from opportunity
    const rawData = opportunity.rawData as any || {};
    const mozMetrics = rawData.mozMetrics || {};
    
    // Create prospect record
    const [prospect] = await db.insert(prospects)
      .values({
        siteType: opportunity.sourceType.replace('_', ' '),
        siteName: opportunity.pageTitle || 'Unknown Site',
        domain: opportunity.domain,
        domainAuthority: String(mozMetrics?.domain_authority?.score || 'N/A'),
        pageAuthority: String(mozMetrics?.page_authority?.score || 'N/A'),
        spamScore: String(mozMetrics?.spam_score || 'N/A'),
        totalLinks: String(mozMetrics?.links || 'N/A'),
        rootDomainsLinking: String(mozMetrics?.root_domains_linking || 'N/A'),
        lastCrawled: new Date().toISOString(),
        niche: rawData.niche || 'General',
        monthlyTraffic: rawData.traffic || 'Unknown',
        contactEmail: opportunity.contactInfo?.email || null,
        contactRole: null,
        contactName: null,
        targetUrl: opportunity.url,
        fitScore: 70, // Default fit score, will be updated per user
        isUnlocked: false,
        isSaved: false,
        isNew: true,
        isHidden: false
      })
      .returning();
      
    return prospect;
  }
  
  /**
   * Create match record between website and prospect
   */
  async createMatch(
    websiteId: number, 
    prospectId: number, 
    score: number, 
    reasons: string[]
  ): Promise<OpportunityMatch> {
    const [match] = await db.insert(opportunityMatches)
      .values({
        websiteId,
        prospectId,
        matchScore: score,
        matchReason: reasons,
        status: 'pending'
      })
      .returning();
      
    return match;
  }
  
  /**
   * Process new opportunities for matching
   */
  async processNewOpportunities(): Promise<number> {
    // Get analyzed but unmatched opportunities
    const opportunities = await db.select()
      .from(discoveredOpportunities)
      .where(eq(discoveredOpportunities.status, 'analyzed'));
    
    let matchesCreated = 0;
    
    // Process each opportunity
    for (const opportunity of opportunities) {
      try {
        // Convert to prospect for our system
        const prospect = await this.convertToProspect(opportunity);
        
        // Get all website profiles
        const profiles = await db.select().from(websiteProfiles);
        
        // Match against each profile
        for (const profile of profiles) {
          const { score, reasons } = this.calculateMatchScore(
            profile, 
            opportunity, 
            opportunity.rawData
          );
          
          // Only create match if score is above threshold
          if (score >= 40) {
            await this.createMatch(profile.websiteId, prospect.id, score, reasons);
            matchesCreated++;
          }
        }
        
        // Update opportunity status to matched
        await db.update(discoveredOpportunities)
          .set({ status: 'matched' })
          .where(eq(discoveredOpportunities.id, opportunity.id));
        
      } catch (error) {
        console.error(`Error processing opportunity ${opportunity.id}:`, error);
      }
    }
    
    return matchesCreated;
  }
  
  /**
   * Assign daily opportunities to users based on their plan
   */
  async assignDailyOpportunities(): Promise<number> {
    // Get all users
    const allUsers = await db.select().from(users);
    let totalAssigned = 0;
    
    for (const user of allUsers) {
      try {
        // Get user's websites
        const userWebsites = await db.select().from(websites)
          .where(eq(websites.userId, user.id));
        
        // For each website, assign daily opportunities
        for (const website of userWebsites) {
          // Get daily drip count based on user plan
          let dailyLimit = 5; // Default Free Trial
          
          switch (user.subscription) {
            case 'Pro':
              dailyLimit = 15; // Updated based on feasibility analysis
              break;
            case 'Grow':
              dailyLimit = 12; // Updated based on feasibility analysis
              break;
            case 'Starter':
              dailyLimit = 7; // Updated based on feasibility analysis
              break;
            default:
              dailyLimit = 5; // Free Trial or default
          }
          
          // Get today's date (without time)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          // Check if daily drip exists for today
          const existingDrips = await db.select()
            .from(dailyDrips)
            .where(
              and(
                eq(dailyDrips.userId, user.id),
                eq(dailyDrips.websiteId, website.id),
                gte(dailyDrips.date, today),
                lt(dailyDrips.date, tomorrow)
              )
            );
          
          // If no drip for today, create one
          if (existingDrips.length === 0) {
            // Create daily drip record
            const [drip] = await db.insert(dailyDrips)
              .values({
                userId: user.id,
                websiteId: website.id,
                date: today,
                opportunitiesLimit: dailyLimit,
                opportunitiesDelivered: 0,
                isPurchasedExtra: false,
                matches: []
              })
              .returning();
            
            // Get highest-scoring pending matches for this website
            const pendingMatches = await db.select()
              .from(opportunityMatches)
              .where(
                and(
                  eq(opportunityMatches.websiteId, website.id),
                  eq(opportunityMatches.status, 'pending')
                )
              )
              .orderBy(desc(opportunityMatches.matchScore))
              .limit(dailyLimit);
            
            // If we have matches, assign them
            if (pendingMatches.length > 0) {
              const matchIds = pendingMatches.map(m => m.id);
              
              // Update daily drip with matches
              await db.update(dailyDrips)
                .set({ 
                  matches: matchIds,
                  opportunitiesDelivered: matchIds.length
                })
                .where(eq(dailyDrips.id, drip.id));
              
              // Update match records
              for (const match of pendingMatches) {
                await db.update(opportunityMatches)
                  .set({ 
                    status: 'assigned',
                    showDate: today
                  })
                  .where(eq(opportunityMatches.id, match.id));
                  
                // Update prospect with fit score from match
                await db.update(prospects)
                  .set({ fitScore: match.matchScore })
                  .where(eq(prospects.id, match.prospectId));
              }
              
              totalAssigned += matchIds.length;
            }
          }
        }
      } catch (error) {
        console.error(`Error assigning opportunities for user ${user.id}:`, error);
      }
    }
    
    return totalAssigned;
  }
  
  /**
   * Get daily opportunities for a user
   */
  async getUserDailyOpportunities(userId: number, websiteId?: number): Promise<Prospect[]> {
    try {
      // Get today's date (without time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Build query condition
      let dripsCondition;
      if (websiteId) {
        dripsCondition = and(
          eq(dailyDrips.userId, userId),
          eq(dailyDrips.websiteId, websiteId),
          gte(dailyDrips.date, today),
          lt(dailyDrips.date, tomorrow)
        );
      } else {
        dripsCondition = and(
          eq(dailyDrips.userId, userId),
          gte(dailyDrips.date, today),
          lt(dailyDrips.date, tomorrow)
        );
      }
      
      // Get daily drips for today
      const drips = await db.select().from(dailyDrips).where(dripsCondition);
      
      // No drips found
      if (drips.length === 0) {
        return [];
      }
      
      // Collect all match IDs
      const matchIds: number[] = [];
      for (const drip of drips) {
        matchIds.push(...(drip.matches || []));
      }
      
      if (matchIds.length === 0) {
        return [];
      }
      
      // Get matches
      const matches = await db.select()
        .from(opportunityMatches)
        .where(sql`${opportunityMatches.id} IN (${matchIds.join(',')})`);
      
      // Get prospect IDs
      const prospectIds = matches.map(m => m.prospectId);
      
      if (prospectIds.length === 0) {
        return [];
      }
      
      // Get prospects
      const prospectResults = await db.select()
        .from(prospects)
        .where(sql`${prospects.id} IN (${prospectIds.join(',')})`)
        .orderBy(desc(prospects.fitScore), asc(prospects.id));
      
      return prospectResults;
    } catch (error) {
      console.error(`Error getting daily opportunities for user ${userId}:`, error);
      return [];
    }
  }
}

// Singleton instance
let matcherInstance: OpportunityMatcher | null = null;

export function getOpportunityMatcher(): OpportunityMatcher {
  if (!matcherInstance) {
    matcherInstance = new OpportunityMatcher();
  }
  return matcherInstance;
}