import { CrawlerJob, DiscoveredOpportunity } from '@shared/schema';
import { db } from '../db';
import { eq, inArray, sql } from 'drizzle-orm';
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
    resource_page: [
      'resources',
      'links',
      'useful-links',
      'helpful-resources',
      'recommended',
      'tools',
      'resources-links',
      'best-resources',
      'seo-resources',
      'marketing-resources',
      'digital-resources',
      'favorite-tools',
      'recommended-tools',
      'essential-resources',
      'industry-resources',
      'learning-resources',
    ],
    guest_post: [
      'write-for-us',
      'guest-post',
      'contribute',
      'contributors',
      'submit-article',
      'submission-guidelines',
      'write-with-us',
      'become-contributor',
      'guest-blogging',
      'article-submission',
      'content-contribution',
      'contributor-guidelines',
      'guest-authors',
      'write-an-article',
      'publish-with-us',
      'guest-posting-guidelines',
    ],
    directory: [
      'directory',
      'listings',
      'businesses',
      'sites',
      'catalog',
      'web-directory',
      'business-directory',
      'site-directory',
      'company-listings',
      'agency-directory',
      'industry-directory',
      'service-directory',
      'local-listings',
      'business-listings',
      'website-directory',
    ],
    forum: [
      'forum',
      'community',
      'discussions',
      'board',
      'message-board',
      'discussion-forum',
      'community-forum',
      'user-forum',
      'question-answer',
      'q-and-a',
      'support-forum',
      'help-forum',
      'discussion-group',
      'discussion-threads',
      'community-discussions',
    ],
    blog: [
      'blog',
      'article',
      'news',
      'posts',
      'stories',
      'insights',
      'blog-posts',
      'latest-articles',
      'industry-news',
      'featured-articles',
      'trending',
      'content-hub',
      'resource-center',
      'knowledge-base',
      'guides',
      'tutorials',
    ],
    competitor_backlink: [
      'backlinks',
      'links',
      'referrals',
      'referring-domains',
      'link-profile',
      'backlink-analysis',
      'external-links',
      'inbound-links',
      'dofollow-links',
      'quality-links',
      'authority-links',
      'backlink-sources',
      'top-backlinks',
      'backlink-opportunities',
      'link-building',
    ],
    social_mention: [
      'mentions',
      'social',
      'share',
      'shares',
      'social-mentions',
      'brand-mentions',
      'online-mentions',
      'social-media-mentions',
      'social-sharing',
      'social-profiles',
      'social-signals',
      'share-buttons',
      'twitter-mentions',
      'facebook-mentions',
      'linkedin-mentions',
    ],
    comment_section: [
      'comments',
      'responses',
      'discussion',
      'feedback',
      'comment-section',
      'user-comments',
      'article-comments',
      'blog-comments',
      'leave-comment',
      'join-discussion',
      'comments-section',
      'discussion-area',
      'reader-comments',
      'community-feedback',
      'discussion-thread',
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
   * Crawl a specific URL to identify if it contains backlink opportunities
   * @param url The URL to crawl
   * @param depth Current depth in the crawl process
   * @param maxDepth Maximum depth to crawl (default: 2)
   */
  async crawlUrl(url: string, depth = 0, maxDepth = 2): Promise<any> {
    console.log(`[Crawler] Crawling ${url} (depth: ${depth})`);
    
    // Stop if we've reached maximum depth
    if (depth > maxDepth) {
      return {
        status: 'skipped',
        url,
        message: 'Maximum depth reached'
      };
    }
    
    // Make sure URL is properly formatted
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    try {
      // Random delay between 1-3 seconds to avoid rate limiting
      const randomDelay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      // Use fetch with a random user agent for each request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(formattedUrl, {
        headers: {
          'User-Agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        return { 
          status: 'error',
          url, 
          error: `HTTP error: ${response.status}` 
        };
      }
      
      // Get the HTML content
      const html = await response.text();
      
      // Use cheerio to parse the HTML
      const $ = cheerio.load(html);
      
      // Extract page title - try multiple ways to get the most accurate title
      let title = $('title').text().trim();
      if (!title || title.length < 5) {
        // If no title or very short title, try h1
        title = $('h1').first().text().trim() || title;
      }
      
      // Extract meta description
      let metaDescription = $('meta[name="description"]').attr('content') || '';
      // Try Open Graph description if no meta description
      if (!metaDescription) {
        metaDescription = $('meta[property="og:description"]').attr('content') || '';
      }
      
      // Check for contact links (more comprehensive approach)
      const contactSelectors = [
        'a[href*="contact"]', 
        'a[href*="about"]', 
        'a:contains("Contact")', 
        'a:contains("About")',
        'a[href*="reach-us"]',
        'a[href*="reach-out"]',
        'a[href*="get-in-touch"]',
        'form[action*="contact"]',
        'input[name*="email"]',
        'textarea'
      ];
      
      let hasContactForm = false;
      for (const selector of contactSelectors) {
        const elements = $(selector).length;
        if (elements > 0) {
          hasContactForm = true;
          break;
        }
      }
      
      // Extract page text with better noise filtering
      // Remove script, style, and common footer/header elements
      $('script, style, nav, footer, .footer, .header, .nav, .menu, .sidebar').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const lowerBodyText = bodyText.toLowerCase();
      
      // Check for email addresses (improved regex)
      const emailRegex = /[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,125}[a-zA-Z]{2,63}/g;
      const tempEmails = bodyText.match(emailRegex) || [];
      
      // Filter out common false positives and limit to reasonable number
      const emails = tempEmails
        .filter(email => !email.includes('example.com') && !email.includes('domain.com') && !email.startsWith('email@'))
        .slice(0, 5); // Limit to 5 emails
      
      // Check URL path for opportunity type indicators
      const urlObj = new URL(formattedUrl);
      const urlPath = urlObj.pathname.toLowerCase();
      const urlQuery = urlObj.search.toLowerCase();
      const fullUrl = formattedUrl.toLowerCase();
      
      // Default to blog as it's a valid enum value
      let opportunityType = 'blog';
      
      // Weighted pattern matching
      const typeWeights: Record<string, number> = {
        resource_page: 0,
        guest_post: 0,
        directory: 0,
        forum: 0,
        blog: 0,
        competitor_backlink: 0,
        social_mention: 0,
        comment_section: 0
      };
      
      // Check URL patterns first (stronger signal)
      for (const [type, patterns] of Object.entries(this.targetPatterns)) {
        for (const pattern of patterns) {
          if (urlPath.includes(pattern) || urlQuery.includes(pattern)) {
            typeWeights[type] += 2; // URL match is a strong signal
          }
        }
      }
      
      // Check for guest post indicators in content (comprehensive)
      const guestPostTerms = [
        'guest post', 'write for us', 'submit article', 'submission guidelines',
        'guest author', 'guest contributor', 'contribute to', 'become a contributor',
        'guest blogging', 'accept guest posts', 'contribution guidelines',
        'submit a guest post', 'submit content', 'write for', 'contribute an article'
      ];
      
      for (const term of guestPostTerms) {
        if (lowerBodyText.includes(term)) {
          typeWeights['guest_post'] += 1;
        }
      }
      
      // Look for specific guest post sections
      if ($('h1, h2, h3, h4').text().toLowerCase().match(/guest|contributor|write for|submit/)) {
        typeWeights['guest_post'] += 2;
      }
      
      // Check for resource page indicators (comprehensive)
      const resourceTerms = [
        'resources', 'useful links', 'helpful links', 'recommended', 'tools',
        'recommended resources', 'resource list', 'useful resources', 'best resources',
        'helpful resources', 'resource library', 'resource center', 'resource hub',
        'useful tools', 'helpful tools', 'recommended tools', 'best tools'
      ];
      
      for (const term of resourceTerms) {
        if (lowerBodyText.includes(term)) {
          typeWeights['resource_page'] += 1;
        }
      }
      
      // Count external links - many external links often indicate a resource page
      const externalLinksCount = $('a[href^="http"]').length;
      if (externalLinksCount > 20) {
        typeWeights['resource_page'] += 2;
      }
      
      // Check if this is a resource page based on content and link count
      const isResourcePage = (typeWeights['resource_page'] >= 2) || 
                           (lowerBodyText.includes('resources') && externalLinksCount > 15);
      
      // Check for directory indicators
      const directoryTerms = [
        'directory', 'listings', 'businesses', 'sites', 'catalog', 
        'business directory', 'find a', 'browse by', 'listing', 'listings',
        'companies', 'providers', 'agencies', 'services'
      ];
      
      for (const term of directoryTerms) {
        if (lowerBodyText.includes(term)) {
          typeWeights['directory'] += 1;
        }
      }
      
      // Check for forum indicators
      const forumTerms = [
        'forum', 'community', 'discussion', 'thread', 'post a reply',
        'join the conversation', 'discussion board', 'message board',
        'members', 'replies', 'posts'
      ];
      
      for (const term of forumTerms) {
        if (lowerBodyText.includes(term)) {
          typeWeights['forum'] += 1;
        }
      }
      
      // If the page has a commenting system, it might be good for comment section outreach
      if ($('form[id*="comment"], div[id*="comment"], section[id*="comment"]').length > 0) {
        typeWeights['comment_section'] += 2;
      }
      
      // Determine the highest weighted opportunity type
      let highestWeight = 0;
      for (const [type, weight] of Object.entries(typeWeights)) {
        if (weight > highestWeight) {
          highestWeight = weight;
          opportunityType = type;
        }
      }
      
      // Special case for resource pages - they're particularly valuable
      if (isResourcePage && opportunityType === 'blog') {
        opportunityType = 'resource_page';
      }
      
      // Extract niche/category info (many ways to find the page's category)
      const categoryElements = $('.category, .categories, .tag, .tags, [class*="category"], [class*="tag"]').toArray();
      const categories = categoryElements.map(el => $(el).text().trim()).filter(Boolean);
      
      // Try to extract topics from headings
      const headings = $('h1, h2, h3').map((_, el) => $(el).text().trim()).get();
      
      // Check meta keywords
      const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
      const keywordsList = metaKeywords ? metaKeywords.split(',').map(k => k.trim()) : [];
      
      // Also check Open Graph tags for topics
      const ogTags = $('meta[property^="og:"]').map((_, el) => $(el).attr('content') || '').get();
      
      // Combine all sources and deduplicate
      const allCategories = [...categories, ...headings, ...keywordsList, ...ogTags];
      const uniqueCategories = Array.from(new Set(allCategories.filter(Boolean)));
      
      // If we haven't reached max depth, collect additional URLs to crawl
      let linksToFollow: string[] = [];
      
      if (depth < maxDepth) {
        // Get all links with improved pattern matching
        const allPatterns = Object.values(this.targetPatterns).flat();
        
        // Extract all links
        const links = $('a[href]').map((_, el) => ({
          href: $(el).attr('href') || '',
          text: $(el).text().trim()
        })).get();
        
        // Prioritize links based on their content and patterns
        for (const link of links) {
          if (!link.href) continue;
          
          try {
            // Make sure it's a full URL
            const fullUrl = link.href.startsWith('http') ? link.href : new URL(link.href, formattedUrl).toString();
            const linkUrl = new URL(fullUrl);
            
            // Skip external links, image files, PDFs, and already seen URLs
            if (linkUrl.hostname !== urlObj.hostname || 
                /\.(jpg|jpeg|png|gif|pdf)$/i.test(linkUrl.pathname)) {
              continue;
            }
            
            // Higher priority if the link text contains target patterns
            const linkTextLower = link.text.toLowerCase();
            const pathLower = linkUrl.pathname.toLowerCase();
            
            // Calculate a relevance score for each link to prioritize the most promising ones
            let relevanceScore = 0;
            
            // Path matches any target pattern
            if (allPatterns.some(pattern => pathLower.includes(pattern))) {
              relevanceScore += 3;
            }
            
            // Link text suggests useful content
            if (/resources|directory|blog|guest post|about|contact/i.test(linkTextLower)) {
              relevanceScore += 2;
            }
            
            // Priority to deeper paths as they tend to be more specific
            relevanceScore += (linkUrl.pathname.split('/').length - 1) / 2; // 0.5 per level
            
            // Skip links with query parameters that look like paging or sorting
            if (linkUrl.search.match(/[?&](page|p|sort|filter|s|q)=/)) {
              relevanceScore -= 1;
            }
            
            // Add relevant links
            if (relevanceScore > 0) {
              linksToFollow.push(fullUrl);
            }
          } catch {
            // Invalid URL, skip
          }
        }
        
        // Sort links by unique hostname + path to avoid duplicates with minor differences
        const uniqueLinks = new Map<string, string>();
        linksToFollow.forEach(url => {
          try {
            const urlObj = new URL(url);
            const key = urlObj.hostname + urlObj.pathname.replace(/\/$/, '');
            uniqueLinks.set(key, url);
          } catch {
            // Skip invalid URLs
          }
        });
        
        // Get the final list of links to follow
        linksToFollow = Array.from(uniqueLinks.values());
      }
      
      // Determine relevance score for the opportunity
      const relevanceScore = (() => {
        let score = 0;
        
        // Quality signals
        if (title && title.length > 10) score += 1;
        if (metaDescription && metaDescription.length > 30) score += 1;
        if (emails.length > 0) score += 2;
        if (hasContactForm) score += 1;
        if (opportunityType === 'resource_page') score += 2;
        if (opportunityType === 'guest_post') score += 2;
        if (uniqueCategories.length > 2) score += 1;
        
        // Content quality
        const wordCount = bodyText.split(/\s+/).length;
        if (wordCount > 500) score += 1;
        if (wordCount > 1000) score += 1;
        
        return Math.min(10, score); // Cap at 10
      })();
      
      // Extract a useful summary from the content
      const contentSummary = (() => {
        // Find the most informative paragraphs
        const paragraphs: string[] = [];
        
        // Try different selectors to find good content blocks
        const contentSelectors = [
          'p', 'article p', '.content p', '.post-content p', 
          '.entry-content p', 'main p', '.main-content p'
        ];
        
        for (const selector of contentSelectors) {
          const elements = $(selector).filter((_, el) => {
            const text = $(el).text().trim();
            return text.length > 60 && text.split(' ').length > 10; // Only meaningful paragraphs
          }).slice(0, 3);
          
          if (elements.length > 0) {
            elements.each((_, el) => {
              paragraphs.push($(el).text().trim());
            });
            
            if (paragraphs.length >= 2) break; // Found enough content
          }
        }
        
        // If we couldn't extract structured paragraphs, fall back to full text
        if (paragraphs.length === 0) {
          return bodyText.substring(0, 1000);
        }
        
        return paragraphs.join('\n\n').substring(0, 1000);
      })();
      
      // Return the results with enhanced metadata
      return {
        status: 'success',
        url: formattedUrl,
        title,
        description: metaDescription,
        emails,
        hasContactForm,
        opportunityType,
        categories: uniqueCategories,
        content: contentSummary,
        relevanceScore,
        linksToFollow: linksToFollow.slice(0, Math.min(10, linksToFollow.length)), // Allow up to 10 links for higher quality pages
        crawlDate: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
      
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
                status: 'analyzed',
                domainAuthority: Math.round(metrics.domain_authority || 0),
                pageAuthority: Math.round(metrics.page_authority || 0),
                spamScore: Math.round((metrics.spam_score || 0) * 10), // Scale to 0-10 integer range
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
   * @param type The opportunity type to crawl for
   * @param startUrls Array of seed URLs to start crawling from
   * @param maxCrawlDepth Maximum crawl depth (default: 2)
   */
  async startDiscoveryCrawl(type: string, startUrls: string[], maxCrawlDepth: number = 2): Promise<CrawlerJob> {
    // Initialize the job
    const job = await this.initializeJob(type, startUrls.join(','));
    
    // Start crawling in background (non-blocking)
    setTimeout(async () => {
      try {
        // Update status to in progress
        await this.updateJobStatus(job.id, 'in_progress');
        
        console.log(`[Crawler] Starting discovery crawl for type ${type} with max depth ${maxCrawlDepth}`);
        
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
            // Use the specified max crawl depth
            const result = await this.crawlUrl(url, 0, maxCrawlDepth);
            
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
  
  /**
   * Start continuous discovery
   * Runs crawls on regular intervals and refreshes existing opportunities
   */
  startContinuousDiscovery(intervalMinutes = 60) {
    if (this.continuousCrawlRunning) {
      console.log('[Crawler] Continuous discovery is already running');
      return;
    }
    
    console.log(`[Crawler] Starting continuous discovery, running every ${intervalMinutes} minutes`);
    this.continuousCrawlRunning = true;
    
    // Run immediately
    this.runContinuousCrawlCycle();
    
    // Schedule future runs
    const intervalMs = intervalMinutes * 60 * 1000;
    this.continuousIntervalId = setInterval(() => {
      this.runContinuousCrawlCycle();
    }, intervalMs);
    
    // Also start opportunity refreshing
    this.startOpportunityRefreshing();
  }
  
  /**
   * Stop continuous discovery
   */
  stopContinuousDiscovery() {
    console.log('[Crawler] Stopping continuous discovery');
    this.continuousCrawlRunning = false;
    
    if (this.continuousIntervalId) {
      clearInterval(this.continuousIntervalId);
      this.continuousIntervalId = null;
    }
    
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }
  
  /**
   * Run one cycle of continuous crawling
   * This selects crawl types and seed URLs strategically to maximize quality opportunities
   */
  private async runContinuousCrawlCycle() {
    try {
      console.log('[Crawler] Running continuous crawl cycle');
      
      // Get current hour to determine crawl strategy
      const currentHour = new Date().getHours();
      
      // Define crawl strategies based on time of day
      // Early/late hours: Focus on high-authority sites (resource pages, blogs)
      // Mid-day hours: Focus on guest posts and directories
      // Afternoon: Focus on forums and social mentions
      let primaryTypes: string[] = [];
      let secondaryTypes: string[] = [];
      
      if (currentHour >= 0 && currentHour < 8) {
        // Early morning: Focus on resource pages and blogs
        primaryTypes = ['resource_page', 'blog'];
        secondaryTypes = ['guest_post', 'directory'];
      } else if (currentHour >= 8 && currentHour < 14) {
        // Mid-day: Focus on guest posts and directories
        primaryTypes = ['guest_post', 'directory'];
        secondaryTypes = ['competitor_backlink', 'forum'];
      } else if (currentHour >= 14 && currentHour < 20) {
        // Afternoon: Focus on forums and social mentions
        primaryTypes = ['forum', 'social_mention'];
        secondaryTypes = ['comment_section', 'blog'];
      } else {
        // Evening: Focus on competitor backlinks and comment sections
        primaryTypes = ['competitor_backlink', 'comment_section'];
        secondaryTypes = ['resource_page', 'guest_post'];
      }
      
      // Determine number of types to crawl (2-3 types)
      const numTypesToCrawl = Math.floor(Math.random() * 2) + 2;
      const typesToCrawl = [];
      
      // Always include at least one primary type
      const primaryType = primaryTypes[Math.floor(Math.random() * primaryTypes.length)];
      typesToCrawl.push(primaryType);
      
      // Add secondary types to complete the selection
      const remainingTypes = [...secondaryTypes];
      for (let i = 1; i < numTypesToCrawl; i++) {
        if (remainingTypes.length === 0) break;
        
        const randomIndex = Math.floor(Math.random() * remainingTypes.length);
        typesToCrawl.push(remainingTypes[randomIndex]);
        remainingTypes.splice(randomIndex, 1);
      }
      
      console.log(`[Crawler] Selected crawl types for this cycle: ${typesToCrawl.join(', ')}`);
      
      // For each type, run a crawl job with randomized seed URLs
      for (const type of typesToCrawl) {
        // Get all seed URLs for this type
        const allSeedUrls = this.getSeedUrlsForType(type);
        
        if (allSeedUrls.length > 0) {
          // Select a random subset of seed URLs to avoid hitting the same URLs repeatedly
          // and to distribute the load
          const numUrlsToUse = Math.min(5, allSeedUrls.length);
          const seedUrls = [];
          
          // Create a copy of the array to sample from
          const availableUrls = [...allSeedUrls];
          
          for (let i = 0; i < numUrlsToUse; i++) {
            if (availableUrls.length === 0) break;
            
            const randomIndex = Math.floor(Math.random() * availableUrls.length);
            seedUrls.push(availableUrls[randomIndex]);
            availableUrls.splice(randomIndex, 1);
          }
          
          console.log(`[Crawler] Starting crawl for type: ${type} with ${seedUrls.length} seed URLs`);
          await this.startDiscoveryCrawl(type, seedUrls);
          
          // Add a variable delay between crawl jobs to avoid predictable patterns
          // and to be more respectful to servers
          const variableDelay = this.crawlDelay + (Math.random() * 5000);
          await new Promise(resolve => setTimeout(resolve, variableDelay));
        }
      }
      
      // Occasionally run a full depth crawl on high-value opportunity types
      if (Math.random() < 0.2) {  // 20% chance
        const highValueType = Math.random() < 0.5 ? 'guest_post' : 'resource_page';
        const highValueSeeds = this.getSeedUrlsForType(highValueType).slice(0, 3);
        
        if (highValueSeeds.length > 0) {
          console.log(`[Crawler] Running deep crawl for high-value ${highValueType} opportunities`);
          // When crawling high-value opportunities, we want to go deeper
          await this.startDiscoveryCrawl(highValueType, highValueSeeds, 3);  // Deeper crawl depth
        }
      }
    } catch (error) {
      console.error('[Crawler] Error in continuous crawl cycle:', error);
    }
  }
  
  /**
   * Get seed URLs for a specific crawl type
   */
  private getSeedUrlsForType(type: string): string[] {
    // Comprehensive seed URLs for each opportunity type
    const seedUrls: Record<string, string[]> = {
      resource_page: [
        // High DA SEO resource pages
        'https://ahrefs.com/blog/seo-resources/',
        'https://moz.com/learn/seo',
        'https://backlinko.com/seo-tools',
        'https://www.semrush.com/blog/resources/',
        'https://neilpatel.com/blog/seo-tools/',
        'https://www.searchenginejournal.com/category/seo/tools-seo/',
        'https://www.hubspot.com/resources',
        'https://www.wordstream.com/blog/resources',
        'https://buffer.com/resources/',
        
        // Marketing resources
        'https://www.marketo.com/resources/',
        'https://coschedule.com/marketing-resources',
        'https://www.marketingprofs.com/resources/',
        'https://contentmarketinginstitute.com/articles/',
        'https://backlinko.com/hub/seo/resources',
        
        // Industry-specific resource pages
        'https://www.convinceandconvert.com/resources/',
        'https://www.orbitmedia.com/blog/web-design-statistics/',
        'https://www.crazyegg.com/blog/resources/',
        'https://www.copyblogger.com/content-marketing-tools/',
        'https://blog.hootsuite.com/social-media-resources/',
        
        // Web development resources
        'https://css-tricks.com/guides/',
        'https://developer.mozilla.org/en-US/docs/Web/Guide',
        'https://www.smashingmagazine.com/guides/',
        'https://web.dev/learn/',
        'https://www.digitalocean.com/community/tutorials'
      ],
      directory: [
        // General business directories
        'https://botw.org/',
        'https://directorysearch.com/',
        'https://www.jasminedirectory.com/',
        'https://www.business.com/directory/',
        'https://www.jayde.com/',
        'https://www.chamberofcommerce.com/business-directory',
        'https://www.hotfrog.com/',
        'https://www.yelp.com/search',
        
        // Industry-specific directories
        'https://www.g2.com/categories/',
        'https://www.capterra.com/directories/',
        'https://clutch.co/directories',
        'https://www.goodfirms.co/',
        'https://www.sitejabber.com/',
        'https://www.sortlist.com/',
        
        // Local business directories
        'https://www.yellowpages.com/',
        'https://www.bbb.org/',
        'https://www.thomasnet.com/',
        'https://www.angi.com/',
        'https://www.tripadvisor.com/'
      ],
      guest_post: [
        // Marketing/SEO blogs that accept guest posts
        'https://www.searchenginejournal.com/contribute/',
        'https://www.convinceandconvert.com/write-for-us/',
        'https://www.entrepreneur.com/getpublished',
        'https://www.semrush.com/blog/contribute/',
        'https://contentmarketinginstitute.com/blog/contributor-guidelines/',
        'https://www.jeffbullas.com/submit-a-guest-post/',
        'https://blog.hubspot.com/submit-a-guest-post',
        
        // Social media and digital marketing
        'https://www.socialmediaexaminer.com/writers/',
        'https://www.business2community.com/become-a-contributor',
        'https://sproutsocial.com/insights/write-for-us/',
        'https://www.postplanner.com/write-for-us/',
        'https://www.digitalmarketer.com/blog/write-for-digitalmarketer/',
        
        // Technology and business
        'https://techcrunch.com/got-a-tip/',
        'https://mashable.com/submit/',
        'https://www.forbes.com/sites/quora/',
        'https://www.inc.com/help-and-feedback.html',
        'https://www.fastcompany.com/section/hit-the-ground-running',
        
        // Industry-specific guest post opportunities
        'https://www.addthis.com/academy/write-for-us/',
        'https://www.impactplus.com/write-for-us',
        'https://www.singlegrain.com/contact/',
        'https://neilpatel.com/write-for-neil/',
        'https://www.blogtyrant.com/write-for-us/'
      ],
      forum: [
        // SEO and marketing forums
        'https://forums.digitalpoint.com/',
        'https://www.webmasterworld.com/',
        'https://moz.com/community/q/',
        'https://community.semrush.com/',
        'https://www.warriorforum.com/',
        
        // Tech and startup communities
        'https://www.producthunt.com/',
        'https://growthhackers.com/posts',
        'https://indiehackers.com/groups/marketing',
        'https://www.indiehackers.com/group/content-marketing',
        'https://news.ycombinator.com/',
        
        // Social media discussion groups
        'https://www.reddit.com/r/SEO/',
        'https://www.reddit.com/r/marketing/',
        'https://www.reddit.com/r/content_marketing/',
        'https://www.reddit.com/r/Entrepreneur/',
        'https://www.reddit.com/r/smallbusiness/',
        
        // Q&A platforms
        'https://www.quora.com/topic/Search-Engine-Optimization-SEO',
        'https://www.quora.com/topic/Digital-Marketing',
        'https://stackoverflow.com/questions/tagged/seo',
        'https://webmasters.stackexchange.com/',
        'https://ahrefs.com/blog/haro/'
      ],
      blog: [
        // High DA SEO and marketing blogs
        'https://moz.com/blog',
        'https://ahrefs.com/blog',
        'https://www.semrush.com/blog/',
        'https://neilpatel.com/blog/',
        'https://searchengineland.com/',
        'https://www.searchenginejournal.com/category/seo/',
        'https://backlinko.com/blog',
        
        // Industry news and updates
        'https://www.seroundtable.com/',
        'https://www.gsqi.com/marketing-blog/',
        'https://www.thesempost.com/',
        'https://www.searchenginewatch.com/',
        'https://www.siegemedia.com/blog',
        
        // Content marketing blogs
        'https://www.copyblogger.com/',
        'https://www.animalz.co/blog/',
        'https://www.convinceandconvert.com/blog/',
        'https://contentmarketinginstitute.com/blog/',
        'https://www.orbitmedia.com/blog/',
        
        // Growth and analytics
        'https://www.crazyegg.com/blog/',
        'https://www.growthmachine.com/blog',
        'https://growthhackers.com/posts',
        'https://blog.kissmetrics.com/',
        'https://www.matthewwoodward.co.uk/blog/'
      ],
      competitor_backlink: [
        // Backlink analysis tools
        'https://ahrefs.com/backlink-checker',
        'https://moz.com/link-explorer',
        'https://majestic.com/',
        'https://www.semrush.com/analytics/backlinks/',
        'https://neilpatel.com/backlinks/',
        'https://app.linkresearchtools.com/toolkit/quickbacklinks.php',
        'https://cognitiveseo.com/backlink-checker/',
        
        // Link building resources
        'https://backlinko.com/link-building',
        'https://www.linkody.com/',
        'https://www.buzzstream.com/',
        'https://www.linkresearchtools.com/',
        'https://www.screamingfrog.co.uk/seo-spider/',
        
        // Competitor analysis tools
        'https://www.spyfu.com/',
        'https://serpstat.com/',
        'https://www.similarweb.com/',
        'https://moz.com/explorer',
        'https://ubersuggest.com/user/sites'
      ],
      social_mention: [
        // Major social platforms
        'https://twitter.com/search',
        'https://www.linkedin.com/feed/',
        'https://www.facebook.com/search/',
        'https://www.reddit.com/search/',
        'https://www.pinterest.com/search/',
        
        // Social mention monitoring
        'https://www.instagram.com/explore/',
        'https://www.quora.com/search',
        'https://medium.com/search',
        'https://www.tumblr.com/explore/',
        'https://www.tiktok.com/discover',
        
        // Industry-specific social platforms
        'https://www.producthunt.com/',
        'https://hashtagify.me/',
        'https://www.brandmentions.com/',
        'https://www.socialmention.com/',
        'https://mention.com/en/'
      ],
      comment_section: [
        // High-engagement blogs
        'https://moz.com/blog/',
        'https://backlinko.com/blog',
        'https://neilpatel.com/blog/',
        'https://searchengineland.com/',
        'https://www.searchenginejournal.com/',
        
        // Industry news with active comments
        'https://www.seroundtable.com/',
        'https://searchenginewatch.com/',
        'https://www.gsqi.com/marketing-blog/',
        'https://www.seoroundtable.com/',
        'https://www.webmasterworld.com/',
        
        // Marketing blogs with engagement
        'https://www.copyblogger.com/',
        'https://www.problogger.com/',
        'https://www.smartblogger.com/',
        'https://www.convinceandconvert.com/blog/',
        'https://www.socialmediaexaminer.com/blog/'
      ]
    };
    
    // Return seed URLs for the requested type, or empty array if none
    return seedUrls[type] || [];
  }
  
  /**
   * Start automatically refreshing opportunities
   * This updates metadata for existing opportunities
   */
  private startOpportunityRefreshing(intervalHours = 24) {
    console.log(`[Crawler] Starting opportunity refreshing, running every ${intervalHours} hours`);
    
    // Run immediately
    this.refreshOpportunities();
    
    // Schedule future runs
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.refreshIntervalId = setInterval(() => {
      this.refreshOpportunities();
    }, intervalMs);
  }
  
  /**
   * Refresh a batch of opportunities
   * Updates metadata and checks if they're still valid
   */
  private async refreshOpportunities() {
    try {
      console.log('[Crawler] Refreshing opportunities');
      
      // Get opportunities that haven't been checked recently
      // For this example, we'll refresh opportunities that haven't been checked in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const opportunities = await db.select()
        .from(discoveredOpportunities)
        .where(sql`(${discoveredOpportunities.lastChecked} IS NULL OR ${discoveredOpportunities.lastChecked} < ${sevenDaysAgo})`)
        .limit(25); // Process in batches to avoid overloading
      
      console.log(`[Crawler] Found ${opportunities.length} opportunities to refresh`);
      
      // Process each opportunity
      for (const opportunity of opportunities) {
        try {
          console.log(`[Crawler] Refreshing opportunity: ${opportunity.id} (${opportunity.url})`);
          
          // Update last checked timestamp
          await db.update(discoveredOpportunities)
            .set({ lastChecked: new Date() })
            .where(eq(discoveredOpportunities.id, opportunity.id));
          
          // Re-crawl the URL to verify it's still active
          const crawlResult = await this.crawlUrl(opportunity.url, 0, 0);
          
          if (crawlResult.status === 'error') {
            console.log(`[Crawler] Opportunity no longer available: ${opportunity.id} (${opportunity.url})`);
            
            // Mark as expired
            await db.update(discoveredOpportunities)
              .set({ 
                status: 'expired',
                // Store error in validationData since it's a JSON field
                validationData: { error: crawlResult.error }
              })
              .where(eq(discoveredOpportunities.id, opportunity.id));
              
            continue;
          }
          
          // Refresh Moz metrics
          const opportunityIds = [opportunity.id];
          await this.processDiscoveredBatch(opportunityIds);
          
          // Add a delay between requests
          await new Promise(resolve => setTimeout(resolve, this.crawlDelay));
        } catch (error) {
          console.error(`[Crawler] Error refreshing opportunity ${opportunity.id}:`, error);
        }
      }
      
      console.log('[Crawler] Opportunity refresh complete');
    } catch (error) {
      console.error('[Crawler] Error in opportunity refresh:', error);
    }
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