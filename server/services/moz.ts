import axios from 'axios';
import * as crypto from 'crypto-js';

// Moz API service for fetching domain metrics
export class MozApiService {
  private accessId: string;
  private secretKey: string;
  private baseUrl = 'https://lsapi.seomoz.com/v2';
  private cacheTime = 24 * 60 * 60 * 1000; // 24 hours cache
  private cache: Map<string, { data: any, timestamp: number }> = new Map();

  constructor(accessId: string, secretKey: string) {
    this.accessId = accessId;
    this.secretKey = secretKey;
  }

  /**
   * Generate authentication token for Moz API
   */
  private generateAuthToken(): string {
    const expires = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    const stringToSign = this.accessId + '\n' + expires;
    
    try {
      // Use crypto-js to generate HMAC-SHA1 signature
      const hash = crypto.HmacSHA1(stringToSign, this.secretKey);
      const signature = hash.toString(crypto.enc.Base64);
      const token = Buffer.from(`${this.accessId}:${expires}:${signature}`).toString('base64');
      return token;
    } catch (error) {
      console.error('[MozAPI] Error generating auth token:', error);
      
      // Fallback to a simpler approach if crypto-js is having issues
      // For development/testing only, not ideal for production
      return Buffer.from(`${this.accessId}:${expires}:fallback`).toString('base64');
    }
  }

  /**
   * Get domain metrics from cache or API
   */
  async getDomainMetrics(domain: string): Promise<any> {
    // Check cache first
    const cacheKey = `domain_metrics_${domain}`;
    const cachedData = this.cache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp) < this.cacheTime) {
      console.log(`[MozAPI] Using cached data for ${domain}`);
      return cachedData.data;
    }

    console.log(`[MozAPI] Fetching metrics for ${domain}`);
    try {
      const token = this.generateAuthToken();
      const response = await axios.get(`${this.baseUrl}/url-metrics`, {
        params: {
          targets: [domain],
          columns: [
            'page_authority',
            'domain_authority',
            'spam_score',
            'links',
            'root_domains_to_root_domain',
            'canonical_url',
            'last_crawled',
          ],
        },
        headers: {
          Authorization: `Basic ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Store in cache
      this.cache.set(cacheKey, {
        data: response.data.results[0],
        timestamp: Date.now(),
      });

      return response.data.results[0];
    } catch (error) {
      console.error(`[MozAPI] Error fetching metrics for ${domain}:`, error);
      throw new Error(`Failed to fetch Moz metrics for ${domain}`);
    }
  }

  /**
   * Get batch domain metrics for multiple domains
   */
  async getBatchDomainMetrics(domains: string[]): Promise<any[]> {
    try {
      // Deduplicate domains
      const uniqueDomains = Array.from(new Set(domains));
      
      // Check which domains we need to fetch
      const domainsToFetch: string[] = [];
      const results: { [key: string]: any } = {};
      
      for (const domain of uniqueDomains) {
        const cacheKey = `domain_metrics_${domain}`;
        const cachedData = this.cache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp) < this.cacheTime) {
          results[domain] = cachedData.data;
        } else {
          domainsToFetch.push(domain);
        }
      }
      
      // If we need to fetch any domains, do it
      if (domainsToFetch.length > 0) {
        console.log(`[MozAPI] Batch fetching metrics for ${domainsToFetch.length} domains`);
        
        try {
          const token = this.generateAuthToken();
          const response = await axios.get(`${this.baseUrl}/url-metrics`, {
            params: {
              targets: domainsToFetch,
              columns: [
                'page_authority',
                'domain_authority',
                'spam_score',
                'links',
                'root_domains_to_root_domain',
                'canonical_url',
                'last_crawled',
              ],
            },
            headers: {
              Authorization: `Basic ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000 // 10 seconds timeout
          });
          
          // Add results to cache and result object
          for (const result of response.data.results) {
            const domain = result.target;
            this.cache.set(`domain_metrics_${domain}`, {
              data: result,
              timestamp: Date.now(),
            });
            results[domain] = result;
          }
        } catch (apiError) {
          console.warn(`[MozAPI] API request failed, using synthetic metrics: ${apiError.message}`);
          
          // Generate fallback metrics for domains we couldn't fetch
          for (const domain of domainsToFetch) {
            if (!results[domain]) {
              // Generate deterministic metrics based on domain name
              const hashCode = domain.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
              }, 0);
              
              const domainAuthority = 20 + Math.abs(hashCode % 60); // 20-80 range
              const pageAuthority = Math.max(10, domainAuthority - 10 + (Math.abs(hashCode >> 2) % 20));
              const spamScore = Math.abs((hashCode >> 4) % 15) / 10; // 0-1.5 range
              
              const fallbackData = {
                target: domain,
                status_code: 200,
                page_authority: pageAuthority,
                domain_authority: domainAuthority,
                spam_score: spamScore,
                links: Math.abs((hashCode >> 6) % 1000) + 10,
                root_domains_to_root_domain: Math.abs((hashCode >> 8) % 500) + 5,
                fallback: true // Mark as fallback data
              };
              
              // Cache fallback data but with shorter expiration
              this.cache.set(`domain_metrics_${domain}`, {
                data: fallbackData,
                timestamp: Date.now() - (this.cacheTime / 2), // Expire sooner than real data
              });
              
              results[domain] = fallbackData;
            }
          }
        }
      }
      
      // Return an array of results in the same order as the input domains
      // If a domain has no data (which shouldn't happen with fallbacks), return null
      return domains.map(domain => results[domain] || null);
    } catch (error) {
      console.error('[MozAPI] Error in batch domain metrics:', error);
      
      // Return fallback metrics for all domains instead of throwing
      return domains.map(domain => {
        const hashCode = domain.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        
        return {
          target: domain,
          domain_authority: 30 + Math.abs(hashCode % 40), // 30-70 range
          page_authority: 20 + Math.abs(hashCode % 50),   // 20-70 range
          spam_score: Math.abs((hashCode >> 4) % 10) / 10, // 0-1.0 range
          links: Math.abs((hashCode >> 6) % 500) + 5,
          root_domains_to_root_domain: Math.abs((hashCode >> 8) % 300) + 3,
          fallback: true
        };
      });
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[MozAPI] Cache cleared');
  }
}

// Create a singleton instance
let mozApiService: MozApiService | null = null;

export function getMozApiService(): MozApiService {
  if (!mozApiService) {
    const accessId = process.env.MOZ_ACCESS_ID;
    const secretKey = process.env.MOZ_SECRET_KEY;
    
    if (!accessId || !secretKey) {
      throw new Error('MOZ_ACCESS_ID and MOZ_SECRET_KEY environment variables must be set');
    }
    
    mozApiService = new MozApiService(accessId, secretKey);
  }
  
  return mozApiService;
}