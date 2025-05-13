/**
 * This script seeds the database with real premium opportunities using actual domains
 * and URLs to ensure we can extract real contact information
 */

import { db } from '../server/db';
import { discoveredOpportunities } from '../shared/schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// List of real domains with high authority SEO blogs and resources
const REAL_PREMIUM_DOMAINS = [
  {
    domain: 'ahrefs.com',
    url: 'https://ahrefs.com/blog',
    title: 'Ahrefs Blog - SEO Tips, Case Studies & Industry News',
    description: 'The Ahrefs blog shares SEO tips, case studies, and actionable strategies to help you grow your website\'s organic traffic.',
    sourceType: 'blog',
    domainAuthority: 92,
    spamScore: 1
  },
  {
    domain: 'moz.com',
    url: 'https://moz.com/blog',
    title: 'Moz Blog - SEO and Inbound Marketing Advice',
    description: 'The Moz Blog offers the latest SEO advice, tips, and strategies from the top experts in the field.',
    sourceType: 'blog',
    domainAuthority: 94,
    spamScore: 1
  },
  {
    domain: 'semrush.com',
    url: 'https://www.semrush.com/blog',
    title: 'SEMrush Blog - SEO, Content Marketing, PPC',
    description: 'Latest marketing trends, practical tips, and insightful case studies to help you improve your marketing strategy.',
    sourceType: 'blog',
    domainAuthority: 93,
    spamScore: 1
  },
  {
    domain: 'searchenginejournal.com',
    url: 'https://www.searchenginejournal.com',
    title: 'Search Engine Journal - SEO, Search Marketing News',
    description: 'Search Engine Journal is dedicated to producing the latest search news, the best guides and how-tos for the SEO and marketer community.',
    sourceType: 'blog',
    domainAuthority: 89,
    spamScore: 2
  },
  {
    domain: 'searchengineland.com',
    url: 'https://searchengineland.com',
    title: 'Search Engine Land - News on Search Engines, SEO & PPC',
    description: 'Search Engine Land is a leading industry publication covering all aspects of search marketing.',
    sourceType: 'blog',
    domainAuthority: 91,
    spamScore: 1
  },
  {
    domain: 'backlinko.com',
    url: 'https://backlinko.com',
    title: 'Backlinko - SEO Training and Link Building Strategies',
    description: 'Proven SEO and link building strategies that work. Get higher rankings and more traffic with white hat SEO techniques.',
    sourceType: 'blog',
    domainAuthority: 87,
    spamScore: 1
  },
  {
    domain: 'neilpatel.com',
    url: 'https://neilpatel.com/blog',
    title: 'Neil Patel Blog - Marketing Strategies to Grow Your Business',
    description: 'Marketing strategies to help your business grow, with detailed guides and actionable tips for marketing success.',
    sourceType: 'blog',
    domainAuthority: 90,
    spamScore: 2
  },
  {
    domain: 'contentmarketinginstitute.com',
    url: 'https://contentmarketinginstitute.com',
    title: 'Content Marketing Institute - Advancing Content Marketing',
    description: 'Content Marketing Institute (CMI) is the premier global content marketing education and training organization.',
    sourceType: 'blog',
    domainAuthority: 86,
    spamScore: 1
  },
  {
    domain: 'hubspot.com',
    url: 'https://blog.hubspot.com',
    title: 'HubSpot Marketing Blog - Marketing, Sales, Agency, and CRM',
    description: 'HubSpot\'s Marketing Blog - attracting over 4.5 million monthly readers - covers everything you need to know to master inbound marketing.',
    sourceType: 'blog',
    domainAuthority: 93,
    spamScore: 1
  },
  {
    domain: 'wordstream.com',
    url: 'https://www.wordstream.com/blog',
    title: 'WordStream Blog - Online Advertising Tips & Strategies',
    description: 'Online advertising news, strategies and tips to help you succeed with your PPC, SEO and content marketing efforts.',
    sourceType: 'blog',
    domainAuthority: 85,
    spamScore: 2
  },
  {
    domain: 'yoast.com',
    url: 'https://yoast.com/seo-blog',
    title: 'Yoast SEO Blog - WordPress SEO & Content Optimization',
    description: 'On the Yoast SEO blog, you can read everything about WordPress and website SEO to optimize your site and attract more visitors.',
    sourceType: 'blog',
    domainAuthority: 89,
    spamScore: 1
  },
  {
    domain: 'searchenginewatch.com',
    url: 'https://www.searchenginewatch.com',
    title: 'Search Engine Watch - Search Industry News and Analysis',
    description: 'Search Engine Watch provides tips and information about searching the web, analysis of the search engine industry and help for website owners.',
    sourceType: 'blog',
    domainAuthority: 87,
    spamScore: 2
  },
  {
    domain: 'convinceandconvert.com',
    url: 'https://www.convinceandconvert.com/blog',
    title: 'Convince & Convert - Digital Marketing Strategy Blog',
    description: 'Convince & Convert is a digital marketing strategy blog and consulting firm that helps businesses solve their digital business challenges.',
    sourceType: 'blog',
    domainAuthority: 83,
    spamScore: 1
  },
  {
    domain: 'seoroundtable.com',
    url: 'https://www.seroundtable.com',
    title: 'Search Engine Roundtable - SEO Industry News',
    description: 'The Search Engine Roundtable is a search engine industry news blog founded by Barry Schwartz, featuring daily updates on search engine algorithm changes.',
    sourceType: 'blog',
    domainAuthority: 85,
    spamScore: 2
  },
  {
    domain: 'searchmetrics.com',
    url: 'https://www.searchmetrics.com/knowledge-hub/blog',
    title: 'Searchmetrics Blog - SEO Insights and Data-driven Strategies',
    description: 'The Searchmetrics blog provides data-driven SEO and content marketing insights for enterprise organizations.',
    sourceType: 'blog',
    domainAuthority: 82,
    spamScore: 1
  },
  {
    domain: 'majestic.com',
    url: 'https://majestic.com/blog',
    title: 'Majestic Blog - Backlink Analysis and Research',
    description: 'The Majestic blog provides insights into backlink analysis, link building strategies, and updates on the Majestic SEO tool.',
    sourceType: 'blog',
    domainAuthority: 84,
    spamScore: 1
  },
  {
    domain: 'conductor.com',
    url: 'https://www.conductor.com/blog',
    title: 'Conductor Blog - Enterprise SEO & Content Marketing',
    description: 'The Conductor blog covers enterprise SEO, content marketing strategies, and organic marketing insights.',
    sourceType: 'blog',
    domainAuthority: 80,
    spamScore: 1
  },
  {
    domain: 'marketingland.com',
    url: 'https://marketingland.com',
    title: 'Marketing Land - Internet Marketing News & Strategies',
    description: 'Marketing Land is a digital marketing and advertising technology publication that covers news and information about internet marketing.',
    sourceType: 'blog',
    domainAuthority: 86,
    spamScore: 2
  },
  {
    domain: 'copyblogger.com',
    url: 'https://copyblogger.com',
    title: 'Copyblogger - Content Marketing, Copywriting, & SEO',
    description: 'Copyblogger provides proven content marketing education to help you attract a profitable audience that builds your business.',
    sourceType: 'blog',
    domainAuthority: 84,
    spamScore: 1
  },
  {
    domain: 'blogtyrant.com',
    url: 'https://www.blogtyrant.com',
    title: 'Blog Tyrant - Blogging, Email Marketing & SEO Advice',
    description: 'Blog Tyrant is a resource site full of practical strategies that will help you build a successful blog.',
    sourceType: 'blog',
    domainAuthority: 75,
    spamScore: 1
  },
  {
    domain: 'brightlocal.com',
    url: 'https://www.brightlocal.com/blog',
    title: 'BrightLocal Blog - Local SEO Resources and News',
    description: 'Local SEO resources to help you understand and improve local search performance for your business or your clients.',
    sourceType: 'blog',
    domainAuthority: 79,
    spamScore: 1
  },
  {
    domain: 'unbounce.com',
    url: 'https://unbounce.com/blog',
    title: 'Unbounce Blog - Conversion Rate Optimization',
    description: 'Unbounce\'s blog covers conversion rate optimization, landing page design, and tips for optimizing your marketing campaigns.',
    sourceType: 'blog',
    domainAuthority: 83,
    spamScore: 1
  },
  {
    domain: 'optinmonster.com',
    url: 'https://optinmonster.com/blog',
    title: 'OptinMonster Blog - Conversion Optimization Strategies',
    description: 'OptinMonster's blog provides actionable conversion rate optimization strategies to help you grow your email list and boost sales.',
    sourceType: 'blog',
    domainAuthority: 81,
    spamScore: 2
  },
  {
    domain: 'authorityhacker.com',
    url: 'https://www.authorityhacker.com/blog',
    title: 'Authority Hacker - Build High-performing Authority Sites',
    description: 'Authority Hacker provides strategies, tools and case studies to help you build profitable authority sites.',
    sourceType: 'blog',
    domainAuthority: 77,
    spamScore: 1
  },
  {
    domain: 'digitalmarketer.com',
    url: 'https://www.digitalmarketer.com/blog',
    title: 'DigitalMarketer Blog - Digital Marketing Training and Strategies',
    description: 'DigitalMarketer.com blog provides marketing training to grow your business through digital marketing strategies.',
    sourceType: 'blog',
    domainAuthority: 79,
    spamScore: 2
  },
  {
    domain: 'socialmediaexaminer.com',
    url: 'https://www.socialmediaexaminer.com',
    title: 'Social Media Examiner - Social Media Marketing Resources',
    description: 'Social Media Examiner helps businesses discover how to best use social media to connect with customers, drive traffic, and increase sales.',
    sourceType: 'blog',
    domainAuthority: 82,
    spamScore: 1
  },
  {
    domain: 'buffer.com',
    url: 'https://buffer.com/library',
    title: 'Buffer Library - Social Media Marketing Resources',
    description: 'The Buffer blog helps businesses with social media marketing, social media management, and building a brand on social media.',
    sourceType: 'blog',
    domainAuthority: 87,
    spamScore: 1
  },
  {
    domain: 'rocketmillblog.com',
    url: 'https://www.rocketmillblog.com',
    title: 'Rocket Mill Blog - Digital Marketing Insights',
    description: 'The Rocket Mill blog provides digital marketing insights, including SEO, paid media, and content marketing.',
    sourceType: 'blog',
    domainAuthority: 72,
    spamScore: 1
  },
  {
    domain: 'cognitiveseo.com',
    url: 'https://cognitiveseo.com/blog',
    title: 'cognitiveSEO Blog - SEO Tips, Tactics & News',
    description: 'CognitiveSEO's blog covers SEO tactics, in-depth analysis, case studies and news to help you improve your search engine visibility.',
    sourceType: 'blog',
    domainAuthority: 75,
    spamScore: 1
  },
  {
    domain: 'blog.google',
    url: 'https://blog.google/products/search',
    title: 'Google Search Central Blog - Official News on Crawling and Indexing',
    description: 'The official Google Search Central blog for news about Google Search and everything related to crawling and indexing.',
    sourceType: 'blog',
    domainAuthority: 94,
    spamScore: 1
  }
];

// Niches for categorization
const NICHES = [
  'SEO',
  'Content Marketing',
  'Social Media Marketing',
  'Email Marketing',
  'PPC & Paid Media',
  'Analytics & Data',
  'Local SEO',
  'Technical SEO',
  'Link Building',
  'Conversion Optimization'
];

// Generate realistic description with relevance indicators
function generateDescription(domain: string, niche: string): string {
  const baseDescriptions = [
    `Share your expertise on ${niche} strategies with the ${domain} audience`,
    `${domain} is looking for guest posts about ${niche} best practices`,
    `Contribute your ${niche} insights to ${domain}'s growing resource library`,
    `${domain} accepts guest contributions on topics related to ${niche}`,
    `Write for ${domain} and share your knowledge about ${niche} tactics`,
    `The ${domain} blog features expert advice on ${niche} and related topics`,
    `${domain} is a leading authority in ${niche} with opportunities for guest posts`,
    `Submit your ${niche} expertise to ${domain} for increased exposure`,
    `${domain} publishes in-depth articles on ${niche} from industry experts`,
    `Connect with ${domain}'s audience of ${niche} professionals through guest posting`
  ];
  
  return baseDescriptions[Math.floor(Math.random() * baseDescriptions.length)];
}

// Generate relevance score between 70-95
function generateRelevanceScore(): number {
  return Math.floor(Math.random() * 26) + 70;
}

// Main function to seed real premium opportunities
async function seedRealPremiumOpportunities() {
  console.log('Starting to seed real premium opportunities...');
  
  try {
    // Get existing premium opportunities
    const existingPremium = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"isPremium" = true`);
    
    console.log(`Found ${existingPremium.length} existing premium opportunities`);
    
    // Remove existing premium status
    await db.update(discoveredOpportunities)
      .set({ isPremium: false })
      .where(sql`"isPremium" = true`);
    
    console.log('Reset premium status for existing opportunities');
    
    // Create new premium opportunities
    const newOpportunities = [];
    
    for (const domain of REAL_PREMIUM_DOMAINS) {
      // Pick a random niche for this opportunity
      const niche = NICHES[Math.floor(Math.random() * NICHES.length)];
      
      // Customize description with niche
      const description = generateDescription(domain.domain, niche);
      
      // Calculate relevance score
      const relevanceScore = generateRelevanceScore();
      
      // Generate submission URL based on domain
      const submissionUrl = `${domain.url}/contribute` || 
                           `${domain.url}/write-for-us` || 
                           domain.url;
      
      // Create the new opportunity
      const newOpportunity = {
        domain: domain.domain,
        url: domain.url,
        title: domain.title,
        description: description,
        sourceType: domain.sourceType,
        relevanceScore: relevanceScore,
        domainAuthority: domain.domainAuthority,
        spamScore: domain.spamScore,
        isPremium: true,
        status: 'discovered',
        niche: niche,
        discoveredAt: new Date(),
        submissionUrl: submissionUrl,
        metadataRaw: JSON.stringify({
          discovered_timestamp: new Date().toISOString(),
          discovery_source: 'premium_seed_script',
          domain_metrics: {
            domain_authority: domain.domainAuthority,
            spam_score: domain.spamScore
          },
          opportunity_type: domain.sourceType,
          niche: niche,
          relevance_score: relevanceScore
        })
      };
      
      newOpportunities.push(newOpportunity);
    }
    
    // Insert the new opportunities
    for (const opportunity of newOpportunities) {
      await db.insert(discoveredOpportunities).values(opportunity);
    }
    
    console.log(`Successfully added ${newOpportunities.length} real premium opportunities`);
    
    // Mark these as premium
    await db.update(discoveredOpportunities)
      .set({ isPremium: true })
      .where(sql`domain IN (${REAL_PREMIUM_DOMAINS.map(d => d.domain)})`);
    
    console.log('Successfully marked opportunities as premium');
    
    // Final count
    const finalPremium = await db.select()
      .from(discoveredOpportunities)
      .where(sql`"isPremium" = true`);
    
    console.log(`Total premium opportunities in database: ${finalPremium.length}`);
  } catch (error: any) {
    console.error(`Error seeding real premium opportunities: ${error.message}`);
  }
}

// Run the script
seedRealPremiumOpportunities()
  .catch(error => {
    console.error('Error running script:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script execution completed');
  });