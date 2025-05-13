import axios from 'axios';

/**
 * URLScan.io API Service
 * 
 * This service provides website scanning and security analysis features:
 * - Content scanning to identify potential spam/security risks
 * - Link extraction to find additional opportunities
 * - Website categorization and classification
 * 
 * Documentation: https://urlscan.io/docs/api/
 */
export class URLScanService {
  private apiKey: string;
  private baseUrl = 'https://urlscan.io/api/v1';
  
  constructor() {
    const apiKey = process.env.URLSCAN_API_KEY;
    if (!apiKey) {
      console.warn('[URLScan] API key not found. Some features may be limited.');
      this.apiKey = '';
    } else {
      this.apiKey = apiKey;
    }
  }
  
  /**
   * Submit a URL for scanning
   * This initiates an asynchronous scan
   */
  async submitScan(url: string, tags?: string[]): Promise<{ uuid: string, message: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/scan/`,
        { 
          url, 
          visibility: 'public',
          tags: tags || []
        },
        {
          headers: {
            'API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return {
        uuid: response.data.uuid,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('[URLScan] Error submitting scan:', error.message);
      throw new Error(`Failed to submit URL for scanning: ${error.message}`);
    }
  }
  
  /**
   * Retrieve scan results by UUID
   */
  async getScanResult(uuid: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/result/${uuid}/`, {
        headers: {
          'API-Key': this.apiKey
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('[URLScan] Error retrieving scan results:', error.message);
      throw new Error(`Failed to retrieve scan results: ${error.message}`);
    }
  }
  
  /**
   * Search for existing scans
   */
  async search(query: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/search/?q=${encodeURIComponent(query)}`, {
        headers: {
          'API-Key': this.apiKey
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('[URLScan] Error searching:', error.message);
      throw new Error(`Failed to search URLScan: ${error.message}`);
    }
  }
  
  /**
   * Analyze domain reputation and security risks
   * 
   * This method checks if a domain has any security flags or is potentially spammy
   * Results include:
   * - Malicious content detection
   * - Safe browsing flags
   * - Suspicious technologies
   * - Threat indicators
   */
  async analyzeDomainReputation(domain: string): Promise<{
    malicious: boolean;
    securityScore: number;
    riskFactors: string[];
    technologies: string[];
  }> {
    try {
      // Clean the domain to ensure it's in the correct format
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      console.log(`[URLScan] Analyzing domain reputation for: ${cleanDomain}`);
      
      // First, check for existing scans - this is the fastest path
      try {
        const searchResults = await this.search(`domain:${cleanDomain}`);
        
        // If there are recent results, use the most recent one
        if (searchResults.results && searchResults.results.length > 0) {
          console.log(`[URLScan] Found existing scan for ${cleanDomain}`);
          const latestResult = searchResults.results[0];
          return this.processSecurityData(latestResult);
        }
      } catch (searchError) {
        console.warn(`[URLScan] Search failed for ${cleanDomain}, will try submitting a new scan:`, searchError.message);
      }
      
      // If search fails or no existing scan, create a new one
      // But with a 10% chance to save API usage
      if (Math.random() > 0.9) {
        try {
          console.log(`[URLScan] No existing scan for ${cleanDomain}, submitting new scan`);
          const submission = await this.submitScan(`https://${cleanDomain}`);
          
          // Wait for scan to complete (could take 30+ seconds)
          // Using a shorter timeout to prevent API slowdown
          console.log(`[URLScan] Scan submitted for ${cleanDomain}, waiting for results`);
          await new Promise(resolve => setTimeout(resolve, 30000));
          
          try {
            const result = await this.getScanResult(submission.uuid);
            return this.processSecurityData(result);
          } catch (resultError) {
            console.warn(`[URLScan] Failed to get scan result for ${cleanDomain}:`, resultError.message);
            throw new Error('Scan result retrieval failed');
          }
        } catch (scanError) {
          console.warn(`[URLScan] Scan submission failed for ${cleanDomain}:`, scanError.message);
          throw new Error('Scan submission failed');
        }
      } else {
        console.log(`[URLScan] Skipping new scan for ${cleanDomain} to conserve API usage`);
        throw new Error('Scan skipped to conserve API usage');
      }
    } catch (error: any) {
      console.error('[URLScan] Error analyzing domain reputation:', error.message);
      
      // Use domain name analysis for basic security heuristics
      const domainParts = domain.split('.');
      const domainName = domainParts[0].toLowerCase();
      
      // Very basic heuristics for suspicious domains
      const suspiciousWords = ['free', 'win', 'casino', 'prize', 'viagra', 'pills'];
      const hasSuspiciousWord = suspiciousWords.some(word => domainName.includes(word));
      const hasExcessiveHyphens = (domainName.match(/-/g) || []).length > 2;
      const hasExcessiveNumbers = (domainName.match(/\d/g) || []).length > 4;
      const isTooLong = domainName.length > 25;
      
      // Calculate a basic security score
      let securityScore = 80; // Start with a reasonable default
      let riskFactors: string[] = [];
      
      if (hasSuspiciousWord) {
        securityScore -= 20;
        riskFactors.push('Contains suspicious keywords');
      }
      
      if (hasExcessiveHyphens) {
        securityScore -= 15;
        riskFactors.push('Excessive hyphens in domain name');
      }
      
      if (hasExcessiveNumbers) {
        securityScore -= 15;
        riskFactors.push('Excessive numbers in domain name');
      }
      
      if (isTooLong) {
        securityScore -= 10;
        riskFactors.push('Unusually long domain name');
      }
      
      // Ensure score stays within bounds
      securityScore = Math.max(0, Math.min(100, securityScore));
      
      // If no risk factors identified, provide generic message
      if (riskFactors.length === 0) {
        riskFactors.push('Unable to scan domain');
      }
      
      // Return fallback security assessment
      return {
        malicious: securityScore < 40,
        securityScore,
        riskFactors,
        technologies: []
      };
    }
  }
  
  /**
   * Process security data from scan results
   */
  private processSecurityData(data: any): {
    malicious: boolean;
    securityScore: number;
    riskFactors: string[];
    technologies: string[];
  } {
    // Default values
    const result = {
      malicious: false,
      securityScore: 100,
      riskFactors: [] as string[],
      technologies: [] as string[]
    };
    
    try {
      // Process verdicts (if available)
      if (data.verdicts) {
        if (data.verdicts.overall) {
          result.malicious = data.verdicts.overall.malicious;
          
          // Add score reduction for malicious content
          if (result.malicious) {
            result.securityScore -= 50;
            result.riskFactors.push('Site flagged as malicious');
          }
          
          // Add any categories as risk factors
          if (data.verdicts.overall.categories && data.verdicts.overall.categories.length > 0) {
            data.verdicts.overall.categories.forEach((category: string) => {
              result.riskFactors.push(`Category: ${category}`);
              result.securityScore -= 10; // Reduce score for each risk category
            });
          }
        }
      }
      
      // Extract technologies
      if (data.page && data.page.technologies) {
        result.technologies = data.page.technologies.map((tech: any) => tech.name || 'Unknown');
      }
      
      // Check for suspicious links
      if (data.links && data.links.length > 0) {
        const suspiciousLinkCount = data.links.filter((link: any) => 
          link.malicious || 
          (link.domains && link.domains.some((domain: any) => domain.malicious))
        ).length;
        
        if (suspiciousLinkCount > 0) {
          result.riskFactors.push(`Contains ${suspiciousLinkCount} suspicious links`);
          result.securityScore -= Math.min(30, suspiciousLinkCount * 5);
        }
      }
      
      // Ensure score stays in 0-100 range
      result.securityScore = Math.max(0, Math.min(100, result.securityScore));
      
    } catch (error) {
      console.error('[URLScan] Error processing security data:', error);
    }
    
    return result;
  }
}

// Singleton instance
let urlScanService: URLScanService | null = null;

export function getURLScanService(): URLScanService {
  if (!urlScanService) {
    urlScanService = new URLScanService();
  }
  return urlScanService;
}