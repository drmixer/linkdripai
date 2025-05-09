import { Website, WebsiteProfile, websites, websiteProfiles } from '@shared/schema';
import { db } from '../db';
import { getMozApiService } from './moz';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Website Analyzer Service
 * 
 * This service analyzes user websites to create profiles that can be used
 * for matching with backlink opportunities.
 */
export class WebsiteAnalyzer {
  private mozService = getMozApiService();

  /**
   * Get the profile for a website
   */
  async getProfile(websiteId: number): Promise<WebsiteProfile | null> {
    try {
      const [profile] = await db.select()
        .from(websiteProfiles)
        .where(eq(websiteProfiles.websiteId, websiteId));
      
      return profile || null;
    } catch (error) {
      console.error('Error getting website profile:', error);
      return null;
    }
  }

  /**
   * Process a website to create or update its profile
   */
  async processWebsite(website: Website): Promise<WebsiteProfile> {
    try {
      console.log(`[Analyzer] Processing website: ${website.url}`);
      
      // Get existing profile if any
      const [existingProfile] = await db.select()
        .from(websiteProfiles)
        .where(eq(websiteProfiles.websiteId, website.id));
      
      // Get domain information from Moz
      const domain = this.extractDomain(website.url);
      const mozData = await this.mozService.getDomainMetrics(domain);
      
      // Analyze content to extract keywords and topics
      const { keywords, categories } = await this.analyzeContent(website.url);
      
      // Create or update profile
      if (existingProfile) {
        // Update existing profile
        const [updatedProfile] = await db.update(websiteProfiles)
          .set({
            domainAuthority: mozData.domain_authority,
            pageAuthority: mozData.page_authority,
            spamScore: mozData.spam_score,
            backlinks: mozData.root_domains_to_root_domain,
            lastUpdated: new Date(),
            keywords,
            categories,
            contentSample: '',
          })
          .where(eq(websiteProfiles.id, existingProfile.id))
          .returning();
        
        return updatedProfile;
      } else {
        // Create new profile
        const [newProfile] = await db.insert(websiteProfiles)
          .values({
            websiteId: website.id,
            userId: website.userId,
            domainAuthority: mozData.domain_authority,
            pageAuthority: mozData.page_authority,
            spamScore: mozData.spam_score,
            backlinks: mozData.root_domains_to_root_domain,
            lastUpdated: new Date(),
            keywords,
            categories,
            contentSample: '',
          })
          .returning();
        
        return newProfile;
      }
    } catch (error) {
      console.error('Error processing website:', error);
      throw new Error(`Failed to process website: ${error.message}`);
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname;
    } catch (error) {
      console.error('Error extracting domain:', error);
      return url;
    }
  }

  /**
   * Analyze website content to extract keywords and categories
   */
  private async analyzeContent(url: string): Promise<{ keywords: string[], categories: string[] }> {
    try {
      // Fetch the URL content
      const response = await axios.get(url.startsWith('http') ? url : `https://${url}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      
      const html = response.data;
      const $ = cheerio.load(html);
      
      // Extract text content from main content areas
      const contentText = $('article, main, .content, #content, .post, .entry, .main')
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      
      // If no specific content area, use body text excluding navigation and footer
      const bodyText = contentText || $('body')
        .clone()
        .find('nav, header, footer, script, style')
        .remove()
        .end()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      
      // Extract keywords from meta tags
      const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
      const metaDescription = $('meta[name="description"]').attr('content') || '';
      
      // Get all headings
      const headings = $('h1, h2, h3')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(heading => heading.length > 0);
      
      // Extract categories from URL path and classes
      const pathSegments = new URL(url.startsWith('http') ? url : `https://${url}`).pathname
        .split('/')
        .filter(segment => segment.length > 0);
      
      const categoryClasses = $('.category, .categories, .tag, .tags')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(category => category.length > 0);
      
      // Process keywords - from meta, headings, and content
      const keywordSources = [
        ...metaKeywords.split(',').map(k => k.trim()),
        ...headings,
        ...bodyText.split(' ')
          .filter(word => word.length > 4)
          .slice(0, 100),
        ...metaDescription.split(' ').filter(word => word.length > 4),
      ];
      
      // Count keyword frequency
      const keywordCounts = new Map<string, number>();
      for (const word of keywordSources) {
        const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalized.length > 3) {
          keywordCounts.set(normalized, (keywordCounts.get(normalized) || 0) + 1);
        }
      }
      
      // Get top keywords
      const topKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([keyword]) => keyword);
      
      // Combine categories from multiple sources
      const categories = Array.from(new Set([
        ...pathSegments,
        ...categoryClasses,
      ])).slice(0, 10);
      
      return {
        keywords: topKeywords,
        categories,
      };
    } catch (error) {
      console.error('Error analyzing content:', error);
      return {
        keywords: [],
        categories: [],
      };
    }
  }

  /**
   * Analyze websites for a specific user
   */
  async analyzeUserWebsites(userId: number): Promise<number> {
    try {
      // Get all user's websites
      const userWebsites = await db.select()
        .from(websites)
        .where(eq(websites.userId, userId));
      
      let processedCount = 0;
      
      // Process each website
      for (const website of userWebsites) {
        await this.processWebsite(website);
        processedCount++;
      }
      
      return processedCount;
    } catch (error) {
      console.error('Error analyzing user websites:', error);
      return 0;
    }
  }
}

// Create a singleton instance
let websiteAnalyzer: WebsiteAnalyzer | null = null;

export function getWebsiteAnalyzer(): WebsiteAnalyzer {
  if (!websiteAnalyzer) {
    websiteAnalyzer = new WebsiteAnalyzer();
  }
  
  return websiteAnalyzer;
}