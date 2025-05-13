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

// List of realistic domains for backlink opportunities
const sampleDomains = [
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
  'buffer.com',
  'hubspot.com',
  'sproutsocial.com',
  'socialmediaexaminer.com',
  'smartblogger.com',
  'bloggingwizard.com',
  'problogger.com',
  'searchengineland.com',
  'marketingprofs.com'
];

// Relevant topics and keywords for backlink opportunities
const topics = [
  'SEO',
  'Content Marketing',
  'Social Media Marketing',
  'Email Marketing',
  'Digital Marketing',
  'Blogging',
  'Link Building',
  'Keyword Research',
  'Web Development',
  'WordPress'
];

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
 * Seed discovered opportunities
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
  
  const opportunities = [];
  
  // Generate sample opportunities
  for (let i = 0; i < 40; i++) {
    const domain = getRandomElement(sampleDomains);
    const sourceType = getRandomElement(sourceTypes);
    const topic = getRandomElement(topics);
    const title = generateTitle(topic);
    const domainAuthority = generateDomainAuthority();
    const pageAuthority = Math.max(10, domainAuthority - Math.floor(Math.random() * 20));
    const spamScore = generateSpamScore();
    
    // Determine if this should be a premium opportunity
    const isPremium = domainAuthority >= 40 && spamScore <= 2;
    
    // Generate a URL based on the source type and domain
    let url;
    switch (sourceType) {
      case 'resource_page':
        url = `https://www.${domain}/resources/${topic.toLowerCase().replace(/\s+/g, '-')}`;
        break;
      case 'guest_post':
        url = `https://www.${domain}/write-for-us`;
        break;
      case 'directory':
        url = `https://www.${domain}/directory`;
        break;
      case 'forum':
        url = `https://www.${domain}/forum/${topic.toLowerCase().replace(/\s+/g, '-')}`;
        break;
      default:
        url = `https://www.${domain}/blog/${topic.toLowerCase().replace(/\s+/g, '-')}`;
    }
    
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
    
    opportunities.push({
      url,
      domain,
      sourceType,
      pageTitle: title,
      pageContent: `This is sample content for a ${topic} opportunity on ${domain}. It would contain relevant information that matches user websites.`,
      contactInfo,
      domainAuthority,
      pageAuthority,
      spamScore,
      isPremium,
      discoveredAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)), // Random date in the last 30 days
      lastChecked: new Date(),
      status: 'analyzed',
      validationData
    });
  }
  
  // Insert the opportunities into the database
  const insertedOpps = await db.insert(discoveredOpportunities).values(opportunities).returning();
  
  console.log(`Successfully seeded ${insertedOpps.length} discovered opportunities.`);
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
      type: jobType,
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
      type: jobType,
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
      
      // Create match
      matches.push({
        opportunityId: opportunity.id,
        userId,
        websiteId: website.id,
        assignedAt: new Date(),
        status: 'active',
        isPremium
      });
      
      // Create daily drip (for a portion of matches)
      if (i < 5) { // Only create drips for the first 5 matches
        drips.push({
          userId,
          opportunityId: opportunity.id,
          dripDate: new Date(),
          isPremium,
          status: 'active'
        });
      }
    }
  }
  
  // Insert the matches
  if (matches.length > 0) {
    const insertedMatches = await db.insert(opportunityMatches).values(matches).returning();
    console.log(`Successfully created ${insertedMatches.length} opportunity matches.`);
  }
  
  // Insert the drips
  if (drips.length > 0) {
    const insertedDrips = await db.insert(dailyDrips).values(drips).returning();
    console.log(`Successfully created ${insertedDrips.length} daily drips.`);
  }
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