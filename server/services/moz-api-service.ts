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
    const signature = crypto.HmacSHA1(stringToSign, this.secretKey).toString(crypto.enc.Base64);
    const token = Buffer.from(`${this.accessId}:${expires}:${signature}`).toString('base64');
    return token;
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

      // Add delay between requests
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Add 1 second delay between requests
      await delay(1000);

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
        // Add retry configuration
        timeout: 5000,
        validateStatus: (status) => status < 500
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
        const token = this.generateAuthToken();

        // Add delay between requests
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Add 1 second delay between requests
        await delay(1000);

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
           // Add retry configuration
          timeout: 5000,
          validateStatus: (status) => status < 500
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
      }

      // Return results in the same order as requested
      return domains.map(domain => results[domain]);
    } catch (error) {
      console.error('[MozAPI] Error in batch domain metrics:', error);
      throw new Error('Failed to fetch batch Moz metrics');
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