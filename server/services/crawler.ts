import { CrawlerJob, DiscoveredOpportunity } from '@shared/schema';
import { db } from '../db';
import { eq, inArray, sql, and, or, isNull, lt, gt, ne } from 'drizzle-orm';
import { crawlerJobs, discoveredOpportunities } from '@shared/schema';
import { getMozApiService, MozApiService } from './moz';
import { getValidationPipeline } from './validation-pipeline';
import { getDomainValidationService } from './validation-service';
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
  private validationService = getDomainValidationService();
  private continuousCrawlRunning: boolean = false;
  private continuousIntervalId: NodeJS.Timeout | null = null;
  private refreshIntervalId: NodeJS.Timeout | null = null;
  private crawlDelay = 1500; // 1.5 seconds between requests (further optimized from 2s)
  private maxConcurrentRequests = 8; // Allow up to 8 concurrent requests
  private activeCrawls = 0; // Track number of active crawls
  private domainThrottleMap: Record<string, Record<string, number>> = {}; // Track domain throttling by service
  
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
      
      // Process categories - ensure it's a valid format for storage
      // We need to convert arrays to strings for storage if needed
      let processedCategories = data.categories;
      if (Array.isArray(processedCategories)) {
        // Limit to 10 categories max, and each to 30 chars max to keep data manageable
        processedCategories = processedCategories
          .filter(Boolean)
          .map(cat => String(cat).substring(0, 30))
          .slice(0, 10);
      }
      
      // Process metadata - store any additional fields
      const metadataObj: Record<string, any> = {
        crawlDate: new Date().toISOString(),
        relevanceScore: data.relevanceScore || 0
      };
      
      if (typeof data.metadataRaw === 'string' && data.metadataRaw) {
        try {
          const existingMetadata = JSON.parse(data.metadataRaw);
          Object.assign(metadataObj, existingMetadata);
        } catch {
          // Invalid JSON, ignore existing metadata
        }
      }
      
      // Create proper contact information JSON structure
      const contactInfoObj: Record<string, any> = {};
      
      // Add primary email if available
      if (data.contactEmail) {
        contactInfoObj.email = data.contactEmail;
      }
      
      // Check for additional emails in metadata
      if (metadataObj.allEmails && Array.isArray(metadataObj.allEmails) && metadataObj.allEmails.length > 0) {
        contactInfoObj.additionalEmails = metadataObj.allEmails.filter(email => email !== data.contactEmail);
      }
      
      // Check for contact form
      if (data.hasContactForm && data.url) {
        contactInfoObj.form = data.url;
      }
      
      // Add social profiles if found (stored in metadata)
      if (metadataObj.socialProfiles && Array.isArray(metadataObj.socialProfiles)) {
        contactInfoObj.social = metadataObj.socialProfiles;
      }
      
      // Determine if it might be a premium opportunity based on relevance score
      const isPotentialPremium = (data.relevanceScore && data.relevanceScore >= 7);
      
      // Check if URL already exists to avoid duplicates
      const existingOpps = await db.select()
        .from(discoveredOpportunities)
        .where(eq(discoveredOpportunities.url, data.url));
      
      // Create contactInfo JSON object if we have contact information
      const contactInfo = Object.keys(contactInfoObj).length > 0 ? contactInfoObj : null;
      
      if (existingOpps.length > 0) {
        // Update existing record instead of creating a new one
        const [updatedOpp] = await db.update(discoveredOpportunities)
          .set({ 
            lastChecked: new Date(),
            title: data.title || existingOpps[0].title,
            description: data.description || existingOpps[0].description,
            contactEmail: data.contactEmail || existingOpps[0].contactEmail,
            hasContactForm: data.hasContactForm !== undefined ? data.hasContactForm : existingOpps[0].hasContactForm,
            content: data.content || existingOpps[0].content,
            categories: processedCategories || existingOpps[0].categories,
            sourceType: data.sourceType || existingOpps[0].sourceType,
            metadataRaw: JSON.stringify(metadataObj),
            contactInfo: contactInfo, // Store contact info in JSON field
            // Only update status if it's potentially premium and not already assigned
            ...(isPotentialPremium && existingOpps[0].status === 'discovered' ? { status: 'analyzed' } : {})
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
          status: isPotentialPremium ? 'analyzed' : 'discovered', // Mark high-relevance scores for faster analysis
          categories: processedCategories,
          metadataRaw: JSON.stringify(metadataObj),
          contactInfo: contactInfo // Store contact info in JSON field
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
      
      // Store contact form URL if we find one
      let contactFormUrl = null;
      let hasContactForm = false;
      
      for (const selector of contactSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          hasContactForm = true;
          
          // Try to get the contact page URL from the first matching link
          if (selector.startsWith('a[') || selector.startsWith('a:')) {
            const href = elements.first().attr('href');
            if (href) {
              try {
                // Convert relative URL to absolute
                const resolvedUrl = new URL(href, formattedUrl).toString();
                contactFormUrl = resolvedUrl;
                break;
              } catch (error) {
                // Invalid URL, continue with next selector
              }
            }
          }
        }
      }
      
      // Extract social media profiles
      const socialMediaPatterns = [
        { platform: 'twitter', regex: /twitter\.com\/([^\/\?"']+)/ },
        { platform: 'facebook', regex: /facebook\.com\/([^\/\?"']+)/ },
        { platform: 'linkedin', regex: /linkedin\.com\/(?:company|in)\/([^\/\?"']+)/ },
        { platform: 'instagram', regex: /instagram\.com\/([^\/\?"']+)/ },
        { platform: 'pinterest', regex: /pinterest\.com\/([^\/\?"']+)/ },
        { platform: 'youtube', regex: /youtube\.com\/(?:channel|user|c)\/([^\/\?"']+)/ },
        { platform: 'github', regex: /github\.com\/([^\/\?"']+)/ }
      ];
      
      const socialProfiles: Array<{platform: string, url: string, username: string}> = [];
      
      // Find social media links in all <a> tags
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;
        
        for (const pattern of socialMediaPatterns) {
          const match = href.match(pattern.regex);
          if (match && match[1]) {
            try {
              const url = new URL(href.startsWith('http') ? href : `https://${href}`).toString();
              socialProfiles.push({
                platform: pattern.platform,
                url: url,
                username: match[1]
              });
            } catch (error) {
              // Invalid URL, skip
            }
          }
        }
      });
      
      // Extract page text with better noise filtering
      // Remove script, style, and common footer/header elements
      $('script, style, nav, footer, .footer, .header, .nav, .menu, .sidebar').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const lowerBodyText = bodyText.toLowerCase();
      
      // Check for email addresses (improved regex)
      const emailRegex = /[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,125}[a-zA-Z]{2,63}/g;
      const tempEmails = bodyText.match(emailRegex) || [];
      
      // Check for emails in href="mailto:" links too
      $('a[href^="mailto:"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.startsWith('mailto:')) {
          const email = href.substring(7).split('?')[0].trim();
          if (email && email.includes('@') && !tempEmails.includes(email)) {
            tempEmails.push(email);
          }
        }
      });
      
      // Filter out common false positives and limit to reasonable number
      const emails = tempEmails
        .filter(email => 
          !email.includes('example.com') && 
          !email.includes('domain.com') && 
          !email.startsWith('email@') &&
          !email.includes('your@') &&
          !email.includes('@example') &&
          email.length < 100 // Some regex matches can get very long
        )
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
      
      // Return the results with enhanced metadata and improved contact info structure
      return {
        status: 'success',
        url: formattedUrl,
        title,
        description: metaDescription,
        emails,
        hasContactForm,
        contactFormUrl,
        socialProfiles,
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
          // Try multi-provider validation for more reliable metrics
          // This uses a cascading fallback system of APIs
          const validationResults: Record<string, any> = {};
          
          // Process each domain with our enhanced validation service
          for (let k = 0; k < domains.length; k++) {
            const domain = domains[k];
            console.log(`[Crawler] Validating domain: ${domain}`);
            try {
              // Use the new validation service which handles fallbacks automatically
              const validation = await this.validationService.validateDomain(domain);
              validationResults[domain] = validation;
            } catch (validationError) {
              console.error(`[Crawler] Error validating domain ${domain}:`, validationError);
              // If validation fails, add empty result
              validationResults[domain] = {};
            }
          }
          
          // Fall back to Moz API for any domains that failed validation
          const domainsNeedingFallback = domains.filter(domain => 
            !validationResults[domain] || 
            (!validationResults[domain].domainAuthority && validationResults[domain].domainAuthority !== 0)
          );
          
          if (domainsNeedingFallback.length > 0) {
            // Last resort fallback to Moz API directly
            try {
              const mozMetrics = await this.mozService.getBatchDomainMetrics(domainsNeedingFallback);
              
              // Add Moz results to our validation results
              domainsNeedingFallback.forEach((domain, index) => {
                const metrics = mozMetrics[index] || {};
                validationResults[domain] = {
                  domainAuthority: Math.round(metrics.domain_authority || 0),
                  spamScore: Math.round((metrics.spam_score || 0) * 10),
                  securityScore: 100, // Default when we don't have security data
                  riskFactors: [],
                  technologies: [],
                  status: 'valid',
                  provider: 'moz'
                };
              });
            } catch (mozError) {
              console.error('[Crawler] Moz API fallback failed:', mozError);
            }
          }
          
          // Update each opportunity with the metrics from validation
          for (let j = 0; j < batch.length; j++) {
            const opp = batch[j];
            const domain = opp.domain || this.extractDomain(opp.url);
            const validation = validationResults[domain] || {};
            
            // Additional metadata for future use
            const validationData = {
              securityScore: validation.securityScore,
              riskFactors: validation.riskFactors,
              technologies: validation.technologies,
              provider: validation.provider,
              status: validation.status
            };
            
            // Update the opportunity with metrics
            await db.update(discoveredOpportunities)
              .set({ 
                status: 'analyzed',
                domainAuthority: validation.domainAuthority || 0,
                pageAuthority: 0, // Not provided by all services
                spamScore: validation.spamScore || 0,
                lastChecked: new Date(),
                validationData: validationData
              })
              .where(eq(discoveredOpportunities.id, opp.id));
          }
        } catch (error) {
          console.error('Error processing opportunity batch:', error);
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
  async startDiscoveryCrawl(type: string, startUrls: string[], maxCrawlDepth: number = 3): Promise<CrawlerJob> {
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
        
        // Process URLs concurrently with limits
        const processUrl = async (url: string) => {
          if (visitedUrls.has(url)) {
            this.activeCrawls--;
            return;
          }
          visitedUrls.add(url);
          
          results.crawled++;
          
          try {
            // Use the specified max crawl depth
            const result = await this.crawlUrl(url, 0, maxCrawlDepth);
            
            this.activeCrawls--; // Decrease active crawls counter
            
            if (result.status === 'error') {
              results.errors++;
              results.details.push({
                url,
                error: result.error,
              });
              return;
            }
            
            // Check if it's a valid opportunity with more comprehensive quality filtering
            const isRequestedType = type === 'all' || result.opportunityType === type;
            const hasContactMethod = result.emails.length > 0 || result.hasContactForm;
            const hasGoodContent = result.title && 
                                  (result.description || (result.content && result.content.length > 100));
            
            // Additional quality checks to reduce low-value opportunities
            const isHighQuality = result.relevanceScore && result.relevanceScore >= 4;
            
            if (isRequestedType && hasContactMethod && hasGoodContent) {
              // Store the opportunity with all available metadata and enhanced contact info
              const opportunity = await this.storeDiscoveredOpportunity({
                url: result.url,
                domain: this.extractDomain(result.url),
                sourceType: result.opportunityType,
                title: result.title,
                description: result.description,
                contactEmail: result.emails.length > 0 ? result.emails[0] : null,
                hasContactForm: result.hasContactForm,
                content: result.content,
                categories: result.categories,
                domainAuthority: 0, // Will be updated by processDiscoveredBatch
                pageAuthority: 0,   // Will be updated by processDiscoveredBatch
                spamScore: 0,       // Will be updated by processDiscoveredBatch
                relevanceScore: result.relevanceScore || 0,
                metadataRaw: JSON.stringify({
                  crawlDate: result.crawlDate || new Date().toISOString(),
                  allEmails: result.emails, // Store all discovered emails
                  socialProfiles: result.socialProfiles || [], // Store all social profiles
                  contactFormUrl: result.contactFormUrl, // Store contact form URL
                  wordCount: result.content ? result.content.split(/\s+/).length : 0,
                  relevance: result.relevanceScore || 0,
                  opportunityQuality: isHighQuality ? 'high' : 'standard'
                })
              });
              
              results.discovered++;
              results.opportunities.push(opportunity);
              
              // If this is a particularly high quality opportunity, 
              // process it immediately for faster availability
              if (isHighQuality && opportunity.id) {
                await this.processDiscoveredBatch([opportunity.id]);
              }
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
                
                // Check if it's a valid opportunity with more comprehensive quality filtering
                const isRequestedSubType = type === 'all' || subResult.opportunityType === type;
                const hasSubContactMethod = subResult.emails.length > 0 || subResult.hasContactForm;
                const hasSubGoodContent = subResult.title && 
                                      (subResult.description || (subResult.content && subResult.content.length > 100));
                
                // Additional quality checks to reduce low-value opportunities
                const isSubHighQuality = subResult.relevanceScore && subResult.relevanceScore >= 4;
                
                if (isRequestedSubType && hasSubContactMethod && hasSubGoodContent) {
                  // Store the opportunity with all available metadata and enhanced contact info
                  const opportunity = await this.storeDiscoveredOpportunity({
                    url: subResult.url,
                    domain: this.extractDomain(subResult.url),
                    sourceType: subResult.opportunityType,
                    title: subResult.title,
                    description: subResult.description,
                    contactEmail: subResult.emails.length > 0 ? subResult.emails[0] : null,
                    hasContactForm: subResult.hasContactForm,
                    content: subResult.content,
                    categories: subResult.categories,
                    domainAuthority: 0, // Will be updated by processDiscoveredBatch
                    pageAuthority: 0,   // Will be updated by processDiscoveredBatch
                    spamScore: 0,       // Will be updated by processDiscoveredBatch
                    relevanceScore: subResult.relevanceScore || 0,
                    metadataRaw: JSON.stringify({
                      crawlDate: subResult.crawlDate || new Date().toISOString(),
                      allEmails: subResult.emails, // Store all discovered emails
                      socialProfiles: subResult.socialProfiles || [], // Store all social profiles
                      contactFormUrl: subResult.contactFormUrl, // Store contact form URL
                      wordCount: subResult.content ? subResult.content.split(/\s+/).length : 0,
                      relevance: subResult.relevanceScore || 0,
                      opportunityQuality: isSubHighQuality ? 'high' : 'standard'
                    })
                  });
                  
                  results.discovered++;
                  results.opportunities.push(opportunity);
                  
                  // If this is a particularly high quality opportunity, 
                  // process it immediately for faster availability
                  if (isSubHighQuality && opportunity.id) {
                    await this.processDiscoveredBatch([opportunity.id]);
                  }
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
   * This selects crawl types and seed URLs strategically to maximize quality premium opportunities
   */
  private async runContinuousCrawlCycle() {
    try {
      console.log('[Crawler] Running continuous crawl cycle');
      
      // Enhanced opportunity types categorization by quality potential
      const premiumTypes = ['guest_post', 'resource_page']; // Highest quality opportunities (DA 50+, low spam)
      const highValueTypes = ['blog', 'directory', 'forum']; // Good quality opportunities (DA 30-50, low-med spam)
      const supplementaryTypes = ['competitor_backlink', 'social_mention', 'comment_section']; // Supporting opportunities
      
      // Get current date to help determine crawl strategy
      const now = new Date();
      const currentHour = now.getHours();
      const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
      
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isBusinessHours = currentHour >= 9 && currentHour <= 17;
      const isEvening = currentHour >= 18 && currentHour <= 23;
      
      // Define crawl depth strategy by type
      const crawlDepthByType = {
        guest_post: 4,    // Deeper crawl for highest value opportunities
        resource_page: 3, // Resource pages need moderate depth
        blog: 3,          // Blogs need moderate depth to find good content
        directory: 2,     // Directories are typically shallow
        forum: 3,         // Forums need deeper crawl to find relevant threads
        competitor_backlink: 2, // Just enough to verify the link
        social_mention: 2,      // Social mentions are typically shallow
        comment_section: 1      // Comment sections don't need deep crawling
      };
      
      let typesToCrawl = [];
      let premiumFocus = false;
      let highQualityFocus = false;
      
      // Select crawl types based on time patterns for maximum efficiency
      
      // Weekend strategy - focus heavily on premium opportunities
      if (isWeekend) {
        // Weekend: Prioritize premium opportunities (more people post high-quality content on weekends)
        typesToCrawl = [...premiumTypes];
        // Add high-DA forums and blogs for diversity
        typesToCrawl.push('forum');
        typesToCrawl.push('blog');
        premiumFocus = true;
        
        // Increase depth for weekend crawls to compensate for fewer crawl types
        crawlDepthByType.guest_post = 5;
        crawlDepthByType.blog = 4;
        crawlDepthByType.forum = 4;
      } 
      // Early morning/night strategy - when servers are less busy, go deeper
      else if (currentHour >= 0 && currentHour < 7) {
        // Night/Early morning: Focus exclusively on premium opportunities & deep crawling
        typesToCrawl = [...premiumTypes];
        // Add high-authority forums which often have better content at night
        typesToCrawl.push('forum');
        premiumFocus = true;
        highQualityFocus = true;
        
        // Maximum depth during off-hours when servers are less loaded
        crawlDepthByType.guest_post = 5;
        crawlDepthByType.resource_page = 4;
        crawlDepthByType.forum = 4;
      } else if (currentHour >= 7 && currentHour < 12) {
        // Morning business hours: Target newly published content
        // Many sites publish new content in the morning, especially guest post opportunities
        typesToCrawl.push('guest_post');
        typesToCrawl.push('blog'); // Content creators most active in mornings
        typesToCrawl.push('directory'); // Directories often update in mornings
        
        // Adjust morning crawl depths
        crawlDepthByType.guest_post = 4; // Go deeper for morning guest posts
        crawlDepthByType.blog = 3;
        
        highQualityFocus = true; // Focus on high-quality in morning hours
      } else if (currentHour >= 12 && currentHour < 17) {
        // Afternoon: Business hours strategy - focus on resource pages and professional directories
        // Prioritize resource pages which are maintained by professionals during work hours
        typesToCrawl.push('resource_page');
        typesToCrawl.push('directory');
        
        // Add one premium type based on day of week
        // Early week: guest posts, late week: resource pages (content planning cycles)
        if (dayOfWeek <= 3) { // Monday-Wednesday
          typesToCrawl.push('guest_post');
          crawlDepthByType.guest_post = 4;
        } else { // Thursday-Friday
          typesToCrawl.push('resource_page');
          crawlDepthByType.resource_page = 4;
        }
        
        // Slightly increased depth for afternoon crawls
        crawlDepthByType.directory = 3;
      } else if (currentHour >= 17 && currentHour < 21) {
        // Evening: Focus on community content which is more active after work hours
        // Forums, communities and social platforms are most active during evening hours
        typesToCrawl.push('forum');
        typesToCrawl.push('social_mention');
        
        // Add guest post hunting for blogs that post in evenings
        typesToCrawl.push('guest_post');
        
        // Increase forum depth in evenings when more content is being posted
        crawlDepthByType.forum = 4;
        crawlDepthByType.social_mention = 3;
        
        // Still maintain focus on quality opportunities
        highQualityFocus = true;
      } else {
        // Late evening: Premium focus when server loads are typically lower
        // Plus opportunity to discover international content posted during different time zones
        typesToCrawl = [...premiumTypes];
        // Add high-value blogs which often publish at night
        typesToCrawl.push('blog');
        
        // Maximum crawl depths during off-peak hours
        crawlDepthByType.guest_post = 5;
        crawlDepthByType.resource_page = 4;
        crawlDepthByType.blog = 4;
        
        premiumFocus = true;
      }
      
      console.log(`[Crawler] Selected crawl types for this cycle: ${typesToCrawl.join(', ')}`);
      
      // For each type, run a crawl job with strategically selected seed URLs
      for (const type of typesToCrawl) {
        // Get all seed URLs for this type
        const allSeedUrls = this.getSeedUrlsForType(type);
        
        if (allSeedUrls.length > 0) {
          // Determine number of URLs to use and crawl depth based on type
          let numUrlsToUse = 5; // Default
          let crawlDepth = 2; // Default
          
          // Adjust strategy based on opportunity type and focus
          if (premiumTypes.includes(type)) {
            numUrlsToUse = premiumFocus ? 15 : 10; // Significantly more seeds for premium types during premium focus hours
            crawlDepth = highQualityFocus ? 5 : 4; // Much deeper crawl for premium types during high quality focus
          } else if (highValueTypes.includes(type)) {
            numUrlsToUse = highQualityFocus ? 12 : 8;
            crawlDepth = highQualityFocus ? 4 : 3;
          } else if (type === 'forum' && (premiumFocus || highQualityFocus)) {
            // Forums can yield high-quality opportunities if properly crawled
            numUrlsToUse = 12;
            crawlDepth = 4;
          } else {
            numUrlsToUse = 8;
            crawlDepth = 2; // Increased crawl for supplementary types to improve discovery
          }
          
          // Create a copy of the array to sample from
          const availableUrls = [...allSeedUrls];
          const seedUrls = [];
          
          // Define high-quality domains based on our crawling experience
          const highQualityDomains = [
            'moz.com', 
            'ahrefs.com', 
            'semrush.com', 
            'searchenginejournal.com', 
            'searchengineland.com',
            'backlinko.com',
            'neilpatel.com',
            'wordstream.com',
            'techradar.com',
            'yoast.com',
            'growthhackers.com',
            'bloggerspassion.com',
            'indiehackers.com',
            'webmasterworld.com',
            'reddit.com',
            'quora.com',
            'smashingmagazine.com',
            'hubspot.com'
          ];
          
          // First, prioritize high-quality domains if we're in premium focus mode
          if (premiumFocus || highQualityFocus) {
            // Find URLs from high-quality domains first
            for (let i = 0; i < availableUrls.length && seedUrls.length < Math.ceil(numUrlsToUse * 0.6); i++) {
              const url = availableUrls[i];
              const domain = this.extractDomain(url);
              
              if (highQualityDomains.some(hqDomain => domain.includes(hqDomain))) {
                seedUrls.push(url);
                // Remove from available URLs to avoid duplicates
                const index = availableUrls.indexOf(url);
                if (index > -1) {
                  availableUrls.splice(index, 1);
                }
              }
            }
          }
          
          // Fill the rest with random selection
          while (seedUrls.length < numUrlsToUse && availableUrls.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableUrls.length);
            seedUrls.push(availableUrls[randomIndex]);
            availableUrls.splice(randomIndex, 1);
          }
          
          console.log(`[Crawler] Starting crawl for type: ${type} with ${seedUrls.length} seed URLs at depth ${crawlDepth}`);
          await this.startDiscoveryCrawl(type, seedUrls, crawlDepth);
          
          // Add a variable delay between crawl jobs to avoid predictable patterns
          // and to be more respectful to servers
          const variableDelay = this.crawlDelay + (Math.random() * 5000);
          await new Promise(resolve => setTimeout(resolve, variableDelay));
        }
      }
      
      // Run a focused premium crawl with increased probability (30% chance or 50% during premium focus hours)
      const premiumCrawlChance = premiumFocus ? 0.5 : 0.3;
      if (Math.random() < premiumCrawlChance) {
        // Target high-authority domains for premium opportunities
        const premiumType = Math.random() < 0.7 ? 'guest_post' : 'resource_page'; // 70% focus on guest posts
        const allPremiumSeeds = this.getSeedUrlsForType(premiumType);
        
        // Select 3 seed URLs for deep crawling
        const premiumSeeds = [];
        const availablePremiumUrls = [...allPremiumSeeds];
        
        for (let i = 0; i < 3 && availablePremiumUrls.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * availablePremiumUrls.length);
          premiumSeeds.push(availablePremiumUrls[randomIndex]);
          availablePremiumUrls.splice(randomIndex, 1);
        }
        
        if (premiumSeeds.length > 0) {
          console.log(`[Crawler] Running deep premium crawl for ${premiumType} opportunities`);
          await this.startDiscoveryCrawl(premiumType, premiumSeeds, 4); // Maximum depth for premium sources
        }
      }
    } catch (error) {
      console.error('[Crawler] Error in continuous crawl cycle:', error);
    }
  }
  
  /**
   * Database of verified premium seed URLs by opportunity type
   * These URLs consistently produce high-quality (DA 40+, low spam) opportunities
   */
  private premiumSeedsByType: Record<string, string[]> = {
    'resource_page': [
      'https://ahrefs.com/blog/seo-resources/',
      'https://moz.com/learn/seo',
      'https://backlinko.com/seo-tools',
      'https://www.semrush.com/blog/resources/',
      'https://neilpatel.com/blog/seo-tools/',
      'https://www.reliablesoft.net/digital-marketing-resources/',
      'https://www.wordstream.com/blog/resources',
      'https://www.searchenginewatch.com/category/seo/',
      'https://www.digitalmarketer.com/blog/resources/',
      'https://blog.hubspot.com/marketing/seo-resources'
    ],
    'guest_post': [
      'https://www.searchenginejournal.com/contribute/',
      'https://www.entrepreneur.com/write-for-us',
      'https://www.forbes.com/sites/info/2021/12/10/forbes-writers-guidelines/',
      'https://www.business.com/contribute/',
      'https://www.techradar.com/news/submit-news-stories-reviews-and-guides',
      'https://www.convinceandconvert.com/write-for-us/',
      'https://www.jeffbullas.com/submit-a-guest-post/',
      'https://www.socialmediaexaminer.com/writers/',
      'https://www.smartblogger.com/write-for-us/',
      'https://www.copyblogger.com/write-for-us/'
    ],
    'forum': [
      'https://www.webmasterworld.com/',
      'https://community.ahrefs.com/',
      'https://www.reddit.com/r/bigseo/',
      'https://www.warriorforum.com/',
      'https://inbound.org/',
      'https://moz.com/community',
      'https://www.reddit.com/r/SEO/',
      'https://www.seroundtable.com/'
    ],
    'blog': [
      'https://www.searchenginejournal.com/',
      'https://moz.com/blog',
      'https://backlinko.com/blog',
      'https://www.gsqi.com/marketing-blog/',
      'https://www.seoroundtable.com/',
      'https://www.searchengineland.com/',
      'https://contentmarketinginstitute.com/blog/',
      'https://www.bloggerspassion.com/blog/',
      'https://authorityhacker.com/blog/',
      'https://www.matthewwoodward.co.uk/blog/'
    ],
    'directory': [
      'https://clutch.co/directories',
      'https://www.hotfrog.com/',
      'https://about.com/sitemap',
      'https://botw.org/',
      'https://www.yelp.com/busines-directory'
    ]
  };
  
  /**
   * Domain quality scores based on historical performance
   * These are sites we know have high authority and produce good backlinks
   */
  private domainQualityScores: Record<string, number> = {
    'searchenginejournal.com': 95,
    'moz.com': 95,
    'ahrefs.com': 93,
    'backlinko.com': 92,
    'semrush.com': 90,
    'entrepreneur.com': 90,
    'forbes.com': 88,
    'business.com': 85,
    'techradar.com': 85,
    'convinceandconvert.com': 83,
    'seoroundtable.com': 82,
    'searchengineland.com': 82,
    'hubspot.com': 80,
    'contentmarketinginstitute.com': 80,
    'smartblogger.com': 78,
    'socialmediaexaminer.com': 78,
    'copyblogger.com': 77,
    'jeffbullas.com': 75,
    'neilpatel.com': 75,
    'wordstream.com': 75,
    'bloggerspassion.com': 72,
    'authorityhacker.com': 72,
    'matthewwoodward.co.uk': 70
  };
  
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
        'https://www.digitalmarketer.com/resources/',
        'https://www.emailmonday.com/resources/',
        'https://www.conversion-rate-experts.com/resources/',
        'https://www.singlegrain.com/resources/',
        
        // Industry-specific resource pages
        'https://www.convinceandconvert.com/resources/',
        'https://www.orbitmedia.com/blog/web-design-statistics/',
        'https://www.crazyegg.com/blog/resources/',
        'https://www.copyblogger.com/content-marketing-tools/',
        'https://blog.hootsuite.com/social-media-resources/',
        'https://www.authorityhacker.com/resources/',
        'https://bloggerspassion.com/resources/',
        'https://matthewwoodward.co.uk/resources/',
        'https://adamenfroy.com/resources',
        'https://www.robbierichards.com/resources/',
        'https://www.indiehackers.com/resources',
        // New additions - high-quality marketing and SEO resources
        'https://yoast.com/seo-blog/resources/',
        'https://www.searchenginewatch.com/category/resources/',
        'https://www.searchmetrics.com/resources/',
        'https://www.seerinteractive.com/resources/',
        'https://www.quicksprout.com/resources/',
        'https://growandconvert.com/resources/',
        'https://www.webfx.com/blog/web-design/web-design-resources/',
        'https://blog.hubspot.com/marketing/free-marketing-resources',
        'https://www.bluleadz.com/blog/hubspot-marketing-resources',
        'https://www.impactbnd.com/blog/marketing-resources',
        'https://www.conductor.com/learning-center/resources/',
        'https://cxl.com/blog/category/guides-and-resources/',
        
        // Web development resources
        'https://css-tricks.com/guides/',
        'https://developer.mozilla.org/en-US/docs/Web/Guide',
        'https://www.smashingmagazine.com/guides/',
        'https://web.dev/learn/',
        'https://www.digitalocean.com/community/tutorials',
        'https://www.freecodecamp.org/news/tag/resources/',
        'https://sitepoint.com/resources/',
        'https://webdesignledger.com/resources/',
        'https://hackernoon.com/tagged/resource',
        'https://www.producthunt.com/topics/resources',
        'https://tympanus.net/codrops/category/resources/'
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
        'https://www.dmoz-odp.org/',
        'https://www.ezilon.com/',
        'https://www.brownbook.net/',
        'https://www.angieslist.com/',
        'https://www.manta.com/',
        'https://www.cybo.com/',
        'https://www.europages.co.uk/',
        'https://www.bizjournals.com/',
        'https://www.thumbtack.com/',
        'https://www.clutch.co/directories',
        'https://www.bloggerspassion.com/web-directories-list/',
        'https://www.webwiki.com/',
        'https://www.superpages.com/',
        'https://www.aboutus.com/',
        
        // Industry-specific directories
        'https://www.g2.com/categories/',
        'https://www.capterra.com/directories/',
        'https://clutch.co/directories',
        'https://www.goodfirms.co/',
        'https://www.sitejabber.com/',
        'https://www.sortlist.com/',
        'https://www.trustpilot.com/',
        'https://www.softwareadvice.com/categories/',
        'https://digital.com/categories/',
        'https://getapp.com/categories/',
        'https://www.webwiki.com/',
        'https://www.producthunt.com/topics/',
        'https://www.allbusiness.com/business-directory/',
        
        // Marketing and SEO-specific directories
        'https://www.semrush.com/agencies/',
        'https://ahrefs.com/blog/list-of-web-directories/',
        'https://www.hubspot.com/agency-directory',
        'https://www.searchenginejournal.com/seo-agencies/',
        'https://moz.com/learn/seo/resources',
        'https://www.seobythesea.com/web-directories/',
        'https://www.seobook.com/directories',
        'https://www.betterteam.com/digital-marketing-agency-directory',
        'https://digitalagencynetwork.com/agencies/',
        'https://www.sortlist.com/marketing-agencies',
        
        // Local business directories
        'https://www.yellowpages.com/',
        'https://www.bbb.org/',
        'https://www.thomasnet.com/',
        'https://www.angi.com/',
        'https://www.foursquare.com/',
        'https://www.tripadvisor.com/',
        'https://www.yelp.com/',
        'https://www.zomato.com/',
        'https://www.opentable.com/',
        'https://www.justdial.com/',
        'https://www.mapquest.com/',
        'https://www.local.com/',
        'https://www.citysearch.com/',
        'https://www.localsolver.com/',
        'https://www.localiq.com/',
        'https://www.merchantcircle.com/',
        'https://www.insiderpages.com/',
        'https://www.dexknows.com/',
        'https://www.shopify.com/local-business-directory',
        'https://www.localeze.com/',
        'https://www.whereorg.com/'
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
        'https://ahrefs.com/blog/write-for-us/',
        'https://backlinko.com/write-for-us',
        'https://moz.com/community/join',
        'https://www.wordstream.com/write-for-wordstream',
        'https://www.crazyegg.com/blog/write-for-us/',
        'https://buffer.com/resources/write-for-us/',
        'https://www.copyblogger.com/guest-post-guidelines/',
        'https://www.searchenginewatch.com/contact-us/',
        // New high-quality guest post opportunities
        'https://www.forbes.com/sites/groupthink/',
        'https://www.inc.com/contributors.html',
        'https://www.business2community.com/become-a-contributor',
        'https://www.smartinsights.com/help-with-digital-marketing/submit-articles/',
        'https://mashable.com/submit/',
        'https://www.techcrunch.com/submit-your-startup/',
        'https://www.wired.com/about/contribute-to-wired/',
        'https://www.fastcompany.com/3029657/how-to-pitch-fastcompany-com',
        'https://marketingland.com/how-to-contribute',
        'https://thenextweb.com/about/#contact',
        'https://www.adweek.com/contact-us/',
        
        // Social media and digital marketing
        'https://www.socialmediaexaminer.com/writers/',
        'https://www.business2community.com/become-a-contributor',
        'https://sproutsocial.com/insights/write-for-us/',
        'https://www.postplanner.com/write-for-us/',
        'https://www.digitalmarketer.com/blog/write-for-digitalmarketer/',
        'https://www.socialmediatoday.com/content-submission/',
        'https://www.hootsuite.com/resources/guest-article-guidelines',
        'https://www.marketingprofs.com/write-for-us',
        'https://www.smartinsights.com/submit-article/',
        'https://blog.mailchimp.com/guest-contributor-guidelines/',
        'https://www.emailmonday.com/guest-blogging/',
        
        // Technology and business
        'https://techcrunch.com/got-a-tip/',
        'https://mashable.com/submit/',
        'https://www.forbes.com/sites/quora/',
        'https://www.fastcompany.com/3003606/fastco-works',
        'https://www.inc.com/contributors.html',
        'https://www.entrepreneur.com/getpublished',
        'https://www.wired.com/about/feedback/',
        'https://www.zdnet.com/article/zdnets-guidelines-for-contributed-content/',
        'https://www.venturebeat.com/guest-posts/',
        'https://thenextweb.com/about#contact',
        'https://readwrite.com/contact/',
        'https://www.techinasia.com/write-for-us',
        'https://www.informationweek.com/contributors.asp',
        'https://www.eweek.com/innovation/how-to-contribute-content-to-eweek/',
        'https://www.smarthustle.com/write-for-us/',
        'https://techradar.com/news/how-to-write-for-techradar',
        'https://www.businessinsider.com/how-to-write-for-business-insider',
        'https://www.pcmag.com/about/write-for-us',
        'https://www.cio.com/about/contributors.html',
        'https://thenextweb.com/about#contact',
        'https://venturebeat.com/guest-posts/',
        'https://hackernoon.com/submit-story',
        'https://smallbiztrends.com/contact-us',
        
        // Industry-specific guest post opportunities
        'https://www.addthis.com/academy/write-for-us/',
        'https://www.impactplus.com/write-for-us',
        'https://www.singlegrain.com/contact/',
        'https://neilpatel.com/write-for-neil/',
        'https://www.blogtyrant.com/write-for-us/',
        'https://www.smartblogger.com/write-for-us/',
        'https://www.quicksprout.com/contact/',
        'https://www.robbierichards.com/write-for-us/',
        'https://www.matthewwoodward.co.uk/write-for-us/',
        'https://www.adamenfroy.com/blogging-community',
        'https://authorityhacker.com/contact/',
        'https://www.growthbadger.com/contribute/',
        'https://bloggerspassion.com/write-for-us/',
        'https://www.websiteplanet.com/write-for-us/',
        'https://madlemmings.com/write-for-us/'
      ],
      forum: [
        // SEO and marketing forums
        'https://forums.digitalpoint.com/',
        'https://www.webmasterworld.com/',
        'https://moz.com/community/q/',
        'https://community.semrush.com/',
        'https://www.warriorforum.com/',
        'https://www.blackhatworld.com/',
        'https://seoforums.org/',
        'https://www.seohut.com/',
        'https://www.bigseo.com/',
        'https://www.cre8asiteforums.com/',
        // Major tech and business forums
        'https://www.reddit.com/r/SEO/',
        'https://www.reddit.com/r/marketing/',
        'https://www.reddit.com/r/content_marketing/',
        'https://www.reddit.com/r/bigseo/',
        'https://www.reddit.com/r/Entrepreneur/',
        'https://www.reddit.com/r/startups/',
        'https://www.quora.com/topic/Search-Engine-Optimization-SEO',
        'https://www.quora.com/topic/Content-Marketing',
        'https://www.quora.com/topic/Digital-Marketing',
        'https://stackoverflow.com/questions/tagged/seo',
        'https://community.ahrefs.com/',
        
        // Tech and startup communities
        'https://www.producthunt.com/',
        'https://growthhackers.com/posts',
        'https://indiehackers.com/groups/marketing',
        'https://www.indiehackers.com/group/content-marketing',
        'https://news.ycombinator.com/',
        'https://www.wip.co/',
        'https://betalist.com/',
        'https://startups.com/communities',
        'https://community.ahrefs.com/',
        'https://seoforum.net/',
        'https://www.reddit.com/r/SEO/',
        'https://www.reddit.com/r/digital_marketing/',
        'https://www.reddit.com/r/marketing/',
        'https://www.reddit.com/r/bigseo/',
        'https://stackoverflow.com/questions/tagged/seo',
        'https://www.quora.com/topic/Search-Engine-Optimization-SEO',
        'https://www.smashingmagazine.com/community/',
        'https://www.maketecheasier.com/forum/',
        'https://www.wordfence.com/forums/',
        'https://www.startupschool.org/posts',
        'https://pioneer.app/blog',
        
        // Social media discussion groups
        'https://www.reddit.com/r/SEO/',
        'https://www.reddit.com/r/marketing/',
        'https://www.reddit.com/r/content_marketing/',
        'https://www.reddit.com/r/Entrepreneur/',
        'https://www.reddit.com/r/smallbusiness/',
        'https://www.reddit.com/r/startups/',
        'https://www.reddit.com/r/webmarketing/',
        'https://www.reddit.com/r/bigseo/',
        'https://www.reddit.com/r/tech/',
        'https://www.reddit.com/r/digital_marketing/',
        
        // Q&A platforms
        'https://www.quora.com/topic/Search-Engine-Optimization-SEO',
        'https://www.quora.com/topic/Digital-Marketing',
        'https://stackoverflow.com/questions/tagged/seo',
        'https://webmasters.stackexchange.com/',
        'https://ahrefs.com/blog/haro/',
        'https://answers.moz.com/',
        'https://www.toprankblog.com/questions/',
        'https://digitalmarketer.com/engage/',
        'https://community.ahrefs.com/',
        'https://help.ahrefs.com/en/categories/keyword-research'
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
        'https://www.singlegrain.com/blog/',
        'https://bloggerspassion.com/blog/',
        'https://www.gsqi.com/marketing-blog/',
        'https://www.seoroundtable.com/',
        'https://www.searchengineland.com/',
        'https://contentmarketinginstitute.com/blog/',
        'https://authorityhacker.com/blog/',
        'https://www.matthewwoodward.co.uk/blog/',
        // Additional high-quality marketing blogs
        'https://www.similarweb.com/blog/',
        'https://www.wordstream.com/blog',
        'https://unbounce.com/blog/',
        'https://www.gotchseo.com/blog/',
        'https://www.crazyegg.com/blog/',
        'https://www.copyblogger.com/blog/',
        'https://buffer.com/resources',
        'https://sproutsocial.com/insights/',
        'https://www.socialmediaexaminer.com/',
        'https://blog.hootsuite.com/',
        'https://www.entrepreneur.com/topic/marketing',
        'https://www.convinceandconvert.com/blog/',
        'https://www.duct-tape-marketing.com/blog/',
        'https://rankmath.com/blog/',
        'https://yoast.com/seo-blog/',
        'https://cognitiveseo.com/blog/',
        'https://www.diggitymarketing.com/blog/',
        'https://www.gotchseo.com/blog/',
        
        // Industry news and updates
        'https://www.seroundtable.com/',
        'https://www.gsqi.com/marketing-blog/',
        'https://www.thesempost.com/',
        'https://www.searchenginewatch.com/',
        'https://www.siegemedia.com/blog',
        'https://www.seobythesea.com/',
        'https://www.searchmetrics.com/blog/',
        'https://www.searchenginegurus.com/blog/',
        'https://www.seerinteractive.com/blog/',
        'https://seoroundtable.com/',
        'https://www.seoreseller.com/blog/',
        
        // Content marketing blogs
        'https://www.copyblogger.com/',
        'https://www.animalz.co/blog/',
        'https://www.convinceandconvert.com/blog/',
        'https://contentmarketinginstitute.com/blog/',
        'https://www.orbitmedia.com/blog/',
        'https://www.clearvoice.com/blog/',
        'https://cxl.com/blog/',
        'https://express-writers.com/blog/',
        'https://writtent.com/blog/',
        'https://www.marketingprofs.com/articles/',
        'https://blog.hubspot.com/marketing/',
        
        // Growth and analytics
        'https://www.crazyegg.com/blog/',
        'https://www.growthmachine.com/blog',
        'https://growthhackers.com/posts',
        'https://blog.kissmetrics.com/',
        'https://www.matthewwoodward.co.uk/blog/',
        'https://databox.com/blog/',
        'https://www.ppchero.com/blog/',
        'https://www.wordstream.com/blog',
        'https://www.optimizesmart.com/blog/',
        'https://www.similarweb.com/blog/',
        'https://www.practicalecommerce.com/articles/'
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
        'https://linkgraph.com/free-backlink-checker/',
        'https://www.backlinktest.com/',
        'https://smallseotools.com/backlink-checker/',
        'https://sitechecker.pro/backlink-checker/',
        'https://www.seoptimer.com/backlinks-checker',
        'https://www.openlinkprofiler.org/',
        
        // Link building resources
        'https://backlinko.com/link-building',
        'https://www.linkody.com/',
        'https://www.buzzstream.com/',
        'https://www.linkresearchtools.com/',
        'https://www.screamingfrog.co.uk/seo-spider/',
        'https://respona.com/blog/link-building-tools/',
        'https://pitchbox.com/resources/',
        'https://pointvisible.com/blog/link-building-strategies/',
        'https://www.linkdepartment.com/resources',
        'https://www.pageonepower.com/resources',
        'https://www.fatjoe.com/blog/category/link-building/',
        
        // Competitor analysis tools
        'https://www.spyfu.com/',
        'https://serpstat.com/',
        'https://www.similarweb.com/',
        'https://moz.com/explorer',
        'https://ubersuggest.com/user/sites',
        'https://www.semrush.com/competitive-research/',
        'https://www.alexa.com/siteinfo',
        'https://kwfinder.com/',
        'https://www.ispot.tv/competitors',
        'https://www.owler.com/company/example',
        'https://www.crunchbase.com/discover/organization.companies'
      ],
      social_mention: [
        // Major social platforms
        'https://twitter.com/search',
        'https://www.linkedin.com/feed/',
        'https://www.facebook.com/search/',
        'https://www.reddit.com/search/',
        'https://www.pinterest.com/search/',
        'https://www.instagram.com/explore/',
        'https://mastodon.social/explore',
        'https://www.threads.net/explore',
        'https://bluesky.app/explore',
        'https://www.snapchat.com/discover',
        
        // Social mention monitoring
        'https://www.instagram.com/explore/',
        'https://www.quora.com/search',
        'https://medium.com/search',
        'https://www.tumblr.com/explore/',
        'https://www.tiktok.com/discover',
        'https://www.flickr.com/search/',
        'https://www.youtube.com/results',
        'https://www.slideshare.net/search/',
        'https://www.twitch.tv/directory',
        'https://soundcloud.com/search',
        
        // Industry-specific social platforms
        'https://www.producthunt.com/',
        'https://hashtagify.me/',
        'https://www.brandmentions.com/',
        'https://www.socialmention.com/',
        'https://mention.com/en/',
        'https://www.google.com/alerts',
        'https://answerthepublic.com/',
        'https://keyhole.co/',
        'https://www.hootsuite.com/platform/streams',
        'https://sproutsocial.com/features/social-media-listening/'
      ],
      comment_section: [
        // High-engagement blogs
        'https://moz.com/blog/',
        'https://backlinko.com/blog',
        'https://neilpatel.com/blog/',
        'https://searchengineland.com/',
        'https://www.searchenginejournal.com/',
        'https://blog.hubspot.com/',
        'https://www.jeffbullas.com/',
        'https://blog.buffer.com/',
        'https://www.quicksprout.com/blog/',
        'https://www.impactplus.com/blog',
        
        // Industry news with active comments
        'https://www.seroundtable.com/',
        'https://searchenginewatch.com/',
        'https://www.gsqi.com/marketing-blog/',
        'https://www.seoroundtable.com/',
        'https://www.webmasterworld.com/',
        'https://www.searchenginejournal.com/category/news/',
        'https://www.marketingdive.com/',
        'https://www.adweek.com/',
        'https://thenextweb.com/search',
        'https://venturebeat.com/',
        
        // Marketing blogs with engagement
        'https://www.copyblogger.com/',
        'https://www.problogger.com/',
        'https://www.smartblogger.com/',
        'https://www.convinceandconvert.com/blog/',
        'https://www.socialmediaexaminer.com/blog/',
        'https://www.socialmediatoday.com/',
        'https://www.digitalmarketer.com/blog/',
        'https://www.wordstream.com/blog',
        'https://blog.kissmetrics.com/',
        'https://coschedule.com/blog/'
      ]
    };
    
    // Get all seeds from our available sources
    const allAvailableUrls = new Set<string>();
    
    // First add premium seeds if available for this type
    if (this.premiumSeedsByType[type]) {
      this.premiumSeedsByType[type].forEach(url => allAvailableUrls.add(url));
    }
    
    // Add regular seeds
    if (seedUrls[type]) {
      seedUrls[type].forEach(url => allAvailableUrls.add(url));
    }
    
    // Convert set to array (deduplicates URLs)
    const result = Array.from(allAvailableUrls);
    
    // Sort seed URLs based on domain quality scores to prioritize high-quality sources
    return result.sort((a, b) => {
      const domainA = this.extractDomain(a);
      const domainB = this.extractDomain(b);
      
      // Get domain quality scores or default to 0
      const scoreA = this.getDomainQualityScore(domainA);
      const scoreB = this.getDomainQualityScore(domainB);
      
      // Sort descending (higher scores first)
      return scoreB - scoreA;
    });
  }
  
  /**
   * Get the quality score for a domain based on historical performance
   * @param domain The domain to score
   * @returns Quality score between 0-100
   */
  private getDomainQualityScore(domain: string): number {
    // Check for exact match
    if (this.domainQualityScores[domain]) {
      return this.domainQualityScores[domain];
    }
    
    // Check for subdomain match
    for (const scoredDomain in this.domainQualityScores) {
      if (domain.endsWith(`.${scoredDomain}`) || domain.includes(scoredDomain)) {
        return this.domainQualityScores[scoredDomain];
      }
    }
    
    // Default score for unknown domains
    return 40;
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
   * Updates metadata and checks if they're still valid, with special priority for premium opportunities
   */
  private async refreshOpportunities() {
    try {
      console.log('[Crawler] Refreshing opportunities');
      
      // Define refresh timeframes based on opportunity quality
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      // First, get premium opportunities that need refreshing
      // We refresh premium opportunities more frequently (every 3 days)
      const premiumOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(and(
          eq(discoveredOpportunities.status, 'premium'),
          or(
            isNull(discoveredOpportunities.lastChecked),
            lt(discoveredOpportunities.lastChecked, threeDaysAgo)
          )
        ))
        .limit(15); // Process premium opportunities first
      
      // Then get high-DA opportunities (even if not marked premium)
      const highDaOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(and(
          gt(discoveredOpportunities.domainAuthority, 40),
          lt(discoveredOpportunities.spamScore, 30),
          or(
            isNull(discoveredOpportunities.lastChecked),
            lt(discoveredOpportunities.lastChecked, sevenDaysAgo)
          )
        ))
        .limit(15 - premiumOpportunities.length); // Fill up to a combined total of 15
      
      // Finally, get regular opportunities that haven't been checked in 14 days
      const regularOpportunities = await db.select()
        .from(discoveredOpportunities)
        .where(and(
          ne(discoveredOpportunities.status, 'premium'),
          or(
            isNull(discoveredOpportunities.lastChecked),
            lt(discoveredOpportunities.lastChecked, fourteenDaysAgo)
          )
        ))
        .limit(10); // Add 10 regular opportunities
      
      // Combine all opportunities, with premium ones first
      const opportunities = [
        ...premiumOpportunities,
        ...highDaOpportunities.filter(o => !premiumOpportunities.some(p => p.id === o.id)), // Avoid duplicates
        ...regularOpportunities.filter(o => 
          !premiumOpportunities.some(p => p.id === o.id) && 
          !highDaOpportunities.some(h => h.id === o.id)
        )
      ];
      
      console.log(`[Crawler] Found ${opportunities.length} opportunities to refresh (${premiumOpportunities.length} premium, ${highDaOpportunities.length} high-DA, ${regularOpportunities.length} regular)`);
      
      // Process each opportunity
      for (const opportunity of opportunities) {
        try {
          console.log(`[Crawler] Refreshing opportunity: ${opportunity.id} (${opportunity.url}) - ${opportunity.status === 'premium' ? 'PREMIUM' : 'regular'}`);
          
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