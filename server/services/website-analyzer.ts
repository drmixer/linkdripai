import { db } from '../db';
import { websiteProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Website Analyzer Service
 * 
 * This service handles the analysis of user websites to generate
 * content profiles, keywords, topics, and relevance data used for matching.
 */
export class WebsiteAnalyzer {
  constructor() {
    console.log('[WebsiteAnalyzer] Initialized');
  }
  
  /**
   * Analyze a website and store content profile
   */
  async analyzeWebsite(websiteId: number, url: string): Promise<any> {
    console.log(`[WebsiteAnalyzer] Analyzing website: ${url}`);
    
    try {
      // Fetch website content
      const content = await this.fetchWebsiteContent(url);
      
      // Extract topics and keywords
      const { topics, keywords, metadata } = this.extractTopicsAndKeywords(content);
      
      // Create or update website profile
      const existingProfile = await db.select()
        .from(websiteProfiles)
        .where(eq(websiteProfiles.websiteId, websiteId))
        .limit(1);
      
      if (existingProfile.length > 0) {
        // Update existing profile
        await db.update(websiteProfiles)
          .set({
            content: content.slice(0, 5000), // Store truncated content
            topics,
            keywords,
            metadata,
            lastAnalyzed: new Date()
          })
          .where(eq(websiteProfiles.id, existingProfile[0].id));
        
        return {
          ...existingProfile[0],
          content: content.slice(0, 5000),
          topics,
          keywords,
          metadata,
          lastAnalyzed: new Date()
        };
      } else {
        // Create new profile
        const [newProfile] = await db.insert(websiteProfiles)
          .values({
            websiteId,
            content: content.slice(0, 5000),
            topics,
            keywords,
            metadata,
            lastAnalyzed: new Date()
          })
          .returning();
        
        return newProfile;
      }
    } catch (error) {
      console.error(`[WebsiteAnalyzer] Error analyzing website ${url}:`, error);
      throw new Error(`Failed to analyze website: ${error.message}`);
    }
  }
  
  /**
   * Fetch website content
   */
  private async fetchWebsiteContent(url: string): Promise<string> {
    try {
      // Ensure URL has protocol
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      
      const response = await axios.get(normalizedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkDripAI/1.0; +https://linkdripai.com/bot)'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error(`[WebsiteAnalyzer] Error fetching content for ${url}:`, error);
      throw new Error(`Failed to fetch website content: ${error.message}`);
    }
  }
  
  /**
   * Extract topics and keywords from content
   */
  private extractTopicsAndKeywords(content: string): { 
    topics: string[];
    keywords: string[];
    metadata: any;
  } {
    try {
      const $ = cheerio.load(content);
      
      // Extract text content and normalize
      const textContent = $('body').text().trim().toLowerCase();
      
      // Remove script and style elements
      $('script, style').remove();
      
      // Get metadata
      const metadata = {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        h1: $('h1').first().text().trim(),
        wordCount: textContent.split(/\s+/).length
      };
      
      // Simple keyword extraction - in a real system, use NLP or keyword extraction API
      const words = textContent
        .replace(/[^\w\s]/gi, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .reduce((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {});
      
      // Get top keywords by frequency
      const keywords = Object.entries(words)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([word]) => word);
      
      // Simplified topic extraction based on heading elements
      const topics = [];
      $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (text && text.length > 3 && topics.length < 15) {
          topics.push(text);
        }
      });
      
      return {
        topics: [...new Set(topics)],
        keywords,
        metadata
      };
    } catch (error) {
      console.error('[WebsiteAnalyzer] Error extracting topics:', error);
      return {
        topics: [],
        keywords: [],
        metadata: { title: '', description: '', h1: '', wordCount: 0 }
      };
    }
  }
  
  /**
   * Calculate relevance between a website profile and opportunity
   */
  calculateRelevance(websiteProfile: any, opportunity: any): number {
    // In a real system, use a more sophisticated algorithm with TF-IDF, cosine similarity, etc.
    if (!websiteProfile || !opportunity) {
      return 0;
    }
    
    try {
      const websiteKeywords = new Set(websiteProfile.keywords || []);
      const opportunityContent = opportunity.pageContent || '';
      
      // Count matching keywords
      let matchCount = 0;
      
      websiteKeywords.forEach(keyword => {
        if (opportunityContent.toLowerCase().includes(keyword.toLowerCase())) {
          matchCount++;
        }
      });
      
      // Calculate relevance score (0-100)
      const relevanceScore = Math.min(
        100,
        Math.round((matchCount / Math.max(1, websiteKeywords.size)) * 100)
      );
      
      return relevanceScore;
    } catch (error) {
      console.error('[WebsiteAnalyzer] Error calculating relevance:', error);
      return 30; // Default fallback score
    }
  }
}

let websiteAnalyzer: WebsiteAnalyzer | null = null;

export function getWebsiteAnalyzer(): WebsiteAnalyzer {
  if (!websiteAnalyzer) {
    websiteAnalyzer = new WebsiteAnalyzer();
  }
  
  return websiteAnalyzer;
}