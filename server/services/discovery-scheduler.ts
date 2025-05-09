import { getOpportunityCrawler } from './crawler';
import { getWebsiteAnalyzer } from './website-analyzer';
import { getOpportunityMatcher } from './opportunity-matcher';
import { db } from '../db';
import { users, websites } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Discovery Scheduler Service
 * 
 * This service coordinates the entire opportunity discovery and matching process:
 * 1. Schedules website analysis
 * 2. Initiates discovery crawls
 * 3. Processes discovered opportunities
 * 4. Assigns matches to users' daily feeds
 */
export class DiscoveryScheduler {
  private crawler = getOpportunityCrawler();
  private analyzer = getWebsiteAnalyzer();
  private matcher = getOpportunityMatcher();
  private isSchedulerRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor() {
    console.log('[Discovery] Scheduler initialized');
  }
  
  /**
   * Run the discovery pipeline end-to-end
   * This would typically be triggered by a scheduled job
   */
  async runDiscoveryPipeline(): Promise<{ success: boolean, stats: any }> {
    if (this.isSchedulerRunning) {
      console.log('[Discovery] Pipeline already running, skipping');
      return { success: false, stats: { skipped: true } };
    }
    
    this.isSchedulerRunning = true;
    console.log('[Discovery] Starting discovery pipeline');
    
    const stats: any = {
      startTime: new Date(),
      websitesAnalyzed: 0,
      opportunitiesDiscovered: 0,
      matchesCreated: 0,
      dripsAssigned: 0,
      errors: 0,
    };
    
    try {
      // Step 1: Analyze all user websites
      const allUsers = await db.select().from(users);
      
      for (const user of allUsers) {
        try {
          const websitesAnalyzed = await this.analyzeUserWebsites(user.id);
          stats.websitesAnalyzed += websitesAnalyzed;
        } catch (error) {
          console.error(`[Discovery] Error analyzing websites for user ${user.id}:`, error);
          stats.errors++;
        }
      }
      
      // Step 2: Discover new opportunities
      // For demo purposes, we'll use a predefined list of URLs
      // In production, this would come from multiple sources
      const crawlUrls = [
        'https://www.example.com/resources',
        'https://www.example.org/blog',
        'https://www.example.net/write-for-us',
      ];
      
      try {
        const job = await this.crawler.startDiscoveryCrawl('all', crawlUrls);
        console.log(`[Discovery] Started crawler job ${job.id}`);
        
        // In a real implementation, we would wait for the job to complete
        // or set up a callback mechanism. For now, we'll continue with the pipeline.
        
        // Record estimated opportunities (in production this would be actual count)
        stats.opportunitiesDiscovered = crawlUrls.length;
      } catch (error) {
        console.error('[Discovery] Error starting discovery crawl:', error);
        stats.errors++;
      }
      
      // Step 3: Process discovered opportunities
      try {
        await this.crawler.processDiscoveredBatch([]);
        console.log('[Discovery] Processed discovered opportunities');
      } catch (error) {
        console.error('[Discovery] Error processing opportunities:', error);
        stats.errors++;
      }
      
      // Step 4: Create matches between opportunities and websites
      try {
        const matchesCreated = await this.matcher.processNewOpportunities();
        stats.matchesCreated = matchesCreated;
        console.log(`[Discovery] Created ${matchesCreated} matches`);
      } catch (error) {
        console.error('[Discovery] Error creating matches:', error);
        stats.errors++;
      }
      
      // Step 5: Assign daily drips to users
      try {
        const dripsAssigned = await this.matcher.assignDailyOpportunities();
        stats.dripsAssigned = dripsAssigned;
        console.log(`[Discovery] Assigned ${dripsAssigned} daily drips`);
      } catch (error) {
        console.error('[Discovery] Error assigning daily drips:', error);
        stats.errors++;
      }
      
      stats.endTime = new Date();
      stats.durationMs = stats.endTime - stats.startTime;
      
      console.log('[Discovery] Pipeline completed successfully', stats);
      this.isSchedulerRunning = false;
      
      return { success: true, stats };
    } catch (error) {
      console.error('[Discovery] Pipeline failed:', error);
      
      stats.endTime = new Date();
      stats.durationMs = stats.endTime - stats.startTime;
      stats.failed = true;
      
      this.isSchedulerRunning = false;
      return { success: false, stats };
    }
  }
  
  /**
   * Schedule the discovery pipeline to run at regular intervals
   * In production, this would be replaced with a proper job scheduler
   */
  startScheduler(intervalHours = 24): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    console.log(`[Discovery] Scheduling discovery to run every ${intervalHours} hours`);
    
    // Convert hours to milliseconds
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    // Schedule the pipeline
    this.intervalId = setInterval(() => {
      this.runDiscoveryPipeline().catch(error => {
        console.error('[Discovery] Scheduled pipeline failed:', error);
      });
    }, intervalMs);
  }
  
  /**
   * Analyze a specific user's websites
   */
  async analyzeUserWebsites(userId: number): Promise<number> {
    try {
      // Get user's websites
      const userWebsites = await db.select()
        .from(websites)
        .where(eq(websites.userId, userId));
      
      if (userWebsites.length === 0) {
        return 0;
      }
      
      let processedCount = 0;
      
      // Process each website
      for (const website of userWebsites) {
        try {
          await this.analyzer.processWebsite(website);
          processedCount++;
        } catch (error) {
          console.error(`[Discovery] Error processing website ${website.id}:`, error);
        }
      }
      
      return processedCount;
    } catch (error) {
      console.error(`[Discovery] Error analyzing websites for user ${userId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
let schedulerInstance: DiscoveryScheduler | null = null;

export function getDiscoveryScheduler(): DiscoveryScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DiscoveryScheduler();
  }
  return schedulerInstance;
}