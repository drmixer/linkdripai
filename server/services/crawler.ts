import { CrawlerJob, DiscoveredOpportunity } from '@shared/schema';
import { db } from '../db';
import { eq, inArray } from 'drizzle-orm';
import { crawlerJobs, discoveredOpportunities } from '@shared/schema';
import { getMozApiService, MozApiService } from './moz';
import { getValidationPipeline } from './validation-pipeline';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

/**
 * Opportunity Crawler Service
 * 
 * This service handles the discovery of new backlink opportunities through web crawling.
 * It can crawl different types of targets:
 * 1. Resource pages
 * 2. Directories
 * 3. Blogs with guest post opportunities
 * 4. Forums
 * 5. Specific URLs from competitor backlinks
 * 
 * Features continuous discovery and automated refreshing of opportunities.
 */
export class OpportunityCrawler {
  private mozService: MozApiService;
  private continuousCrawlRunning: boolean = false;
  private continuousIntervalId: NodeJS.Timeout | null = null;
  private refreshIntervalId: NodeJS.Timeout | null = null;
  private crawlDelay = 5000; // 5 seconds between requests to be respectful
  
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0',
  ];
  
  private targetPatterns = {
    resourcePage: [
      'resources',
      'links',
      'useful-links',
      'helpful-resources',
      'recommended',
      'tools',
    ],
    guestPost: [
      'write-for-us',
      'guest-post',
      'contribute',
      'contributors',
      'submit-article',
      'submission-guidelines',
    ],
    directory: [
      'directory',
      'listings',
      'businesses',
      'sites',
      'catalog',
    ],
    forum: [
      'forum',
      'community',
      'discussions',
      'board',
    ],
  };
  
  constructor() {
    this.mozService = getMozApiService();
  }
  
  /**
   * Initialize a new crawler job
   */
  async initializeJob(jobType: string, targetUrl?: string): Promise<CrawlerJob> {
    const [job] = await db.insert(crawlerJobs).values({
      jobType: jobType,
      targetUrl,
      status: 'pending',
      startedAt: new Date(),
      completedAt: null,
      error: null,
      results: {},
    }).returning();
    
    return job;
  }
  
  /**
   * Update job status
   */
  async updateJobStatus(jobId: number, status: string, error?: string): Promise<CrawlerJob> {
    const updates: any = { status };
    
    if (status === 'in_progress') {
      updates.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }
    
    if (error) {
      updates.error = error;
    }
    
    const [updatedJob] = await db.update(crawlerJobs)
      .set(updates)
      .where(eq(crawlerJobs.id, jobId))
      .returning();
      
    return updatedJob;
  }
  
  /**
   * Record discovery results
   */
  async recordResults(jobId: number, results: any): Promise<CrawlerJob> {
    const [updatedJob] = await db.update(crawlerJobs)
      .set({ results })
      .where(eq(crawlerJobs.id, jobId))
      .returning();
      
    return updatedJob;
  }
  
  /**
   * Extract the domain from a URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname;
    } catch (error) {
      console.error(`Error extracting domain from ${url}:`, error);
      return '';
    }
  }
  
  /**
   * Store a discovered opportunity
   */
  async storeDiscoveredOpportunity(data: Omit<DiscoveredOpportunity, 'id' | 'discoveredAt' | 'lastChecked' | 'status'>): Promise<DiscoveredOpportunity> {
    try {
      // Extract domain if not provided
      let domain = data.domain;
      if (!domain) {
        domain = this.extractDomain(data.url);
      }
      
      // Check if URL already exists to avoid duplicates
      const existingOpps = await db.select()
        .from(discoveredOpportunities)
        .where(eq(discoveredOpportunities.url, data.url));
      
      if (existingOpps.length > 0) {
        // Update existing record instead of creating a new one
        const [updatedOpp] = await db.update(discoveredOpportunities)
          .set({ 
            lastChecked: new Date(),
            title: data.title || existingOpps[0].title,
            description: data.description || existingOpps[0].description,
            contactEmail: data.contactEmail || existingOpps[0].contactEmail,
            hasContactForm: data.hasContactForm,
            content: data.content || existingOpps[0].content,
            categories: data.categories || existingOpps[0].categories,
          })
          .where(eq(discoveredOpportunities.id, existingOpps[0].id))
          .returning();
          
        return updatedOpp;
      }
      
      // Insert new opportunity
      const [newOpp] = await db.insert(discoveredOpportunities)
        .values({
          ...data,
          domain,
          discoveredAt: new Date(),
          lastChecked: new Date(),
          status: 'discovered',
        })
        .returning();
        
      return newOpp;
    } catch (error) {
      console.error('Failed to store discovered opportunity:', error);
      throw error;
    }
  }
  
  /**
   * Crawl a specific URL using Puppeteer to identify if it contains backlink opportunities
   */
  async crawlUrl(url: string, depth = 0, maxDepth = 2): Promise<any> {
    console.log(`[Crawler] Crawling ${url} (depth: ${depth})`);
    
    const browser = await puppeteer.launch({
      headless: 'new', // Use "new" headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
    
    try {
      const page = await browser.newPage();
      
      // Set a random user agent
      await page.setUserAgent(this.userAgents[Math.floor(Math.random() * this.userAgents.length)]);
      
      // Set viewport size
      await page.setViewport({ width: 1280, height: 800 });
      
      // Set request timeout
      const pageTimeout = 30000; // 30 seconds
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: pageTimeout,
      });
      
      // Check response
      if (!response) {
        await browser.close();
        return { 
          status: 'error',
          url, 
          error: 'No response from server' 
        };
      }
      
      if (response.status() >= 400) {
        await browser.close();
        return { 
          status: 'error',
          url, 
          error: `HTTP error: ${response.status()}` 
        };
      }
      
      // Wait for page to fully load
      await page.waitForTimeout(2000);
      
      // Get page title
      const title = await page.title();
      
      // Get meta description
      const metaDescription = await page.evaluate(() => {
        const metaDesc = document.querySelector('meta[name="description"]');
        return metaDesc ? metaDesc.getAttribute('content') : '';
      });
      
      // Check for contact links
      const contactLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="contact"]'));
        return links.map(link => link.getAttribute('href'));
      });
      
      const hasContactForm = contactLinks.length > 0;
      
      // Extract all page text
      const bodyText = await page.evaluate(() => document.body.innerText);
      
      // Check for email addresses
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = bodyText.match(emailRegex) || [];
      
      // Check URL path for opportunity type indicators
      const urlPath = new URL(url).pathname.toLowerCase();
      let opportunityType = 'generic';
      
      for (const [type, patterns] of Object.entries(this.targetPatterns)) {
        if (patterns.some(pattern => urlPath.includes(pattern))) {
          opportunityType = type;
          break;
        }
      }
      
      // Check content for opportunity type indicators
      const pageContent = await page.content();
      const $ = cheerio.load(pageContent);
      
      // Check for guest post indicators
      const isGuestPost = bodyText.toLowerCase().includes('guest post') || 
                          bodyText.toLowerCase().includes('write for us') ||
                          bodyText.toLowerCase().includes('submit article') ||
                          bodyText.toLowerCase().includes('submission guidelines');
      
      if (isGuestPost) {
        opportunityType = 'guestPost';
      }
      
      // Check for resource page indicators
      const externalLinks = $('a[href^="http"]').length;
      const isResourcePage = bodyText.toLowerCase().includes('resources') || 
                             bodyText.toLowerCase().includes('useful links') ||
                             externalLinks > 20;
      
      if (isResourcePage && opportunityType === 'generic') {
        opportunityType = 'resourcePage';
      }
      
      // Extract niche/category info
      const categories = await page.evaluate(() => {
        // Check for category elements
        const categoryElements = Array.from(document.querySelectorAll('.category, .categories, .tag, .tags'));
        const categories = categoryElements.map(el => el.textContent?.trim()).filter(Boolean);
        
        // Check meta keywords
        const metaKeywords = document.querySelector('meta[name="keywords"]');
        const keywordsContent = metaKeywords ? metaKeywords.getAttribute('content') : '';
        const keywordsList = keywordsContent ? keywordsContent.split(',').map(k => k.trim()) : [];
        
        return [...new Set([...categories, ...keywordsList])];
      });
      
      // If we haven't reached max depth, collect additional URLs to crawl
      let linksToFollow = [];
      
      if (depth < maxDepth) {
        // Get internal links that might lead to opportunity pages
        linksToFollow = await page.evaluate((patterns) => {
          const allPatterns = [].concat(...Object.values(patterns));
          
          return Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.href)
            .filter(href => {
              try {
                const url = new URL(href);
                // Only follow internal links
                if (url.hostname !== window.location.hostname) return false;
                
                // Check if path matches any target pattern
                return allPatterns.some(pattern => url.pathname.toLowerCase().includes(pattern));
              } catch {
                return false;
              }
            });
        }, this.targetPatterns);
      }
      
      // Close the browser
      await browser.close();
      
      // Return the results
      return {
        status: 'success',
        url,
        title,
        description: metaDescription,
        emails,
        hasContactForm,
        opportunityType,
        categories,
        content: bodyText.substring(0, 1000),
        linksToFollow: linksToFollow.slice(0, 5),  // Limit to 5 links
      };
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      
      try {
        await browser.close();
      } catch {
        // Ignore browser close errors
      }
      
      return {
        status: 'error',
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Process a batch of discovered opportunities to enrich with Moz data
   */
  async processDiscoveredBatch(opportunityIds: number[] = []): Promise<void> {
    try {
      // If no specific IDs provided, get all unprocessed opportunities
      let opportunities;
      
      if (opportunityIds.length === 0) {
        opportunities = await db.select()
          .from(discoveredOpportunities)
          .where(eq(discoveredOpportunities.status, 'discovered'))
          .limit(50);
      } else {
        opportunities = await db.select()
          .from(discoveredOpportunities)
          .where(inArray(discoveredOpportunities.id, opportunityIds));
      }
      
      if (opportunities.length === 0) {
        console.log('[Crawler] No opportunities to process');
        return;
      }
      
      console.log(`[Crawler] Processing ${opportunities.length} opportunities with Moz API`);
      
      // Process in smaller batches to avoid API limits
      const batchSize = 10;
      
      for (let i = 0; i < opportunities.length; i += batchSize) {
        const batch = opportunities.slice(i, i + batchSize);
        const domains = batch.map(opp => opp.domain || this.extractDomain(opp.url));
        
        try {
          // Get Moz metrics for the batch
          const domainMetrics = await this.mozService.getBatchDomainMetrics(domains);
          
          // Update each opportunity with the metrics
          for (let j = 0; j < batch.length; j++) {
            const opp = batch[j];
            const metrics = domainMetrics[j] || {};
            
            // Update the opportunity with metrics
            await db.update(discoveredOpportunities)
              .set({ 
                status: 'processed',
                domainAuthority: metrics.domain_authority || 0,
                pageAuthority: metrics.page_authority || 0,
                spamScore: metrics.spam_score || 0,
                lastChecked: new Date(),
              })
              .where(eq(discoveredOpportunities.id, opp.id));
          }
        } catch (error) {
          console.error('Error processing opportunity batch with Moz API:', error);
        }
      }
    } catch (error) {
      console.error('Error in processDiscoveredBatch:', error);
    }
  }
  
  /**
   * Start a discovery crawl for a specific pattern/type
   */
  async startDiscoveryCrawl(type: string, startUrls: string[]): Promise<CrawlerJob> {
    // Initialize the job
    const job = await this.initializeJob(type, startUrls.join(','));
    
    // Start crawling in background (non-blocking)
    setTimeout(async () => {
      try {
        // Update status to in progress
        await this.updateJobStatus(job.id, 'in_progress');
        
        // Start the crawl
        const results = {
          crawled: 0,
          discovered: 0,
          errors: 0,
          details: [] as any[],
          opportunities: [] as any[],
        };
        
        // Keep track of URLs we've already visited
        const visitedUrls = new Set<string>();
        
        // Process each start URL
        for (const url of startUrls) {
          if (visitedUrls.has(url)) continue;
          visitedUrls.add(url);
          
          results.crawled++;
          
          try {
            const result = await this.crawlUrl(url, 0, 2);
            
            if (result.status === 'error') {
              results.errors++;
              results.details.push({
                url,
                error: result.error,
              });
              continue;
            }
            
            // If it's a valid opportunity, store it
            if (
              (type === 'all' || result.opportunityType === type) &&
              (result.emails.length > 0 || result.hasContactForm)
            ) {
              const opportunity = await this.storeDiscoveredOpportunity({
                url: result.url,
                domain: this.extractDomain(result.url),
                sourceType: result.opportunityType,
                title: result.title,
                description: result.description,
                contactEmail: result.emails[0] || null,
                hasContactForm: result.hasContactForm,
                content: result.content,
                categories: result.categories,
                domainAuthority: 0, // Will be updated by processDiscoveredBatch
                pageAuthority: 0,   // Will be updated by processDiscoveredBatch
                spamScore: 0,       // Will be updated by processDiscoveredBatch
              });
              
              results.discovered++;
              results.opportunities.push(opportunity);
            }
            
            // Process additional links if available
            if (result.linksToFollow && result.linksToFollow.length > 0) {
              for (const link of result.linksToFollow) {
                if (visitedUrls.has(link)) continue;
                visitedUrls.add(link);
                
                results.crawled++;
                
                const subResult = await this.crawlUrl(link, 1, 2);
                
                if (subResult.status === 'error') {
                  results.errors++;
                  results.details.push({
                    url: link,
                    error: subResult.error,
                  });
                  continue;
                }
                
                // If it's a valid opportunity, store it
                if (
                  (type === 'all' || subResult.opportunityType === type) &&
                  (subResult.emails.length > 0 || subResult.hasContactForm)
                ) {
                  const opportunity = await this.storeDiscoveredOpportunity({
                    url: subResult.url,
                    domain: this.extractDomain(subResult.url),
                    sourceType: subResult.opportunityType,
                    title: subResult.title,
                    description: subResult.description,
                    contactEmail: subResult.emails[0] || null,
                    hasContactForm: subResult.hasContactForm,
                    content: subResult.content,
                    categories: subResult.categories,
                    domainAuthority: 0,
                    pageAuthority: 0,
                    spamScore: 0,
                  });
                  
                  results.discovered++;
                  results.opportunities.push(opportunity);
                }
              }
            }
          } catch (error) {
            console.error(`Error processing ${url}:`, error);
            results.errors++;
            results.details.push({
              url,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        // Update job with results
        await this.recordResults(job.id, results);
        
        // Mark job as completed
        await this.updateJobStatus(job.id, 'completed');
        
        // Process opportunities with Moz data
        if (results.opportunities.length > 0) {
          const opportunityIds = results.opportunities.map(o => o.id);
          await this.processDiscoveredBatch(opportunityIds);
        }
        
        console.log(`[Crawler] Job ${job.id} completed: crawled ${results.crawled} URLs, discovered ${results.discovered} opportunities`);
      } catch (error) {
        // Handle errors
        console.error(`Error in crawler job ${job.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.updateJobStatus(job.id, 'failed', errorMessage);
      }
    }, 0);
    
    return job;
  }
}

// Singleton instance
let crawlerInstance: OpportunityCrawler | null = null;

export function getOpportunityCrawler(): OpportunityCrawler {
  if (!crawlerInstance) {
    crawlerInstance = new OpportunityCrawler();
  }
  return crawlerInstance;
}