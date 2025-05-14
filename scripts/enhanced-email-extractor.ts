/**
 * Enhanced Email Extractor - combines multiple free techniques for better email discovery
 * 
 * Techniques used:
 * 1. Email pattern permutation with SMTP verification
 * 2. Enhanced WHOIS data mining
 * 3. Improved crawler for obfuscated emails
 * 4. GitHub repository mining
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, sql, and, isNotNull } from 'drizzle-orm';
import * as schema from '../shared/schema';
import ws from 'ws';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as dns from 'dns';
import * as net from 'net';
import { URL } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

// Constants
const MAX_RETRIES = 3;
const THROTTLE_DELAY = 3000; // 3 seconds between requests to same domain
const REQUEST_TIMEOUT = 10000; // 10 seconds
const BATCH_SIZE = 5;
const BATCH_DELAY = 8000; // 8 seconds between batches
const SMTP_CHECK_TIMEOUT = 5000; // 5 seconds for SMTP verification

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

// Set timeout globally for axios
axios.defaults.timeout = REQUEST_TIMEOUT;

// Domain request tracking for throttling
const domainLastRequestTime: Record<string, number> = {};

// User agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
];

// Email formats to try
const EMAIL_FORMATS = [
  '{firstName}@{domain}',
  '{lastName}@{domain}',
  '{firstName}.{lastName}@{domain}',
  '{firstInitial}{lastName}@{domain}',
  '{firstInitial}.{lastName}@{domain}',
  '{firstName}{lastInitial}@{domain}',
  '{firstName}_{lastName}@{domain}',
  'contact@{domain}',
  'hello@{domain}',
  'info@{domain}',
  'support@{domain}',
  'admin@{domain}',
  'sales@{domain}',
  'marketing@{domain}',
  'pr@{domain}',
  'media@{domain}',
  'help@{domain}',
  'team@{domain}',
  'webmaster@{domain}',
  'editor@{domain}',
  'careers@{domain}'
];

// Interface for contact information
interface ContactInfo {
  emails: string[];
  socialProfiles: Array<{
    platform: string;
    url: string;
    username: string;
    displayName?: string;
  }>;
  contactForms: string[];
  phoneNumbers?: string[];
  contactPerson?: {
    name?: string;
    title?: string;
    department?: string;
  };
  extractionDetails: {
    normalized: boolean;
    source: string;
    version: string;
    lastUpdated: string;
  };
}

/**
 * Get a random user agent from the list
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Check if we should throttle requests to a domain to avoid rate limiting
 * @param domain The domain to check
 */
function shouldThrottleDomain(domain: string): boolean {
  const now = Date.now();
  const rootDomain = extractRootDomain(domain);
  
  if (domainLastRequestTime[rootDomain]) {
    if (now - domainLastRequestTime[rootDomain] < THROTTLE_DELAY) {
      return true;
    }
  }
  
  domainLastRequestTime[rootDomain] = now;
  return false;
}

/**
 * Extract root domain from a domain name
 * This helps prevent different subdomains of the same site from bypassing throttling
 */
function extractRootDomain(domain: string): string {
  // Remove any subdomains, keeping just the main domain and TLD
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  
  // Handle cases like co.uk, com.au
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if ((sld === 'co' || sld === 'com' || sld === 'org' || sld === 'net' || sld === 'edu' || sld === 'gov') &&
      parts.length > 2) {
    return parts.slice(-3).join('.');
  }
  
  return parts.slice(-2).join('.');
}

/**
 * Clean up a URL to ensure it's in a standard format
 */
function cleanupUrl(url: string): string {
  // Make sure URL has a scheme
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch (error) {
    return url;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (error) {
    // If the URL is invalid, try to extract the domain directly
    url = url.trim().toLowerCase();
    
    // Remove protocol
    url = url.replace(/^(https?:\/\/)?(www\.)?/, '');
    
    // Remove path and query parameters
    url = url.split('/')[0].split('?')[0].split('#')[0];
    
    return url;
  }
}

/**
 * Fetch HTML content from a URL with advanced retrying and rate limiting
 * @param url The URL to fetch
 * @param maxRetries Maximum number of retry attempts
 */
async function fetchHtml(url: string, maxRetries = MAX_RETRIES): Promise<string | null> {
  url = cleanupUrl(url);
  const domain = extractDomain(url);
  
  // Check if we need to throttle this domain
  if (shouldThrottleDomain(domain)) {
    console.log(`Throttling request to ${domain}, waiting ${THROTTLE_DELAY}ms`);
    await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY));
  }
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Rotate user agents to avoid detection
      const randomUserAgent = getRandomUserAgent();
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': randomUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: REQUEST_TIMEOUT
      });
      
      if (response.status === 200) {
        return response.data;
      }
    } catch (error: any) {
      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const backoffTime = Math.min(1000 * (2 ** attempt) * (0.5 + Math.random()), 10000);
        console.log(`Retry ${attempt + 1}/${maxRetries} for ${url} after ${backoffTime}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        console.log(`Failed to fetch ${url} after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  
  return null;
}

/**
 * Extract emails with enhanced pattern recognition including obfuscated emails
 * @param html The HTML content to search for emails
 */
function extractEmailsFromHtml(html: string): string[] {
  const emails: Set<string> = new Set();
  
  // Regular email regex - basic pattern
  const basicEmailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  
  // Match emails in the HTML
  const basicMatches = html.match(basicEmailRegex) || [];
  basicMatches.forEach(email => emails.add(email.toLowerCase()));
  
  // Look for obfuscated emails with [at] and [dot]
  const obfuscatedRegex = /\b[A-Za-z0-9._%+-]+(?:\s*\[\s*at\s*\]|\s*\(\s*at\s*\)|\s*@\s*|\s+at\s+)\s*[A-Za-z0-9.-]+(?:\s*\[\s*dot\s*\]|\s*\(\s*dot\s*\)|\s*\.\s*|\s+dot\s+)\s*[A-Za-z]{2,}\b/gi;
  const obfuscatedMatches = html.match(obfuscatedRegex) || [];
  
  // Clean up obfuscated emails
  obfuscatedMatches.forEach(match => {
    const cleaned = match
      .replace(/\s+/g, '')
      .replace(/\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+/gi, '@')
      .replace(/\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+/gi, '.')
      .toLowerCase();
    
    // Verify it matches a proper email pattern now
    if (basicEmailRegex.test(cleaned)) {
      emails.add(cleaned);
    }
  });
  
  // Look for JS obfuscated emails (common patterns)
  // Example: var email = 'user' + '@' + 'domain.com';
  const jsObfuscatedRegex = /'([^']+)'\s*\+\s*'@'\s*\+\s*'([^']+)'/g;
  const jsMatches = html.match(jsObfuscatedRegex) || [];
  
  jsMatches.forEach(match => {
    try {
      // Extract the parts and combine them
      const parts = match.match(/'([^']+)'/g) || [];
      if (parts.length >= 3) {
        const emailParts = parts.map(p => p.replace(/'/g, ''));
        const email = emailParts.join('').replace(/\+@\+/, '@').toLowerCase();
        
        // Verify it matches a proper email pattern
        if (basicEmailRegex.test(email)) {
          emails.add(email);
        }
      }
    } catch (e) {
      // Skip this match if it can't be processed
    }
  });
  
  // Look for HTML entity encoded emails
  // Find potential encoded parts
  const encodedRegex = /&#[0-9]+;/g;
  if (encodedRegex.test(html)) {
    // If we find encoded characters, decode the entire HTML and look for emails again
    try {
      const decoded = html.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
      const decodedMatches = decoded.match(basicEmailRegex) || [];
      decodedMatches.forEach(email => emails.add(email.toLowerCase()));
    } catch (e) {
      // Skip if decoding fails
    }
  }
  
  // Exclude common false positives
  const excludePatterns = [
    /example\.com$/,
    /domain\.com$/,
    /yourdomain\.com$/,
    /test\.com$/,
    /email\.com$/,
  ];
  
  return Array.from(emails).filter(email => 
    !excludePatterns.some(pattern => pattern.test(email)) &&
    // Make sure we have both an @ and a dot after it
    email.includes('@') && email.indexOf('.', email.indexOf('@')) > -1
  );
}

/**
 * Find all potential pages that might contain contact info
 */
async function findContactPages(baseUrl: string): Promise<string[]> {
  const contactUrls: Set<string> = new Set();
  
  try {
    // Clean up base URL
    baseUrl = cleanupUrl(baseUrl);
    const domain = extractDomain(baseUrl);
    
    // Get the base site HTML
    const html = await fetchHtml(baseUrl);
    if (!html) return Array.from(contactUrls);
    
    const $ = cheerio.load(html);
    
    // Look for contact page links with common patterns
    const contactKeywords = [
      'contact', 'about', 'team', 'staff', 'people', 'meet', 
      'connect', 'reach', 'get in touch', 'talk to', 'email us',
      'support', 'help', 'kontakt', 'contacto', 'about-us', 'about us'
    ];
    
    // Helper to check if href is a valid URL
    const isValidUrl = (href: string): boolean => {
      if (!href) return false;
      // Skip anchors and javascript links
      if (href.startsWith('#') || href.startsWith('javascript:')) return false;
      // Skip phone links and mailto links
      if (href.startsWith('tel:') || href.startsWith('mailto:')) return false;
      return true;
    };
    
    // Find all anchor links that might be contact pages
    $('a').each((_, element) => {
      const link = $(element);
      const href = link.attr('href');
      const text = link.text().toLowerCase().trim();
      
      if (!isValidUrl(href!)) return;
      
      // Check if the link text contains contact keywords
      if (contactKeywords.some(keyword => text.includes(keyword))) {
        try {
          let fullUrl = href;
          // If it's a relative URL, make it absolute
          if (!href!.startsWith('http')) {
            const parsedBaseUrl = new URL(baseUrl);
            fullUrl = href!.startsWith('/') 
              ? `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}${href}`
              : `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}/${href}`;
          }
          
          // Skip if it's not the same domain
          const linkDomain = extractDomain(fullUrl!);
          if (!linkDomain.includes(domain) && !domain.includes(linkDomain)) return;
          
          contactUrls.add(fullUrl!);
        } catch (e) {
          // Skip malformed URLs
        }
      }
    });
    
    // Also check some common contact page paths
    const commonPaths = [
      '/contact', '/contact-us', '/about', '/about-us', '/team', 
      '/our-team', '/people', '/staff', '/company', '/support'
    ];
    
    for (const path of commonPaths) {
      try {
        const parsedBaseUrl = new URL(baseUrl);
        const fullUrl = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}${path}`;
        
        // Don't add if we already have it
        if (Array.from(contactUrls).some(url => url.includes(path))) continue;
        
        // Check if the page exists
        const response = await axios.head(fullUrl, { 
          validateStatus: status => status < 400,
          timeout: 5000 
        });
        
        if (response.status < 400) {
          contactUrls.add(fullUrl);
        }
      } catch (e) {
        // Skip failed URLs
      }
    }
  } catch (error) {
    console.error(`Error finding contact pages for ${baseUrl}:`, error);
  }
  
  return Array.from(contactUrls);
}

/**
 * Extract employee names and potential titles from about/team pages
 */
async function extractTeamMembers(url: string): Promise<{ 
  name: string, 
  title?: string,
  department?: string
}[]> {
  const teamMembers: { name: string, title?: string, department?: string }[] = [];
  
  try {
    const html = await fetchHtml(url);
    if (!html) return teamMembers;
    
    const $ = cheerio.load(html);
    
    // Look for team member sections - these often have certain patterns
    // Common class and ID patterns for team sections
    const teamSelectors = [
      '.team', '.team-members', '.team-member', '.staff', '.people', 
      '.crew', '.employee', '.employees', '.our-team', '.about-team',
      '#team', '#our-team', '#staff', '#people', '[data-team]',
      '.leadership', '.executive', '.executives'
    ];
    
    // Find all potential team member containers
    let teamContainers = $(teamSelectors.join(', '));
    
    // If no specific team containers, look for common person patterns
    if (teamContainers.length === 0) {
      const personSelectors = [
        '.person', '.member', '.profile', '.bio', '.card',
        '.profile-card', '.team-card', '.member-card', '.profile-box'
      ];
      teamContainers = $(personSelectors.join(', '));
    }
    
    // If still no containers, use the whole page but look for structured patterns
    if (teamContainers.length === 0) {
      // Look for name-looking structures
      $('h2, h3, h4, h5, strong, b').each((_, element) => {
        const $el = $(element);
        const name = $el.text().trim();
        
        // Skip short or long names, or elements with lots of content
        if (name.length < 5 || name.length > 50) return;
        if (name.includes('\n')) return;
        
        // Skip elements with HTML tags inside (likely not a simple name)
        if ($el.html()!.includes('<')) return;
        
        // Look for a nearby position or title
        let title = '';
        let nextElement = $el.next();
        
        // Check the next couple of elements for a potential title
        for (let i = 0; i < 3; i++) {
          if (!nextElement.length) break;
          
          // Skip elements with HTML tags inside (complex structure)
          if (nextElement.html()!.includes('<')) {
            nextElement = nextElement.next();
            continue;
          }
          
          const text = nextElement.text().trim();
          
          // Title is usually shorter text, not too many symbols
          if (text && text.length > 0 && text.length < 100 && !/[\\/$%#@!)(&+=]/.test(text)) {
            title = text;
            break;
          }
          
          nextElement = nextElement.next();
        }
        
        // Extract potential department from the title
        let department: string | undefined;
        const departmentKeywords = ['marketing', 'sales', 'engineering', 'product', 'design', 'hr', 
                                    'finance', 'operations', 'support', 'development', 'content'];
                                    
        for (const keyword of departmentKeywords) {
          if (title.toLowerCase().includes(keyword)) {
            department = keyword;
            break;
          }
        }
        
        teamMembers.push({ name, title, department });
      });
    } else {
      // Process each team container to extract members
      teamContainers.each((_, container) => {
        const $container = $(container);
        
        // Look for name elements within the container
        const nameElements = $container.find('h2, h3, h4, h5, .name, .member-name, strong');
        
        nameElements.each((_, nameEl) => {
          const $nameEl = $(nameEl);
          const name = $nameEl.text().trim();
          
          // Skip if too short or too long
          if (name.length < 5 || name.length > 50) return;
          
          // Look for a title or position near the name
          let title: string | undefined;
          
          // Check elements with common title classes
          const $titleEl = $container.find('.title, .position, .job-title, .role');
          if ($titleEl.length > 0) {
            title = $titleEl.text().trim();
          }
          
          // If no specific title class, check siblings or nearby elements
          if (!title) {
            const siblings = $nameEl.siblings('p, div, span').slice(0, 2);
            siblings.each((_, sibling) => {
              const siblingText = $(sibling).text().trim();
              if (siblingText && siblingText.length > 0 && siblingText.length < 100) {
                title = siblingText;
                return false; // break the each loop
              }
            });
          }
          
          // Extract potential department from the title
          let department: string | undefined;
          if (title) {
            const departmentKeywords = ['marketing', 'sales', 'engineering', 'product', 'design', 'hr', 
                                        'finance', 'operations', 'support', 'development', 'content'];
                                        
            for (const keyword of departmentKeywords) {
              if (title.toLowerCase().includes(keyword)) {
                department = keyword;
                break;
              }
            }
          }
          
          teamMembers.push({ name, title, department });
        });
      });
    }
    
  } catch (error) {
    console.error(`Error extracting team members from ${url}:`, error);
  }
  
  return teamMembers;
}

/**
 * Enhanced extraction of WHOIS data from domain
 */
async function extractWhoisEmails(domain: string): Promise<string[]> {
  const emails: Set<string> = new Set();
  
  try {
    // Use the whois command line utility to get all data
    const execPromise = promisify(exec);
    const { stdout } = await execPromise(`whois ${domain}`);
    
    // Extract emails from the output with a comprehensive regex
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const matches = stdout.match(emailRegex) || [];
    
    // Filter out privacy protection emails
    matches.forEach(email => {
      const lowerEmail = email.toLowerCase();
      
      // Skip privacy protection service emails
      if (
        lowerEmail.includes('privacy') || 
        lowerEmail.includes('protect') || 
        lowerEmail.includes('redact') ||
        lowerEmail.includes('gdpr') ||
        lowerEmail.includes('proxy') ||
        lowerEmail.includes('private')
      ) {
        return;
      }
      
      emails.add(lowerEmail);
    });
  } catch (error) {
    console.error(`Error extracting WHOIS data for ${domain}:`, error);
  }
  
  return Array.from(emails);
}

/**
 * Generate email permutations for team members
 */
function generateEmailPermutations(domain: string, teamMembers: { name: string, title?: string }[]): string[] {
  const permutations: Set<string> = new Set();
  
  for (const member of teamMembers) {
    // Skip if name is not valid
    if (!member.name || member.name.trim().length < 3) continue;
    
    // Split name into parts
    const nameParts = member.name.split(' ').filter(part => part.trim().length > 0);
    if (nameParts.length < 1) continue;
    
    const firstName = nameParts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const lastName = nameParts.length > 1 ? 
      nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const firstInitial = firstName.charAt(0);
    const lastInitial = lastName.charAt(0);
    
    // Skip if name parts are too short after cleaning
    if (firstName.length < 2) continue;
    
    // Generate permutations based on the templates
    for (const format of EMAIL_FORMATS) {
      let email = format
        .replace('{firstName}', firstName)
        .replace('{lastName}', lastName)
        .replace('{firstInitial}', firstInitial)
        .replace('{lastInitial}', lastInitial)
        .replace('{domain}', domain);
      
      // Skip incomplete templates (e.g. if lastName is empty but template requires it)
      if (email.includes('{') || email.includes('}')) continue;
      
      permutations.add(email);
    }
  }
  
  // Generate generic emails if we have no team members
  if (teamMembers.length === 0) {
    for (const format of EMAIL_FORMATS) {
      // Skip formats that require name parts
      if (format.includes('{firstName}') || 
          format.includes('{lastName}') || 
          format.includes('{firstInitial}') || 
          format.includes('{lastInitial}')) {
        continue;
      }
      
      const email = format.replace('{domain}', domain);
      permutations.add(email);
    }
  }
  
  return Array.from(permutations);
}

/**
 * Basic SMTP verification to check if an email exists
 * This checks if the domain has MX records and if the email is accepted
 */
async function verifyEmailWithSmtp(email: string): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const domain = email.split('@')[1];
      if (!domain) {
        resolve(false);
        return;
      }
      
      // First, check if domain has MX records
      dns.resolveMx(domain, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) {
          resolve(false);
          return;
        }
        
        // Sort MX records by priority (lowest first)
        addresses.sort((a, b) => a.priority - b.priority);
        const mxRecord = addresses[0].exchange;
        
        // Try to connect to the mail server
        const socket = new net.Socket();
        let responseBuffer = '';
        let connected = false;
        
        // Set a timeout to prevent hanging
        socket.setTimeout(SMTP_CHECK_TIMEOUT);
        
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        
        socket.on('data', (data) => {
          responseBuffer += data.toString();
          
          // Check the response code
          if (responseBuffer.includes('220') && !connected) {
            // Send HELO
            socket.write(`HELO example.com\r\n`);
            connected = true;
            responseBuffer = '';
          } else if (responseBuffer.includes('250') && connected) {
            // HELO was successful, now check RCPT TO
            socket.write(`MAIL FROM: <verify@example.com>\r\n`);
            responseBuffer = '';
          } else if (responseBuffer.includes('250') && responseBuffer.includes('MAIL')) {
            // MAIL FROM was successful, try RCPT TO
            socket.write(`RCPT TO: <${email}>\r\n`);
            responseBuffer = '';
          } else if (responseBuffer.includes('250') && responseBuffer.includes('RCPT')) {
            // Email exists
            socket.destroy();
            resolve(true);
          } else if (responseBuffer.includes('550') || responseBuffer.includes('553') || responseBuffer.includes('554')) {
            // Email doesn't exist
            socket.destroy();
            resolve(false);
          }
        });
        
        socket.connect(25, mxRecord);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Check GitHub for potential contact information
 */
async function checkGitHubForEmails(domain: string): Promise<string[]> {
  const emails: Set<string> = new Set();
  
  try {
    // Simplify the domain name for GitHub search
    const simpleDomain = domain.replace(/^www\./, '').split('.')[0];
    
    // Search for organization or user repositories
    const searchUrl = `https://api.github.com/search/repositories?q=org:${simpleDomain}+fork:true`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': getRandomUserAgent()
      }
    });
    
    if (response.data && response.data.items && response.data.items.length > 0) {
      // Take the top 3 repositories
      const repos = response.data.items.slice(0, 3);
      
      for (const repo of repos) {
        // Check the repository README for contact information
        const readmeUrl = `https://api.github.com/repos/${repo.full_name}/readme`;
        
        try {
          const readmeResponse = await axios.get(readmeUrl, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': getRandomUserAgent()
            }
          });
          
          if (readmeResponse.data && readmeResponse.data.content) {
            // Decode the Base64 encoded content
            const content = Buffer.from(readmeResponse.data.content, 'base64').toString('utf8');
            
            // Extract emails from the README
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
            const matches = content.match(emailRegex) || [];
            
            matches.forEach(email => emails.add(email.toLowerCase()));
          }
        } catch (error) {
          // Skip errors for individual repos
        }
      }
    }
  } catch (error) {
    console.error(`Error checking GitHub for ${domain}:`, error);
  }
  
  return Array.from(emails);
}

/**
 * Main function to run the enhanced email extraction process
 */
export async function runEnhancedEmailExtraction(options: {
  skipPremium?: boolean;
  onlyPremium?: boolean;
  limit?: number;
  dryRun?: boolean;
} = {}) {
  console.log('🌐 Starting enhanced email extraction...');
  console.log('Using multiple techniques:');
  console.log('1. Email pattern permutation with SMTP verification');
  console.log('2. Enhanced WHOIS data mining');
  console.log('3. Improved crawler for obfuscated emails');
  console.log('4. GitHub repository mining');
  
  try {
    // Build the query for opportunities
    let query = db.select()
      .from(schema.discoveredOpportunities)
      .where(
        and(
          // Only select opportunities with contact info but no emails
          isNotNull(schema.discoveredOpportunities.contactInfo),
          sql`(("contactInfo"::jsonb->'emails' IS NULL OR jsonb_array_length("contactInfo"::jsonb->'emails') = 0))`
        )
      );
    
    // Add premium filter if specified
    if (options.skipPremium) {
      query = query.where(eq(schema.discoveredOpportunities.isPremium, false));
    }
    
    if (options.onlyPremium) {
      query = query.where(eq(schema.discoveredOpportunities.isPremium, true));
    }
    
    // Add limit if specified
    if (options.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(50); // Default limit
    }
    
    // Execute the query
    const opportunities = await query;
    
    console.log(`Found ${opportunities.length} opportunities to enhance with email information`);
    
    if (opportunities.length === 0) {
      console.log('No opportunities need email enhancement');
      return;
    }
    
    // Process in batches
    const batchSize = BATCH_SIZE;
    let successCount = 0;
    let totalEmailsFound = 0;
    
    for (let i = 0; i < opportunities.length; i += batchSize) {
      const batch = opportunities.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(opportunities.length/batchSize)}`);
      
      for (const opportunity of batch) {
        try {
          console.log(`\nProcessing opportunity: ${opportunity.domain} (ID: ${opportunity.id})`);
          
          // Extract and clean domain
          const domain = opportunity.domain.replace(/^www\./, '');
          
          // Parse existing contact info
          let contactInfo: ContactInfo;
          
          try {
            if (typeof opportunity.contactInfo === 'string') {
              // Handle doubly-escaped JSON
              if (opportunity.contactInfo.startsWith('"') && opportunity.contactInfo.endsWith('"')) {
                const unquoted = opportunity.contactInfo.slice(1, -1);
                const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                contactInfo = JSON.parse(unescaped);
              } else {
                contactInfo = JSON.parse(opportunity.contactInfo);
              }
            } else {
              contactInfo = opportunity.contactInfo as ContactInfo;
            }
          } catch (e) {
            // Initialize new contact info if parsing fails
            contactInfo = {
              emails: [],
              socialProfiles: [],
              contactForms: [],
              extractionDetails: {
                normalized: true,
                source: 'enhanced-email-extractor',
                version: '1.0',
                lastUpdated: new Date().toISOString()
              }
            };
          }
          
          // Make sure all arrays exist
          contactInfo.emails = contactInfo.emails || [];
          contactInfo.socialProfiles = contactInfo.socialProfiles || [];
          contactInfo.contactForms = contactInfo.contactForms || [];
          
          // Initialize or update extraction details
          contactInfo.extractionDetails = {
            normalized: true,
            source: 'enhanced-email-extractor',
            version: '1.0',
            lastUpdated: new Date().toISOString()
          };
          
          // Set for storing unique emails
          const emailsFound: Set<string> = new Set();
          
          // 1. Technique: Crawl the website and scrape for emails
          console.log('Crawling website for emails...');
          
          // Get the base URL
          let baseUrl = opportunity.url;
          if (!baseUrl) {
            baseUrl = `https://${domain}`;
          }
          
          // Crawl the main page
          const mainHtml = await fetchHtml(baseUrl);
          if (mainHtml) {
            const mainEmails = extractEmailsFromHtml(mainHtml);
            mainEmails.forEach(email => emailsFound.add(email));
          }
          
          // Find and crawl contact pages
          const contactPages = await findContactPages(baseUrl);
          console.log(`Found ${contactPages.length} potential contact pages`);
          
          for (const contactUrl of contactPages) {
            console.log(`Checking ${contactUrl}`);
            const contactHtml = await fetchHtml(contactUrl);
            if (contactHtml) {
              const contactEmails = extractEmailsFromHtml(contactHtml);
              contactEmails.forEach(email => emailsFound.add(email));
              
              // Extract team members for email permutation
              if (emailsFound.size === 0) {
                console.log('No emails found yet, extracting team members...');
                const teamMembers = await extractTeamMembers(contactUrl);
                console.log(`Found ${teamMembers.length} team members`);
                
                if (teamMembers.length > 0) {
                  // Store the first team member as the contact person
                  contactInfo.contactPerson = {
                    name: teamMembers[0].name,
                    title: teamMembers[0].title,
                    department: teamMembers[0].department
                  };
                }
              }
            }
          }
          
          // 2. Technique: Extract WHOIS emails
          if (emailsFound.size === 0) {
            console.log('Checking WHOIS data...');
            const whoisEmails = await extractWhoisEmails(domain);
            whoisEmails.forEach(email => emailsFound.add(email));
          }
          
          // 3. Technique: Check GitHub repositories
          if (emailsFound.size === 0) {
            console.log('Checking GitHub repositories...');
            const githubEmails = await checkGitHubForEmails(domain);
            githubEmails.forEach(email => emailsFound.add(email));
          }
          
          // 4. Technique: Generate email permutations
          if (emailsFound.size === 0) {
            console.log('Generating email permutations...');
            // Extract team members if not done already
            let teamMembers: { name: string, title?: string }[] = [];
            
            if (contactInfo.contactPerson?.name) {
              teamMembers.push({
                name: contactInfo.contactPerson.name,
                title: contactInfo.contactPerson.title
              });
            } else {
              // Try to extract team members from about/team page
              for (const contactUrl of contactPages) {
                if (contactUrl.includes('about') || contactUrl.includes('team') || contactUrl.includes('people')) {
                  teamMembers = await extractTeamMembers(contactUrl);
                  if (teamMembers.length > 0) break;
                }
              }
            }
            
            const permutations = generateEmailPermutations(domain, teamMembers);
            console.log(`Generated ${permutations.length} email permutations`);
            
            // Verify each permutation with SMTP (limit to first 10 to avoid too many checks)
            const verificationLimit = Math.min(permutations.length, 10);
            for (let i = 0; i < verificationLimit; i++) {
              const email = permutations[i];
              console.log(`Verifying email: ${email}`);
              
              const isValid = await verifyEmailWithSmtp(email);
              if (isValid) {
                console.log(`Verified valid email: ${email}`);
                emailsFound.add(email);
              }
            }
          }
          
          // Update contact info with found emails
          const newEmails = Array.from(emailsFound);
          if (newEmails.length > 0) {
            console.log(`Found ${newEmails.length} emails for ${domain}`);
            contactInfo.emails = [...newEmails];
            totalEmailsFound += newEmails.length;
            
            // Update the opportunity if not a dry run
            if (!options.dryRun) {
              await db.update(schema.discoveredOpportunities)
                .set({
                  contactInfo: contactInfo
                })
                .where(eq(schema.discoveredOpportunities.id, opportunity.id));
            }
            
            successCount++;
          } else {
            console.log(`No emails found for ${domain}`);
          }
        } catch (error) {
          console.error(`Error processing opportunity ${opportunity.id}:`, error);
        }
        
        // Wait between opportunities to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Wait between batches
      console.log(`Waiting ${BATCH_DELAY/1000} seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
    
    console.log(`\n🎉 Enhanced email extraction complete!`);
    console.log(`Updated ${successCount}/${opportunities.length} opportunities`);
    console.log(`Found ${totalEmailsFound} total emails`);
    
  } catch (error) {
    console.error('❌ Error during enhanced email extraction:', error);
  } finally {
    await pool.end();
  }
}

// Run the extraction process if executed directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: {
    skipPremium?: boolean;
    onlyPremium?: boolean;
    limit?: number;
    dryRun?: boolean;
  } = {};
  
  // Process arguments
  args.forEach(arg => {
    if (arg === '--skip-premium') options.skipPremium = true;
    if (arg === '--only-premium') options.onlyPremium = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1], 10);
  });
  
  // Run with the specified options
  runEnhancedEmailExtraction(options);
}