import axios from 'axios';

/**
 * OpenPageRank API Service
 * 
 * This service provides domain authority metrics similar to Moz's Domain Authority:
 * - Page Rank scores (0-10 scale)
 * - Domain authority information
 * - Alternative to Moz DA when Moz API is unavailable
 * 
 * Documentation: https://www.domcop.com/openpagerank/documentation
 */
export class OpenPageRankService {
  private apiKey: string;
  private baseUrl = 'https://openpagerank.com/api/v1.0';
  
  constructor() {
    const apiKey = process.env.OPENPAGERANK_API_KEY;
    if (!apiKey) {
      console.warn('[OpenPageRank] API key not found. Some features may be limited.');
      this.apiKey = '';
    } else {
      this.apiKey = apiKey;
    }
  }
  
  /**
   * Get domain metrics for a single domain
   */
  async getDomainMetrics(domain: string): Promise<{
    pageRank: number;
    rank: number;
    domainAuthority: number;
  }> {
    try {
      // Clean the domain to ensure it's in the correct format
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      console.log(`[OpenPageRank] Requesting metrics for domain: ${cleanDomain}`);
      
      const response = await axios.get(`${this.baseUrl}/getPageRank`, {
        params: {
          domains: [cleanDomain]  // Send as array in params for proper URL encoding
        },
        headers: {
          'API-OPR': this.apiKey,
          'Accept': 'application/json'
        }
      });
      
      // Check for valid response
      if (response.data && 
          response.data.status_code === 200 && 
          response.data.response && 
          response.data.response.length > 0) {
        
        const domainData = response.data.response[0];
        
        // Convert page rank (0-10) to domain authority (0-100)
        // PageRank of 6+ is considered very good, so we scale accordingly
        const pageRank = Number(domainData.page_rank_decimal) || 0;
        const calculatedDA = this.convertToDA(pageRank);
        
        console.log(`[OpenPageRank] Successfully got metrics for ${cleanDomain}: PageRank=${pageRank}, DA=${calculatedDA}`);
        
        return {
          pageRank: pageRank,
          rank: Number(domainData.rank) || 0,
          domainAuthority: calculatedDA
        };
      } else {
        console.warn(`[OpenPageRank] No data returned for domain: ${cleanDomain}`);
        return {
          pageRank: 0,
          rank: 0,
          domainAuthority: 0
        };
      }
    } catch (error: any) {
      console.error('[OpenPageRank] Error fetching domain metrics:', error.message);
      // Additional error details for debugging
      if (error.response) {
        console.error(`[OpenPageRank] Status: ${error.response.status}, Data:`, error.response.data);
      }
      
      // Return default values on error
      return {
        pageRank: 0,
        rank: 0,
        domainAuthority: 0
      };
    }
  }
  
  /**
   * Get metrics for multiple domains in a batch
   * OpenPageRank allows up to 100 domains per request
   */
  async getBatchDomainMetrics(domains: string[]): Promise<Record<string, {
    pageRank: number;
    rank: number;
    domainAuthority: number;
  }>> {
    // Limit batch size to 100 domains per request (API limit)
    const batchSize = 25; // Reduced batch size to avoid overloading API
    const results: Record<string, {
      pageRank: number;
      rank: number;
      domainAuthority: number;
    }> = {};
    
    // Clean domains to ensure proper formatting
    const cleanDomains = domains.map(domain => 
      domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    );
    
    console.log(`[OpenPageRank] Processing batch of ${cleanDomains.length} domains`);
    
    // Process domains in batches
    for (let i = 0; i < cleanDomains.length; i += batchSize) {
      const batchDomains = cleanDomains.slice(i, i + batchSize);
      
      // Process each domain individually to ensure higher success rate
      for (const domain of batchDomains) {
        try {
          const metrics = await this.getDomainMetrics(domain);
          results[domain] = metrics;
          
          // Add a small delay between requests to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`[OpenPageRank] Error fetching metrics for domain ${domain}:`, error);
          results[domain] = {
            pageRank: 0,
            rank: 0,
            domainAuthority: 0
          };
        }
      }
      
      // Add delay between batches
      if (i + batchSize < cleanDomains.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
  
  /**
   * Convert OpenPageRank score to equivalent Domain Authority
   * This is an approximation based on typical scale correlations
   */
  convertToDA(pageRank: number): number {
    if (pageRank <= 0) return 0;
    if (pageRank >= 10) return 100;
    
    // Non-linear scaling to better match industry DA patterns
    // Favors higher scores more aggressively
    if (pageRank < 2) {
      return Math.round(pageRank * 5); // 0-10 range
    } else if (pageRank < 4) {
      return Math.round(10 + (pageRank - 2) * 10); // 10-30 range
    } else if (pageRank < 6) {
      return Math.round(30 + (pageRank - 4) * 15); // 30-60 range
    } else {
      return Math.round(60 + (pageRank - 6) * 10); // 60-100 range
    }
  }
}

// Singleton instance
let openPageRankService: OpenPageRankService | null = null;

export function getOpenPageRankService(): OpenPageRankService {
  if (!openPageRankService) {
    openPageRankService = new OpenPageRankService();
  }
  return openPageRankService;
}