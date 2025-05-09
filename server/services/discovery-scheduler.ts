import { OpportunityCrawler, getOpportunityCrawler } from './crawler';
import { WebsiteAnalyzer, getWebsiteAnalyzer } from './website-analyzer';
import { OpportunityMatcher, getOpportunityMatcher } from './opportunity-matcher';

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
  private crawler: OpportunityCrawler;
  private analyzer: WebsiteAnalyzer;
  private matcher: OpportunityMatcher;
  
  constructor() {
    this.crawler = getOpportunityCrawler();
    this.analyzer = getWebsiteAnalyzer();
    this.matcher = getOpportunityMatcher();
  }
  
  /**
   * Run the discovery pipeline end-to-end
   * This would typically be triggered by a scheduled job
   */
  async runDiscoveryPipeline(): Promise<{ success: boolean, stats: any }> {
    console.log('[DiscoveryScheduler] Starting discovery pipeline');
    
    const stats = {
      analyzedWebsites: 0,
      discoveredOpportunities: 0,
      processedOpportunities: 0,
      createdMatches: 0,
      assignedOpportunities: 0,
      errors: 0
    };
    
    try {
      // 1. Discover new opportunities (in production, this would use a list of seed URLs)
      const discoveryJob = await this.crawler.startDiscoveryCrawl('resource_page', [
        'https://example.com/resources',
        'https://example.org/links'
      ]);
      
      if (discoveryJob.status === 'completed') {
        stats.discoveredOpportunities = discoveryJob.results?.discovered || 0;
      }
      
      // 2. Process discovered opportunities with Moz data
      await this.crawler.processDiscoveredBatch([]);
      stats.processedOpportunities += 1;
      
      // 3. Match opportunities to websites
      const matchesCreated = await this.matcher.processNewOpportunities();
      stats.createdMatches = matchesCreated;
      
      // 4. Assign daily opportunities to users
      const assignedCount = await this.matcher.assignDailyOpportunities();
      stats.assignedOpportunities = assignedCount;
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('[DiscoveryScheduler] Error in discovery pipeline:', error);
      stats.errors += 1;
      
      return {
        success: false,
        stats
      };
    }
  }
  
  /**
   * Schedule the discovery pipeline to run at regular intervals
   * In production, this would be replaced with a proper job scheduler
   */
  startScheduler(intervalHours = 24): void {
    console.log(`[DiscoveryScheduler] Scheduling discovery pipeline to run every ${intervalHours} hours`);
    
    // Run immediately
    this.runDiscoveryPipeline().catch(error => {
      console.error('[DiscoveryScheduler] Error in initial run:', error);
    });
    
    // Schedule regular runs
    setInterval(() => {
      this.runDiscoveryPipeline().catch(error => {
        console.error('[DiscoveryScheduler] Error in scheduled run:', error);
      });
    }, intervalHours * 60 * 60 * 1000);
  }
  
  /**
   * Analyze a specific user's websites
   */
  async analyzeUserWebsites(userId: number): Promise<number> {
    try {
      const profiles = await this.analyzer.processUserWebsites(userId);
      return profiles.length;
    } catch (error) {
      console.error(`[DiscoveryScheduler] Error analyzing user ${userId} websites:`, error);
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