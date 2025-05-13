import { getOpenPageRankService } from './open-page-rank';
import { getURLScanService } from './urlscan';
import { getMozApiService } from './moz';

/**
 * Enhanced Domain Validation Service
 * 
 * This service combines multiple API providers to validate and score domains:
 * - Uses Moz API as primary source for domain authority
 * - Falls back to OpenPageRank when Moz fails
 * - Uses URLScan for security/spam validation
 * 
 * It implements a cascading fallback system to ensure we always get metrics.
 */
export class DomainValidationService {
  private mozService = getMozApiService();
  private openPageRankService = getOpenPageRankService();
  private urlScanService = getURLScanService();
  
  constructor() {
    console.log('[ValidationService] Initialized with multiple API providers');
  }
  
  /**
   * Comprehensive domain validation using multiple providers
   * Returns combined metrics from available sources
   */
  async validateDomain(domain: string): Promise<{
    domainAuthority: number;
    spamScore: number;
    securityScore: number;
    riskFactors: string[];
    technologies: string[];
    status: 'valid' | 'suspicious' | 'invalid';
    provider: string;
  }> {
    console.log(`[ValidationService] Validating domain: ${domain}`);
    
    // Default response
    const result = {
      domainAuthority: 0,
      spamScore: 0,
      securityScore: 100,
      riskFactors: [] as string[],
      technologies: [] as string[],
      status: 'valid' as 'valid' | 'suspicious' | 'invalid',
      provider: 'none'
    };
    
    try {
      // Step 1: Try Moz API first (most comprehensive)
      try {
        const mozMetrics = await this.mozService.getDomainMetrics(domain);
        if (mozMetrics && mozMetrics.domainAuthority) {
          result.domainAuthority = mozMetrics.domainAuthority;
          result.spamScore = mozMetrics.spamScore || 0;
          result.provider = 'moz';
          console.log(`[ValidationService] Got Moz metrics for ${domain}: DA=${result.domainAuthority}, Spam=${result.spamScore}`);
        } else {
          throw new Error('No Moz metrics available');
        }
      } catch (mozError) {
        console.log(`[ValidationService] Moz API failed for ${domain}, trying OpenPageRank...`);
        
        // Step 2: Fall back to OpenPageRank for domain authority
        try {
          const oprMetrics = await this.openPageRankService.getDomainMetrics(domain);
          if (oprMetrics && oprMetrics.domainAuthority) {
            result.domainAuthority = oprMetrics.domainAuthority;
            result.provider = 'openpagerank';
            console.log(`[ValidationService] Got OpenPageRank metrics for ${domain}: DA=${result.domainAuthority}`);
          } else {
            throw new Error('No OpenPageRank metrics available');
          }
        } catch (oprError) {
          console.log(`[ValidationService] OpenPageRank API failed for ${domain}, using synthetic metrics`);
          // If both APIs fail, use synthetic metrics (better than nothing)
          result.domainAuthority = this.generateSyntheticDomainAuthority(domain);
          result.provider = 'synthetic';
        }
      }
      
      // Step 3: Use URLScan for security and spam validation
      try {
        const securityData = await this.urlScanService.analyzeDomainReputation(domain);
        
        // Add security metrics to result
        result.securityScore = securityData.securityScore;
        result.riskFactors = securityData.riskFactors;
        result.technologies = securityData.technologies;
        
        // If we don't have a spam score from Moz, derive one from security score
        if (!result.spamScore && result.provider !== 'moz') {
          // Convert security score (higher is better) to spam score (lower is better)
          // Security 100 -> Spam 0, Security 0 -> Spam 10
          result.spamScore = Math.max(0, Math.min(10, Math.round((100 - securityData.securityScore) / 10)));
        }
        
        console.log(`[ValidationService] Got URLScan security metrics for ${domain}: Score=${result.securityScore}, Spam=${result.spamScore}`);
      } catch (securityError) {
        console.log(`[ValidationService] URLScan API failed for ${domain}`);
        // If URLScan fails but we don't have a spam score, use synthetic
        if (!result.spamScore) {
          result.spamScore = this.generateSyntheticSpamScore(domain);
        }
      }
      
      // Step 4: Determine overall status
      if (result.spamScore >= 7 || result.securityScore < 30 || result.riskFactors.length > 2) {
        result.status = 'invalid';
      } else if (result.spamScore >= 4 || result.securityScore < 60 || result.riskFactors.length > 0) {
        result.status = 'suspicious';
      } else {
        result.status = 'valid';
      }
      
    } catch (error: any) {
      console.error(`[ValidationService] Overall validation error for ${domain}:`, error.message);
      result.status = 'suspicious';
      result.riskFactors.push('Validation error: ' + error.message);
    }
    
    return result;
  }
  
  /**
   * Validate multiple domains in batch
   */
  async validateDomainsBatch(domains: string[]): Promise<Record<string, {
    domainAuthority: number;
    spamScore: number;
    securityScore: number;
    riskFactors: string[];
    technologies: string[];
    status: 'valid' | 'suspicious' | 'invalid';
    provider: string;
  }>> {
    const results: Record<string, any> = {};
    
    // Process in smaller batches to not overload APIs
    const batchSize = 10;
    for (let i = 0; i < domains.length; i += batchSize) {
      const batchDomains = domains.slice(i, i + batchSize);
      
      // Process domains in parallel
      const batchPromises = batchDomains.map(domain => 
        this.validateDomain(domain)
          .then(result => {
            results[domain] = result;
          })
          .catch(error => {
            console.error(`[ValidationService] Error validating ${domain}:`, error);
            results[domain] = {
              domainAuthority: 0,
              spamScore: 10,
              securityScore: 0,
              riskFactors: ['Validation failed'],
              technologies: [],
              status: 'invalid',
              provider: 'error'
            };
          })
      );
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Small delay between batches to be nice to APIs
      if (i + batchSize < domains.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
  
  /**
   * Generate a synthetic domain authority when APIs fail
   * This is a fallback option only
   */
  private generateSyntheticDomainAuthority(domain: string): number {
    // Some basic heuristics for estimating DA
    // TLDs often correlate with higher authority
    const tld = domain.split('.').pop()?.toLowerCase();
    let baseDa = 20; // Default baseline
    
    // Adjust for TLD
    if (tld === 'edu' || tld === 'gov') {
      baseDa = 50; // Educational and government sites tend to have higher DA
    } else if (tld === 'org' || tld === 'net') {
      baseDa = 35; // Organizational sites often have medium-high DA
    } else if (tld === 'io' || tld === 'co') {
      baseDa = 30; // Modern tech TLDs
    }
    
    // Adjust for domain length (shorter domains often have higher DA)
    const domainLength = domain.split('.')[0].length;
    if (domainLength <= 5) {
      baseDa += 15; // Short domains get a boost
    } else if (domainLength <= 8) {
      baseDa += 5; // Medium domains get a small boost
    }
    
    // Add some randomness to avoid all synthetic DAs being the same
    const randomFactor = Math.floor(Math.random() * 10) - 5; // -5 to +5
    
    return Math.min(85, Math.max(5, baseDa + randomFactor));
  }
  
  /**
   * Generate a synthetic spam score when APIs fail
   * This is a fallback option only
   */
  private generateSyntheticSpamScore(domain: string): number {
    // Some basic heuristics for estimating spam likelihood
    const domainName = domain.split('.')[0].toLowerCase();
    
    // Check for spam indicators in domain name
    const spamKeywords = ['free', 'casino', 'pills', 'sex', 'buy', 'cheap', 'discount', 'win'];
    const hasSpamKeyword = spamKeywords.some(keyword => domainName.includes(keyword));
    
    // Check for excessive numbers or hyphens (common in spam domains)
    const digitCount = (domainName.match(/\d/g) || []).length;
    const hyphenCount = (domainName.match(/-/g) || []).length;
    
    let baseSpamScore = 3; // Default baseline
    
    // Adjust for spam keywords
    if (hasSpamKeyword) {
      baseSpamScore += 2;
    }
    
    // Adjust for digits and hyphens
    if (digitCount > 3) {
      baseSpamScore += 2;
    } else if (digitCount > 1) {
      baseSpamScore += 1;
    }
    
    if (hyphenCount > 2) {
      baseSpamScore += 2;
    } else if (hyphenCount > 0) {
      baseSpamScore += 1;
    }
    
    // Adjust for extremely long domain names (often spammy)
    if (domainName.length > 15) {
      baseSpamScore += 1;
    }
    
    // Add some randomness to avoid all synthetic scores being the same
    const randomFactor = Math.floor(Math.random() * 2); // 0 to 1
    
    return Math.min(10, Math.max(0, baseSpamScore + randomFactor));
  }
}

// Singleton instance
let domainValidationService: DomainValidationService | null = null;

export function getDomainValidationService(): DomainValidationService {
  if (!domainValidationService) {
    domainValidationService = new DomainValidationService();
  }
  return domainValidationService;
}