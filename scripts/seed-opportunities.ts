// Script to seed the database with sample discovered opportunities
import { db } from '../server/db';
import { 
  discoveredOpportunities, 
  crawlerJobs, 
  opportunityMatches, 
  dailyDrips, 
  websiteProfiles,
  websites,
  users
} from '../shared/schema';
import { sql, eq, and } from 'drizzle-orm';
import { getDiscoveryScheduler } from '../server/services/discovery-scheduler';
import { getOpportunityCrawler } from '../server/services/crawler';
import { getValidationPipeline } from '../server/services/validation-pipeline';

// Dictionary of source types - must match the source_type enum values
const sourceTypes = [
  'resource_page',
  'guest_post',
  'directory',
  'forum',
  'blog'
];

// Niche-based topics for website profiles
const nicheTopics = {
  'digital_marketing': [
    'SEO Strategies', 
    'Link Building Techniques', 
    'Content Marketing', 
    'Analytics and Data', 
    'Google Algorithm Updates',
    'Keyword Research',
    'On-page Optimization',
    'Technical SEO',
    'Local SEO',
    'Mobile SEO'
  ],
  'social_media': [
    'Social Media Strategy',
    'Community Management',
    'Platform Algorithms',
    'Social Analytics',
    'Content Creation',
    'Influencer Marketing',
    'Paid Social',
    'Engagement Strategies',
    'Social Listening',
    'Social ROI'
  ],
  'content_creation': [
    'Content Strategy',
    'Copywriting',
    'Storytelling',
    'Visual Content',
    'Content Distribution',
    'Audience Development',
    'Editorial Planning',
    'Content Formats',
    'Content Optimization',
    'Content Measurement'
  ],
  'tech_and_saas': [
    'Product Development',
    'User Experience',
    'SaaS Metrics',
    'Customer Success',
    'API Integration',
    'DevOps',
    'Software Architecture',
    'Growth Hacking',
    'Product Marketing',
    'Technology Trends'
  ],
  'health_and_wellness': [
    'Nutrition',
    'Fitness',
    'Mental Health',
    'Preventive Healthcare',
    'Wellness Practices',
    'Medical Research',
    'Alternative Medicine',
    'Health Technology',
    'Patient Education',
    'Healthcare Policy'
  ],
  'finance': [
    'Personal Finance',
    'Investing',
    'Financial Planning',
    'Retirement',
    'Tax Strategies',
    'Insurance',
    'Banking',
    'Cryptocurrency',
    'Financial Independence',
    'Debt Management'
  ],
  'travel': [
    'Destination Guides',
    'Travel Tips',
    'Budget Travel',
    'Luxury Travel',
    'Adventure Travel',
    'Family Travel',
    'Solo Travel',
    'Sustainable Tourism',
    'Travel Technology',
    'Cultural Experiences'
  ],
  'education': [
    'Learning Methodologies',
    'Educational Technology',
    'Curriculum Development',
    'Student Success',
    'Higher Education',
    'Online Learning',
    'Professional Development',
    'Education Policy',
    'Teacher Resources',
    'Learning Assessment'
  ]
};

// Organized by niche for better opportunity matching
const nicheBasedDomains = {
  'digital_marketing': [
    'digitalmarketinginstitute.com',
    'searchenginejournal.com',
    'contentmarketinginstitute.com',
    'ahrefs.com',
    'moz.com',
    'semrush.com',
    'backlinko.com',
    'neilpatel.com',
    'wordstream.com',
    'convinceandconvert.com',
    'copyblogger.com',
    'searchengineland.com',
    'marketingprofs.com'
  ],
  'social_media': [
    'buffer.com',
    'sproutsocial.com',
    'socialmediaexaminer.com',
    'hootsuite.com',
    'socialmediacollege.com',
    'socialmediatoday.com',
    'socialmediastrategiessummit.com'
  ],
  'content_creation': [
    'contently.com',
    'ann-handley.com',
    'coschedule.com',
    'problogger.com',
    'storybrand.com',
    'contentmarketinginstitute.com',
    'gathercontent.com',
    'clearvoice.com',
    'copyblogger.com',
    'semrush.com/blog/category/content-marketing/'
  ],
  'tech_and_saas': [
    'techcrunch.com',
    'producthunt.com',
    'g2.com',
    'capterra.com',
    'saashacker.com',
    'saastr.com',
    'openview.com',
    'saasacademy.com',
    'forexample.com',
    'microsoftstartups.com',
    'saas.group'
  ],
  'health_and_wellness': [
    'webmd.com',
    'healthline.com',
    'mayoclinic.org',
    'wellnessmama.com',
    'mindbodygreen.com',
    'everydayhealth.com',
    'draxe.com',
    'medicalnewstoday.com',
    'shape.com',
    'prevention.com'
  ],
  'finance': [
    'investopedia.com',
    'nerdwallet.com',
    'bankrate.com',
    'forbes.com/money',
    'moneysavingexpert.com',
    'cnbc.com/personal-finance',
    'thepennyhoarder.com',
    'consumerfinance.gov',
    'finance.yahoo.com',
    'kiplinger.com'
  ],
  'travel': [
    'lonelyplanet.com',
    'tripadvisor.com',
    'nomadicmatt.com',
    'afar.com',
    'travelandleisure.com',
    'roughguides.com',
    'cntraveler.com',
    'wanderlust.co.uk',
    'fodors.com',
    'thepointsguy.com'
  ],
  'education': [
    'edutopia.org',
    'education.com',
    'edweek.org',
    'teacherspayteachers.com',
    'coursera.org/blog',
    'khanacademy.org/about/blog',
    'teachthought.com',
    'edx.org',
    'edsurge.com',
    'chronicle.com'
  ]
};

/**
 * Generate a title with the provided topic
 */
function generateTitle(topic: string): string {
  const templates = [
    `Ultimate Guide to ${topic}`,
    `${topic}: Best Strategies for 2025`,
    `How to Leverage ${topic} in Your Business`,
    `The Complete ${topic} Resource`,
    `${topic} 101: Everything You Need to Know`,
    `10 Essential ${topic} Tips`,
    `Why ${topic} Matters in Today's Market`,
    `Mastering ${topic}: Expert Insights`,
    `The Future of ${topic}`,
    `${topic} Case Study: Real Results`,
    `Understanding ${topic}: A Comprehensive Guide`,
    `${topic} Statistics and Trends in 2025`,
    `The ROI of Investing in ${topic}`,
    `${topic} vs Traditional Methods: Which Wins?`,
    `The Evolution of ${topic}`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get a random element from an array
 */
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random contact email for a domain
 */
function generateContactEmail(domain: string): string {
  const prefixes = ['contact', 'hello', 'info', 'outreach', 'partnerships', 'editor', 'marketing', 'media', 'admin', 'support'];
  return `${getRandomElement(prefixes)}@${domain}`;
}

/**
 * Generate a realistic domain authority score
 * With a bias toward the middle range (20-50)
 */
function generateDomainAuthority(): number {
  // Use a normal-like distribution centered around 35
  // with most sites between 20-50
  let base = Math.floor(Math.random() * 60) + 10; // 10-70 range
  
  // Add some variation
  let variation = Math.floor(Math.random() * 20) - 10; // -10 to +10
  
  // Ensure it stays in the 1-100 range
  return Math.min(Math.max(base + variation, 1), 100);
}

/**
 * Generate a realistic spam score
 * Most legitimate sites have low spam scores
 */
function generateSpamScore(): number {
  // Most legitimate sites (80%) should have a spam score of 0-5
  if (Math.random() < 0.8) {
    return Math.floor(Math.random() * 6); 
  }
  
  // 15% have a moderate spam score of 6-10
  if (Math.random() < 0.15) {
    return Math.floor(Math.random() * 5) + 6;
  }
  
  // 5% have a high spam score of 11-17
  return Math.floor(Math.random() * 7) + 11;
}

/**
 * Get a random niche from the nicheBasedDomains object
 */
function getRandomNiche(): string {
  const niches = Object.keys(nicheBasedDomains);
  return niches[Math.floor(Math.random() * niches.length)];
}

/**
 * Get a random domain from a specific niche
 */
function getRandomDomainFromNiche(niche: string): string {
  const domains = nicheBasedDomains[niche];
  return domains[Math.floor(Math.random() * domains.length)];
}

/**
 * Get a random topic from a specific niche
 */
function getRandomTopicFromNiche(niche: string): string {
  if (!nicheTopics[niche]) {
    return "General Topic";
  }
  const topics = nicheTopics[niche];
  return topics[Math.floor(Math.random() * topics.length)];
}

/**
 * Generate URL path based on topic and source type
 */
function generateUrlPath(topic: string, sourceType: string): string {
  // Format topic for URL: "SEO Strategies" -> "seo-strategies"
  const formattedTopic = topic.toLowerCase().replace(/\s+/g, '-');
  
  switch (sourceType) {
    case 'resource_page':
      return `/resources/${formattedTopic}`;
    case 'guest_post':
      return `/write-for-us`;
    case 'directory':
      return `/directory/${formattedTopic}`;
    case 'forum':
      return `/forum/topic/${formattedTopic}`;
    case 'blog':
      return `/blog/${formattedTopic}`;
    default:
      return `/${formattedTopic}`;
  }
}

/**
 * Seed discovered opportunities with niche-specific data
 */
async function seedDiscoveredOpportunities() {
  console.log('Seeding discovered opportunities...');
  
  // Check if there are already opportunities in the database
  const existingOpportunities = await db.select({ count: sql`count(*)` }).from(discoveredOpportunities);
  const count = parseInt(existingOpportunities[0]?.count.toString() || '0');
  
  if (count > 0) {
    console.log(`Database already has ${count} discovered opportunities. Skipping.`);
    return;
  }
  
  // Create opportunities
  const opportunities = [];
  
  // For each niche, create a set of opportunities
  const niches = Object.keys(nicheBasedDomains);
  
  for (const niche of niches) {
    const domains = nicheBasedDomains[niche];
    
    for (const domain of domains) {
      // Create 1-3 opportunities per domain with different source types
      const numOpportunities = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numOpportunities; i++) {
        const sourceType = sourceTypes[Math.floor(Math.random() * sourceTypes.length)];
        const topic = getRandomTopicFromNiche(niche);
        const title = generateTitle(topic);
        const urlPath = generateUrlPath(topic, sourceType);
        
        const opportunityData = {
          domain: domain,
          url: `https://${domain}${urlPath}`,
          title: title,
          description: `A ${sourceType.replace('_', ' ')} about ${topic.toLowerCase()} from ${domain}`,
          sourceType: sourceType,
          contactEmail: Math.random() > 0.2 ? generateContactEmail(domain) : null, // 80% have contact email
          domainAuthority: Math.random() > 0.1 ? generateDomainAuthority() : null, // 90% have DA
          spamScore: Math.random() > 0.1 ? generateSpamScore() : null, // 90% have spam score
          status: 'validated',
          niche: niche,
          discoveredAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000), // Random date in last 30 days
          metadataRaw: JSON.stringify({
            title: title,
            h1: title,
            description: `Learn about ${topic} in this ${sourceType.replace('_', ' ')} article.`,
            links: Math.floor(Math.random() * 50) + 10,
            wordCount: Math.floor(Math.random() * 1500) + 500,
          })
        };
        
        opportunities.push(opportunityData);
      }
    }
  }
  
  // Insert opportunities in batches
  for (const opportunity of opportunities) {
    try {
      await db.insert(discoveredOpportunities).values(opportunity);
    } catch (error) {
      console.error(`Error inserting opportunity: ${error.message}`);
    }
  }
  
  console.log(`Successfully created ${opportunities.length} discovered opportunities.`);
}

/**
 * Seed crawler jobs
 */
async function seedCrawlerJobs() {
  console.log('Seeding crawler jobs...');
  
  // Check if there are already jobs in the database
  const existingJobs = await db.select({ count: sql`count(*)` }).from(crawlerJobs);
  const count = parseInt(existingJobs[0]?.count.toString() || '0');
  
  if (count > 0) {
    console.log(`Database already has ${count} crawler jobs. Skipping.`);
    return;
  }
  
  // Create crawler jobs for different niches
  const jobs = [];
  
  // Digital Marketing resources
  jobs.push({
    jobType: 'resource_page',
    targetUrl: 'https://ahrefs.com/blog/seo-resources/',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'digital_marketing'
    })
  });
  
  jobs.push({
    jobType: 'guest_post',
    targetUrl: 'https://www.searchenginejournal.com/page/write-for-sej/',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'digital_marketing'
    })
  });
  
  // Content Creation resources
  jobs.push({
    jobType: 'resource_page',
    targetUrl: 'https://contentmarketinginstitute.com/resources/',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'content_creation'
    })
  });
  
  jobs.push({
    jobType: 'guest_post',
    targetUrl: 'https://www.jeffbullas.com/submit-a-guest-post/',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'content_creation'
    })
  });
  
  // Tech & SaaS resources
  jobs.push({
    jobType: 'resource_page',
    targetUrl: 'https://www.producthunt.com/',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'tech_and_saas'
    })
  });
  
  jobs.push({
    jobType: 'directory',
    targetUrl: 'https://www.g2.com/categories/seo',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'tech_and_saas'
    })
  });
  
  // Health resources
  jobs.push({
    jobType: 'resource_page',
    targetUrl: 'https://www.healthline.com/health/fitness-nutrition',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'health_and_wellness'
    })
  });
  
  // Financial resources
  jobs.push({
    jobType: 'resource_page',
    targetUrl: 'https://www.investopedia.com/financial-term-dictionary-4769738',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'finance'
    })
  });
  
  // Travel resources
  jobs.push({
    jobType: 'blog',
    targetUrl: 'https://www.lonelyplanet.com/articles',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'travel'
    })
  });
  
  // Education resources
  jobs.push({
    jobType: 'guest_post',
    targetUrl: 'https://www.edutopia.org/about/how-to-contribute/',
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    results: JSON.stringify({
      status: 'queued',
      niche: 'education'
    })
  });
  
  // Insert jobs in batches
  for (const job of jobs) {
    try {
      await db.insert(crawlerJobs).values(job);
    } catch (error) {
      console.error(`Error inserting crawler job: ${error.message}`);
    }
  }
  
  console.log(`Successfully created ${jobs.length} crawler jobs.`);
}

/**
 * Run the discovery pipeline
 */
async function runDiscoveryPipeline() {
  // This would run the actual discovery pipeline
  // But for now, we'll just seed the data
}

/**
 * Create website profiles for existing websites
 */
async function createWebsiteProfiles() {
  console.log('Creating website profiles...');
  
  // Check if there are already profiles in the database
  const existingProfiles = await db.select({ count: sql`count(*)` }).from(websiteProfiles);
  const count = parseInt(existingProfiles[0]?.count.toString() || '0');
  
  if (count > 0) {
    console.log(`Database already has ${count} website profiles. Skipping.`);
    return;
  }
  
  // Get all websites
  const allWebsites = await db.select().from(websites);
  
  if (allWebsites.length === 0) {
    console.log('No websites found. Skipping profile creation.');
    return;
  }
  
  // For each website, create a profile with randomized data
  for (const website of allWebsites) {
    // Determine niche
    const websiteNiche = getRandomNiche();
    const topics = [];
    const targetNiches = [websiteNiche];
    const avoidNiches = [];
    
    // Add some topics from the website's primary niche
    if (nicheTopics[websiteNiche]) {
      // Get 3-5 random topics from the niche
      const nicheSpecificTopics = [...nicheTopics[websiteNiche]]; // Clone the array
      for (let i = 0; i < Math.min(3 + Math.floor(Math.random() * 3), nicheSpecificTopics.length); i++) {
        // Select a random index
        const randomIndex = Math.floor(Math.random() * nicheSpecificTopics.length);
        // Add the topic
        topics.push(nicheSpecificTopics[randomIndex]);
        // Remove it from the array to avoid duplicates
        nicheSpecificTopics.splice(randomIndex, 1);
      }
    }
    
    // Add 1-2 complementary niches as target niches
    const complementaryNiches = Object.keys(nicheBasedDomains).filter(n => n !== websiteNiche);
    for (let i = 0; i < Math.min(1 + Math.floor(Math.random() * 2), complementaryNiches.length); i++) {
      // Select a random index
      const randomIndex = Math.floor(Math.random() * complementaryNiches.length);
      // Add the niche
      targetNiches.push(complementaryNiches[randomIndex]);
      // Remove it from the array to avoid duplicates
      complementaryNiches.splice(randomIndex, 1);
    }
    
    // Add 1-2 niches to avoid
    for (let i = 0; i < Math.min(1 + Math.floor(Math.random() * 2), complementaryNiches.length); i++) {
      // Select a random index
      const randomIndex = Math.floor(Math.random() * complementaryNiches.length);
      // Add the niche
      avoidNiches.push(complementaryNiches[randomIndex]);
      // Remove it from the array to avoid duplicates
      complementaryNiches.splice(randomIndex, 1);
    }
    
    // Create a profile
    try {
      await db.insert(websiteProfiles).values({
        websiteId: website.id,
        keywords: ['seo', 'marketing', 'backlinks', 'content', 'digital marketing'],
        topics: topics,
        contentTypes: ['blog', 'guide', 'tutorial', 'review', 'case study'],
        analyzedAt: new Date(),
        activeBacklinks: Math.floor(Math.random() * 100) + 10,
        domainAuthority: generateDomainAuthority(),
        targetNiches: targetNiches,
        avoidNiches: avoidNiches,
        linkTypePreferences: ['resource_page', 'guest_post', 'blog'],
        lastUpdated: new Date()
      });
      
      console.log(`Created profile for website ${website.id}: ${website.url}`);
    } catch (error) {
      console.error(`Error creating profile for website ${website.id}: ${error.message}`);
    }
  }
  
  console.log(`Successfully created profiles for ${allWebsites.length} websites.`);
}

/**
 * Create opportunity matches between opportunities and websites
 */
async function createOpportunityMatches() {
  console.log('Creating opportunity matches...');
  
  // Get validated opportunities
  const opportunities = await db.select()
    .from(discoveredOpportunities)
    .where(eq(discoveredOpportunities.status, 'validated'));
  
  if (opportunities.length === 0) {
    console.log('No validated opportunities found.');
    return;
  }
  
  // Get all websites that have profiles
  const websiteWithProfiles = await db.select({
    website: websites,
    profile: websiteProfiles
  })
  .from(websites)
  .innerJoin(
    websiteProfiles,
    eq(websites.id, websiteProfiles.websiteId)
  );
  
  if (websiteWithProfiles.length === 0) {
    console.log('No websites with profiles found.');
    return;
  }
  
  // Check for existing matches
  const existingMatches = await db.select({ count: sql`count(*)` }).from(opportunityMatches);
  const count = parseInt(existingMatches[0]?.count.toString() || '0');
  
  if (count > 0) {
    console.log(`Database already has ${count} opportunity matches. Skipping.`);
    return;
  }
  
  const matches = [];
  const drips = [];
  
  // For each website, find matching opportunities
  for (const { website, profile } of websiteWithProfiles) {
    // Get the user who owns this website
    const user = await db.select().from(users).where(eq(users.id, website.userId)).limit(1);
    
    if (user.length === 0) {
      console.log(`No user found for website ${website.id}. Skipping.`);
      continue;
    }
    
    const userId = user[0].id;
    
    // Get the website's target niches
    const websiteNiches = profile.targetNiches || [];
    const avoidNiches = profile.avoidNiches || [];
    
    // Get the website's link type preferences
    const linkTypePreferences = profile.linkTypePreferences || [];
    
    // For each opportunity, check if it matches the website
    for (const opportunity of opportunities) {
      // Skip if the opportunity is in an avoided niche
      if (avoidNiches.includes(opportunity.niche)) {
        continue;
      }
      
      // Calculate match score components
      // 1. Niche match
      const nicheMatch = websiteNiches.includes(opportunity.niche);
      const nicheScore = nicheMatch ? 40 : 20;
      
      // 2. Source type match
      const sourceTypeMatch = linkTypePreferences.includes(opportunity.sourceType);
      const sourceTypeScore = sourceTypeMatch ? 30 : 15;
      
      // 3. Quality score based on domain authority and spam score
      const daScore = opportunity.domainAuthority ? Math.min(opportunity.domainAuthority / 2, 20) : 10;
      const spamPenalty = opportunity.spamScore ? Math.min(opportunity.spamScore * 2, 20) : 0;
      const qualityScore = Math.max(daScore - spamPenalty, 0);
      
      // Final relevance score
      const relevanceScore = nicheScore + sourceTypeScore;
      
      // Final quality score
      // Higher domain authority and lower spam score = higher quality
      
      // Final opportunity score
      // Premium opportunities based on DA and spam score
      const isPremium = opportunity.domainAuthority >= 40 && 
                        opportunity.spamScore < 2 && 
                        relevanceScore > 60;
      
      const opportunityScore = isPremium ? 90 : 70;
      
      // Create more detailed matchReason object
      const matchReason = {
        relevance: {
          score: relevanceScore,
          factors: [
            nicheMatch ? `Strong match in ${opportunity.niche.replace('_', ' ')} niche` : 'Complementary niche alignment',
            'Content topic relevance',
            opportunity.sourceType === 'resource_page' ? 'Resource page opportunity' : 
              (opportunity.sourceType === 'guest_post' ? 'Guest posting opportunity' : 'Link opportunity')
          ],
          niche_match: nicheMatch
        },
        quality: {
          score: qualityScore,
          factors: [
            opportunity.domainAuthority ? `Domain authority: ${opportunity.domainAuthority}` : 'Average domain authority',
            opportunity.spamScore && opportunity.spamScore < 3 ? 'Very low spam score' : 
              (opportunity.spamScore && opportunity.spamScore < 6 ? 'Acceptable spam score' : 'Moderate spam metrics')
          ],
          metrics: {
            domain_authority: opportunity.domainAuthority || 'unknown',
            spam_score: opportunity.spamScore || 'unknown'
          }
        },
        opportunity: {
          score: opportunityScore,
          factors: [
            'Contact information available',
            isPremium ? 'Premium opportunity' : 'Standard opportunity',
            opportunity.sourceType === 'resource_page' ? 'Resource page link' : 
              (opportunity.sourceType === 'guest_post' ? 'Guest post opportunity' : 
               (opportunity.sourceType === 'blog' ? 'Blog mention opportunity' : 'General opportunity'))
          ],
          type: opportunity.sourceType
        }
      };
      
      try {
        // Create match using SQL to handle JSONB
        const matchResult = await db.execute(sql`
          INSERT INTO "opportunityMatches" (
            "opportunityId",
            "userId",
            "websiteId",
            "matchScore",
            "matchReason",
            "assignedAt",
            "status",
            "isPremium"
          ) VALUES (
            ${opportunity.id},
            ${userId},
            ${website.id},
            ${70 + Math.floor(Math.random() * 30)},
            ${JSON.stringify(matchReason)}::jsonb,
            ${new Date()},
            ${'active'},
            ${isPremium}
          )
          RETURNING id
        `);
        
        // Add to matches count for logging
        matches.push(matchResult.rows[0].id);
        
        // Create daily drip with more focused approach
        // For premium content:
        // - If it's premium, add as a drip about 80% of the time 
        // - If it's standard, add as a drip about 50% of the time
        // Overall, this should result in a mix of premium and standard opportunities
        // with premium ones being more frequently included
        const shouldCreateDrip = isPremium ? 
                                (Math.random() < 0.8) : // 80% chance for premium
                                (Math.random() < 0.5);  // 50% chance for standard
        
        if (shouldCreateDrip) {
          // Create a daily drip for today
          try {
            const dripResult = await db.execute(sql`
              INSERT INTO "dailyDrips" (
                "userId",
                "opportunityId",
                "dripDate",
                "status",
                "isPremium"
              ) VALUES (
                ${userId},
                ${opportunity.id},
                ${new Date()},
                ${'active'},
                ${isPremium}
              )
              RETURNING id
            `);
            
            // Add to drips count for logging
            drips.push(dripResult.rows[0].id);
          } catch (dripError) {
            console.error(`Error creating drip: ${dripError.message}`);
          }
        }
      } catch (error) {
        console.error(`Error creating match/drip: ${error.message}`);
      }
    }
  }
  
  // Log the count of created matches and drips
  console.log(`Successfully created ${matches.length} opportunity matches and ${drips.length} drips.`);
  
  // Drips are now inserted directly during the match creation
}

/**
 * Main function to run all seeding operations
 */
async function main() {
  console.log('Starting opportunity seeding process...');
  
  try {
    // Seed discovered opportunities
    await seedDiscoveredOpportunities();
    
    // Seed crawler jobs
    await seedCrawlerJobs();
    
    // Create website profiles for existing websites
    await createWebsiteProfiles();
    
    // Create opportunity matches
    await createOpportunityMatches();
    
    console.log('Opportunity seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

// Run the main function
main().then(() => {
  console.log('All done!');
  process.exit(0);
});