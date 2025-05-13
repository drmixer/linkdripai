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
      const response = await axios.get(`${this.baseUrl}/getPageRank`, {
        params: {
          domains: domain
        },
        headers: {
          'API-OPR': this.apiKey
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
        const calculatedDA = Math.min(100, Math.round(pageRank * 10));
        
        return {
          pageRank: pageRank,
          rank: Number(domainData.rank) || 0,
          domainAuthority: calculatedDA
        };
      } else {
        console.warn(`[OpenPageRank] No data returned for domain: ${domain}`);
        return {
          pageRank: 0,
          rank: 0,
          domainAuthority: 0
        };
      }
    } catch (error: any) {
      console.error('[OpenPageRank] Error fetching domain metrics:', error.message);
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
    const batchSize = 100;
    const results: Record<string, {
      pageRank: number;
      rank: number;
      domainAuthority: number;
    }> = {};
    
    // Process domains in batches
    for (let i = 0; i < domains.length; i += batchSize) {
      const batchDomains = domains.slice(i, i + batchSize);
      try {
        const response = await axios.get(`${this.baseUrl}/getPageRank`, {
          params: {
            domains: batchDomains.join(',')
          },
          headers: {
            'API-OPR': this.apiKey
          }
        });
        
        // Process response
        if (response.data && 
            response.data.status_code === 200 && 
            response.data.response) {
          
          response.data.response.forEach((domainData: any) => {
            const domain = domainData.domain;
            const pageRank = Number(domainData.page_rank_decimal) || 0;
            const calculatedDA = Math.min(100, Math.round(pageRank * 10));
            
            results[domain] = {
              pageRank: pageRank,
              rank: Number(domainData.rank) || 0,
              domainAuthority: calculatedDA
            };
          });
        }
      } catch (error: any) {
        console.error(`[OpenPageRank] Error fetching batch metrics (domains ${i} to ${i + batchSize}):`, error.message);
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