import { Website, WebsiteProfile } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { websiteProfiles, websites } from '@shared/schema';
import { MozApiService } from './moz';

/**
 * Website Analyzer Service
 * 
 * This service analyzes user websites to determine:
 * 1. Key topics and keywords
 * 2. Content types
 * 3. Niche alignment
 * 4. Existing backlink profile
 * 
 * This data is used to match opportunities to websites.
 */
export class WebsiteAnalyzer {
  private mozService: MozApiService;
  
  constructor() {
    this.mozService = new MozApiService(
      process.env.MOZ_ACCESS_ID || '',
      process.env.MOZ_SECRET_KEY || ''
    );
  }
  
  /**
   * Create or update a website profile
   */
  async createOrUpdateProfile(websiteId: number, data: Partial<WebsiteProfile>): Promise<WebsiteProfile> {
    // Check if profile exists
    const existingProfiles = await db.select()
      .from(websiteProfiles)
      .where(eq(websiteProfiles.websiteId, websiteId));
    
    if (existingProfiles.length > 0) {
      // Update
      const [updatedProfile] = await db.update(websiteProfiles)
        .set({
          ...data,
          lastUpdated: new Date()
        })
        .where(eq(websiteProfiles.websiteId, websiteId))
        .returning();
      
      return updatedProfile;
    } else {
      // Create new
      const [newProfile] = await db.insert(websiteProfiles)
        .values({
          websiteId,
          ...data,
          analyzedAt: new Date(),
          lastUpdated: new Date()
        })
        .returning();
      
      return newProfile;
    }
  }
  
  /**
   * Get website profile
   */
  async getProfile(websiteId: number): Promise<WebsiteProfile | null> {
    const profiles = await db.select()
      .from(websiteProfiles)
      .where(eq(websiteProfiles.websiteId, websiteId));
    
    return profiles.length > 0 ? profiles[0] : null;
  }
  
  /**
   * Extract keywords and topics from website
   * In a real implementation, this would:
   * 1. Crawl the website
   * 2. Extract text content
   * 3. Use NLP to identify key topics and keywords
   * 
   * For development, we'll extract from the description.
   */
  async extractKeywordsAndTopics(website: Website): Promise<{keywords: string[], topics: string[]}> {
    if (!website.description) {
      return { keywords: [], topics: [] };
    }
    
    // Simple extraction based on description
    // In production, this would use NLP/AI for more accurate extraction
    const words = website.description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Get unique words as keywords
    const keywords = [...new Set(words)].slice(0, 10);
    
    // Extract potential topics - in production this would use AI
    const topics = website.niche ? [website.niche] : [];
    
    return { keywords, topics };
  }
  
  /**
   * Get domain metrics from Moz
   */
  async getDomainMetrics(website: Website): Promise<{ domainAuthority: number | null }> {
    try {
      if (!website.url) {
        return { domainAuthority: null };
      }
      
      const domain = new URL(website.url).hostname;
      const metrics = await this.mozService.getDomainMetrics(domain);
      
      return {
        domainAuthority: metrics?.domain_authority?.score || null
      };
    } catch (error) {
      console.error('Error getting domain metrics:', error);
      return { domainAuthority: null };
    }
  }
  
  /**
   * Extract website preferences
   */
  async extractPreferences(userId: number, websiteId: number): Promise<{
    targetNiches: string[],
    avoidNiches: string[],
    linkTypePreferences: string[]
  }> {
    // Get user from database
    const usersResult = await db.select()
      .from(websites)
      .where(eq(websites.id, websiteId));
    
    if (usersResult.length === 0) {
      return {
        targetNiches: [],
        avoidNiches: [],
        linkTypePreferences: []
      };
    }
    
    // Extract preferences
    const targetNiches = ['general']; // Default
    const avoidNiches: string[] = [];
    const linkTypePreferences = ['dofollow']; // Default
    
    return {
      targetNiches,
      avoidNiches,
      linkTypePreferences
    };
  }
  
  /**
   * Process a website to create/update its profile
   */
  async processWebsite(website: Website): Promise<WebsiteProfile> {
    try {
      console.log(`[WebsiteAnalyzer] Processing website: ${website.name} (${website.id})`);
      
      // Extract information from website
      const { keywords, topics } = await this.extractKeywordsAndTopics(website);
      const { domainAuthority } = await this.getDomainMetrics(website);
      const preferences = await this.extractPreferences(website.userId, website.id);
      
      // Create/update profile
      return await this.createOrUpdateProfile(website.id, {
        keywords,
        topics,
        domainAuthority: domainAuthority || undefined,
        targetNiches: preferences.targetNiches,
        avoidNiches: preferences.avoidNiches,
        linkTypePreferences: preferences.linkTypePreferences
      });
    } catch (error) {
      console.error(`Error processing website ${website.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Process all websites for a user
   */
  async processUserWebsites(userId: number): Promise<WebsiteProfile[]> {
    // Get user's websites
    const userWebsites = await db.select()
      .from(websites)
      .where(eq(websites.userId, userId));
    
    // Process each website
    const profiles: WebsiteProfile[] = [];
    for (const website of userWebsites) {
      try {
        const profile = await this.processWebsite(website);
        profiles.push(profile);
      } catch (error) {
        console.error(`Error processing website ${website.id}:`, error);
      }
    }
    
    return profiles;
  }
}

// Singleton instance
let analyzerInstance: WebsiteAnalyzer | null = null;

export function getWebsiteAnalyzer(): WebsiteAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new WebsiteAnalyzer();
  }
  return analyzerInstance;
}