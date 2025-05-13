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
    'smartblogger.com',
    'bloggingwizard.com',
    'problogger.com',
    'copyblogger.com',
    'write.as',
    'contently.com',
    'writtent.com'
  ],
  'tech_and_saas': [
    'hubspot.com',
    'techcrunch.com',
    'saashacker.com',
    'saastr.com',
    'saasquatch.com',
    'productled.com',
    'growthhackers.com'
  ],
  'health_and_wellness': [
    'healthline.com',
    'mindbodygreen.com',
    'wellnessmama.com',
    'healthwellnessdigest.com',
    'acefitness.org',
    'yogajournal.com',
    'everydayhealth.com'
  ],
  'finance': [
    'nerdwallet.com',
    'investopedia.com',
    'thebalance.com',
    'fool.com',
    'financialmentor.com',
    'moneyunder30.com',
    'budgetsaresexy.com'
  ],
  'travel': [
    'nomadicmatt.com',
    'lonelyplanet.com',
    'travelandleisure.com',
    'thepointsguy.com',
    'fodors.com',
    'travelpulse.com',
    'afar.com'
  ],
  'education': [
    'edutopia.org',
    'teachthought.com',
    'edsurge.com',
    'teachertoolkit.com',
    'edweek.org',
    'scholastic.com',
    'educationcorner.com'
  ]
};

// Flatten for compatibility with existing code
const sampleDomains = Object.values(nicheBasedDomains).flat();

// Topics by niche for more targeted content opportunities
const nicheTopics = {
  'digital_marketing': [
    'SEO', 'Content Marketing', 'PPC', 'Digital Strategy', 
    'Link Building', 'Keyword Research', 'Local SEO', 'Technical SEO',
    'Analytics', 'Conversion Optimization'
  ],
  'social_media': [
    'Instagram Marketing', 'LinkedIn Strategy', 'Twitter Growth',
    'Social Media ROI', 'Community Management', 'Social Listening',
    'Influencer Marketing', 'Social Media Analytics', 'Social Advertising'
  ],
  'content_creation': [
    'Copywriting', 'Content Strategy', 'Storytelling', 'Editorial Calendars',
    'Content Distribution', 'Blog Optimization', 'Content Repurposing',
    'Case Studies', 'Content for SEO'
  ],
  'tech_and_saas': [
    'SaaS Marketing', 'Product-Led Growth', 'Customer Success',
    'User Onboarding', 'Retention Strategies', 'API Documentation',
    'Developer Marketing', 'Technical Documentation', 'SaaS Metrics'
  ],
  'health_and_wellness': [
    'Nutrition', 'Fitness', 'Mental Health', 'Yoga', 'Meditation',
    'Healthy Recipes', 'Holistic Health', 'Workout Plans', 'Wellness Trends'
  ],
  'finance': [
    'Personal Finance', 'Investing', 'Retirement Planning', 'Debt Management',
    'Budgeting', 'Financial Independence', 'Tax Planning', 'Credit Scores'
  ],
  'travel': [
    'Budget Travel', 'Luxury Travel', 'Travel Hacking', 'Digital Nomad',
    'Adventure Travel', 'Family Travel', 'Solo Travel', 'Sustainable Tourism'
  ],
  'education': [
    'EdTech', 'Online Learning', 'Curriculum Development', 'Teaching Resources',
    'Higher Education', 'E-Learning', 'Education Policy', 'Education Research'
  ]
};

// Flatten topics for compatibility with existing code
const topics = Object.values(nicheTopics).flat();

// Realistic titles for backlink opportunities
const titleTemplates = [
  '{topic} Resources You Need to Check Out',
  'Top {topic} Tools and Resources',
  'The Ultimate Guide to {topic}',
  'Write for Us: {topic} Guest Post Guidelines',
  '{topic} Link Roundup',
  'Best {topic} Blogs to Follow',
  'Submit Your {topic} Site to Our Directory',
  '{topic} Case Studies',
  'Join Our {topic} Forum',
  'Featured {topic} Experts'
];

/**
 * Generate a title with the provided topic
 */
function generateTitle(topic: string): string {
  const template = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
  return template.replace('{topic}', topic);
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
  const contactTypes = ['info', 'contact', 'editor', 'admin', 'hello', 'support'];
  return `${getRandomElement(contactTypes)}@${domain}`;
}

/**
 * Generate a realistic domain authority score
 * With a bias toward the middle range (20-50)
 */
function generateDomainAuthority(): number {
  // Generate a base score between 20 and 50
  let score = 20 + Math.floor(Math.random() * 31);
  
  // 20% chance to get a higher score (50-80)
  if (Math.random() < 0.2) {
    score = 50 + Math.floor(Math.random() * 31);
  }
  
  // 10% chance to get a very high score (80-95)
  if (Math.random() < 0.1) {
    score = 80 + Math.floor(Math.random() * 16);
  }
  
  return score;
}

/**
 * Generate a realistic spam score
 * Most legitimate sites have low spam scores
 */
function generateSpamScore(): number {
  // 70% chance of very low spam score (0-2)
  if (Math.random() < 0.7) {
    return Math.floor(Math.random() * 3);
  }
  
  // 20% chance of moderate spam score (3-5)
  if (Math.random() < 0.9) {
    return 3 + Math.floor(Math.random() * 3);
  }
  
  // 10% chance of high spam score (6-10)
  return 6 + Math.floor(Math.random() * 5);
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
  const domains = nicheBasedDomains[niche as keyof typeof nicheBasedDomains];
  return domains[Math.floor(Math.random() * domains.length)];
}

/**
 * Get a random topic from a specific niche
 */
function getRandomTopicFromNiche(niche: string): string {
  const nicheSpecificTopics = nicheTopics[niche as keyof typeof nicheTopics];
  return nicheSpecificTopics[Math.floor(Math.random() * nicheSpecificTopics.length)];
}

/**
 * Generate URL path based on topic and source type
 */
function generateUrlPath(topic: string, sourceType: string): string {
  // Replace spaces with hyphens and make lowercase
  const formattedTopic = topic.toLowerCase().replace(/\s+/g, '-');
  
  switch (sourceType) {
    case 'resource_page':
      return `/resources/${formattedTopic}-resources`;
    case 'guest_post':
      return `/blog/guest-post-guidelines`;
    case 'directory':
      return `/directory/${formattedTopic}`;
    case 'forum':
      return `/forum/${formattedTopic}-discussion`;
    case 'blog':
      return `/blog/${formattedTopic}-guide`;
    default:
      return `/resources/${formattedTopic}`;
  }
}

/**
 * Seed discovered opportunities with niche-specific data
 */
async function seedDiscoveredOpportunities() {
  console.log('Seeding discovered opportunities...');
  
  // Check if there are already opportunities in the database
  const existingOpps = await db.select({ count: sql`count(*)` }).from(discoveredOpportunities);
  const count = parseInt(existingOpps[0]?.count.toString() || '0');
  
  if (count > 0) {
    console.log(`Database already has ${count} discovered opportunities. Skipping seeding.`);
    return;
  }
  
  // Create opportunities for each niche
  const niches = Object.keys(nicheBasedDomains);
  const opportunitiesPerNiche = 15;
  
  for (const niche of niches) {
    console.log(`Creating opportunities for niche: ${niche}`);
    
    for (let i = 0; i < opportunitiesPerNiche; i++) {
      const domain = getRandomDomainFromNiche(niche);
      const sourceType = getRandomElement(sourceTypes);
      const topic = getRandomTopicFromNiche(niche);
      const title = generateTitle(topic);
      const domainAuthority = generateDomainAuthority();
      const pageAuthority = Math.max(10, domainAuthority - Math.floor(Math.random() * 20));
      const spamScore = generateSpamScore();
      
      // Determine if this should be a premium opportunity (DA 40+, spam <2)
      const isPremium = domainAuthority >= 40 && spamScore <= 2;
      
      // Generate a URL based on the source type and domain with a unique identifier
      // to prevent duplicate URLs
      const uniqueId = Date.now() + i;
      const urlPath = generateUrlPath(topic, sourceType);
      const url = `https://www.${domain}${urlPath}?id=${uniqueId}`;
    
    // Create contact info structure to match schema
    const contactInfo = {
      email: generateContactEmail(domain),
      form: Math.random() > 0.3 ? `https://www.${domain}/contact` : null, // 70% chance of having a contact form
      social: Math.random() > 0.5 ? [`https://twitter.com/${domain.split('.')[0]}`] : []
    };
    
    // Generate a simple validation data object
    const validationData = {
      relevanceScore: 60 + Math.floor(Math.random() * 40),
      qualityScore: domainAuthority * 0.8,
      contentRelevance: 70 + Math.floor(Math.random() * 30),
      keywordDensity: 50 + Math.floor(Math.random() * 50),
      topicMatch: 60 + Math.floor(Math.random() * 40)
    };
    
    // Execute a direct SQL insert to avoid type issues with enums
    try {
      const insertResult = await db.execute(sql`
        INSERT INTO "discoveredOpportunities" (
          "url", 
          "domain", 
          "sourceType", 
          "pageTitle", 
          "pageContent", 
          "contactInfo", 
          "domainAuthority", 
          "pageAuthority", 
          "spamScore", 
          "isPremium", 
          "discoveredAt", 
          "lastChecked", 
          "status", 
          "validationData"
        ) 
        VALUES (
          ${url}, 
          ${domain}, 
          ${sourceType}::source_type, 
          ${title}, 
          ${'This is sample content for a ' + topic + ' opportunity on ' + domain + '. It would contain relevant information that matches user websites.'}, 
          ${JSON.stringify(contactInfo)}::jsonb, 
          ${domainAuthority}, 
          ${pageAuthority}, 
          ${spamScore}, 
          ${isPremium}, 
          ${new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000))}, 
          ${new Date()}, 
          ${'analyzed'}::discovery_status, 
          ${JSON.stringify(validationData)}::jsonb
        )
        RETURNING id
      `);
      
      console.log(`Created opportunity #${i+1} with ID: ${insertResult.rows[0].id}`);
    } catch (error) {
      console.error(`Error creating opportunity #${i+1}:`, error.message);
      continue; // Skip to next opportunity on error
    }
  }
  
  console.log(`Successfully seeded discovered opportunities.`);
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
    console.log(`Database already has ${count} crawler jobs. Skipping seeding.`);
    return;
  }
  
  const jobs = [];
  
  // Generate sample jobs for different types
  const jobTypes = ['resource_page', 'guest_post', 'directory', 'all'];
  
  for (const jobType of jobTypes) {
    // Create completed job
    jobs.push({
      jobType: jobType,
      targetUrl: `https://example.com/${jobType}`,
      status: 'completed',
      startedAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      completedAt: new Date(Date.now() - 86400000), // 1 day ago
      error: null,
      results: JSON.stringify({
        crawled: 15,
        discovered: 8,
        errors: 2
      })
    });
    
    // Create pending job
    jobs.push({
      jobType: jobType,
      targetUrl: `https://example2.com/${jobType}`,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      error: null,
      results: JSON.stringify({})
    });
  }
  
  // Insert the jobs into the database
  const insertedJobs = await db.insert(crawlerJobs).values(jobs).returning();
  
  console.log(`Successfully seeded ${insertedJobs.length} crawler jobs.`);
}

/**
 * Run the discovery pipeline
 */
async function runDiscoveryPipeline() {
  console.log('Running discovery pipeline...');
  
  // Get the discovery scheduler
  const scheduler = getDiscoveryScheduler();
  
  // Run the pipeline
  const result = await scheduler.runDiscoveryPipeline();
  
  console.log('Discovery pipeline completed:', result);
}

/**
 * Create website profiles for existing websites
 */
async function createWebsiteProfiles() {
  console.log('Creating website profiles...');
  
  // Get all websites without profiles
  const userWebsites = await db.select().from(websites);
  
  if (userWebsites.length === 0) {
    console.log('No websites found to create profiles for.');
    return;
  }
  
  // Check which websites already have profiles
  const existingProfiles = await db.select().from(websiteProfiles);
  const websiteIdsWithProfiles = new Set(existingProfiles.map(profile => profile.websiteId));
  
  // Filter to websites without profiles
  const websitesWithoutProfiles = userWebsites.filter(website => !websiteIdsWithProfiles.has(website.id));
  
  if (websitesWithoutProfiles.length === 0) {
    console.log('All websites already have profiles.');
    return;
  }
  
  console.log(`Creating profiles for ${websitesWithoutProfiles.length} websites...`);
  
  // Sample topics and keywords to use for profiles
  const sampleTopics = [
    ['SEO', 'Link Building', 'Backlinks'],
    ['Content Marketing', 'Blogging', 'Writing'],
    ['Social Media', 'Twitter', 'LinkedIn'],
    ['Email Marketing', 'Newsletters', 'Automation'],
    ['Web Development', 'JavaScript', 'React'],
  ];
  
  const sampleKeywords = [
    ['backlinks', 'seo', 'organic traffic', 'google ranking', 'anchor text', 'domain authority'],
    ['content', 'blog', 'article', 'writing', 'publishing', 'audience'],
    ['social media', 'engagement', 'followers', 'platform', 'strategy', 'facebook'],
    ['email', 'newsletter', 'subscriber', 'conversion', 'autoresponder', 'open rate'],
    ['development', 'code', 'programming', 'web', 'responsive', 'frontend'],
  ];
  
  const profiles = [];
  
  // Create profiles for each website
  for (const website of websitesWithoutProfiles) {
    const topicIndex = Math.floor(Math.random() * sampleTopics.length);
    
    profiles.push({
      websiteId: website.id,
      content: `Sample content for ${website.url} covering topics like ${sampleTopics[topicIndex].join(', ')}`,
      topics: sampleTopics[topicIndex],
      keywords: sampleKeywords[topicIndex],
      metadata: {
        title: `${website.name} - Professional Website`,
        description: `${website.name} is focused on ${sampleTopics[topicIndex][0]} and related topics`,
        h1: website.name,
        wordCount: 2500 + Math.floor(Math.random() * 2500)
      },
      lastAnalyzed: new Date()
    });
  }
  
  // Insert the profiles
  const insertedProfiles = await db.insert(websiteProfiles).values(profiles).returning();
  
  console.log(`Successfully created ${insertedProfiles.length} website profiles.`);
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
  
  // Get user IDs for the websites
  const userIds = [...new Set(websiteWithProfiles.map(item => item.website.userId))];
  
  // Create 5-10 matches per user
  for (const userId of userIds) {
    // Get websites for this user
    const userWebsites = websiteWithProfiles.filter(item => item.website.userId === userId);
    
    // Determine how many matches to create
    const matchCount = 5 + Math.floor(Math.random() * 6); // 5-10 matches
    
    // Create the matches
    for (let i = 0; i < matchCount; i++) {
      // Pick a random website for this user
      const websiteIndex = Math.floor(Math.random() * userWebsites.length);
      const website = userWebsites[websiteIndex].website;
      
      // Pick a random opportunity
      const opportunityIndex = Math.floor(Math.random() * opportunities.length);
      const opportunity = opportunities[opportunityIndex];
      
      // Determine if this is a premium match
      const isPremium = opportunity.isPremium || false;
      
      // Create matchReason object
      const matchReason = {
        relevance: {
          score: 70 + Math.floor(Math.random() * 30),
          factors: ['Content topic match', 'Niche alignment']
        },
        quality: {
          score: Math.floor(Math.random() * 100),
          factors: ['Domain authority', 'Low spam score']
        },
        opportunity: {
          score: 80 + Math.floor(Math.random() * 20),
          factors: ['Contact info available', 'Resource page']
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
        
        // Create daily drip (for a portion of matches)
        if (i < 5) { // Only create drips for the first 5 matches
          const dripResult = await db.execute(sql`
            INSERT INTO "dailyDrips" (
              "userId",
              "opportunityId",
              "dripDate",
              "isPremium",
              "status"
            ) VALUES (
              ${userId},
              ${opportunity.id},
              ${new Date()},
              ${isPremium},
              ${'active'}
            )
            RETURNING id
          `);
          
          // Add to drips count for logging
          drips.push(dripResult.rows[0].id);
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