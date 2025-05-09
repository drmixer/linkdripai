// Script to seed the database with sample prospects
import { db } from '../server/db';
import { prospects } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { InsertProspect } from '../shared/schema';

async function seedProspects() {
  console.log('Seeding prospects...');
  
  // Check if there are already prospects in the database
  const existingProspects = await db.select({ count: sql`count(*)` }).from(prospects);
  const count = parseInt(existingProspects[0]?.count || '0');
  if (count > 0) {
    console.log(`Database already has ${count} prospects. Skipping seeding.`);
    process.exit(0);
  }
  
  // Create some sample prospect data
  const niches = ["Digital Marketing", "SEO", "Content", "Web Dev", "Programming", "Business"];
  const siteTypes = ["Blog with guest posting", "Premium blog", "Tutorial site", "News site", "Resource directory"];
  
  const sampleProspects: Partial<InsertProspect>[] = [];
  
  for (let i = 0; i < 20; i++) {
    const niche = niches[Math.floor(Math.random() * niches.length)];
    const siteType = siteTypes[Math.floor(Math.random() * siteTypes.length)];
    const da = Math.floor(Math.random() * 80) + 20;
    const pa = Math.floor(Math.random() * 50) + 20;
    const spamScore = Math.floor(Math.random() * 10);
    const trafficK = Math.floor(Math.random() * 200) + 30;
    const fitScore = Math.floor(Math.random() * 30) + 70;
    
    // Generate domain and website name
    const domainWords = niche.toLowerCase().split(' ');
    const domain = `${domainWords.join('')}${Math.floor(Math.random() * 1000)}.com`;
    const siteName = `${niche} ${siteType.split(' ')[0]} ${Math.floor(Math.random() * 100)}`;
    
    // Generate some sample match reasons based on the metrics
    const matchReasons: string[] = [];
    
    if (da >= 70) {
      matchReasons.push(`High domain authority (${da})`);
    } else if (da >= 40) {
      matchReasons.push(`Good domain authority (${da})`);
    }
    
    if (trafficK >= 150) {
      matchReasons.push(`Excellent monthly traffic (${trafficK}K visits)`);
    } else if (trafficK >= 80) {
      matchReasons.push(`Strong monthly traffic (${trafficK}K visits)`);
    }
    
    // Add niche-based reasons
    matchReasons.push(`Relevant ${niche.toLowerCase()} website that matches your content`);
    
    // Add type-based reasons
    if (siteType.includes("guest posting")) {
      matchReasons.push("Accepts guest posts (easy outreach)");
    } else if (siteType.includes("Resource")) {
      matchReasons.push("Resource listing opportunity (high conversion)");
    } else if (siteType.includes("Tutorial")) {
      matchReasons.push("Tutorial site with high educational value (trusted resource)");
    }
    
    // Add low spam score reason if applicable
    if (spamScore < 3) {
      matchReasons.push(`Very low spam score (${spamScore}/10) indicating high quality site`);
    }
    
    sampleProspects.push({
      siteType,
      siteName,
      domain,
      niche,
      domainAuthority: `${da}`,
      pageAuthority: `${pa}`,
      spamScore: `${spamScore}`,
      totalLinks: `${Math.floor(Math.random() * 10000)}`,
      rootDomainsLinking: `${Math.floor(Math.random() * 1000)}`,
      lastCrawled: new Date(),
      contactEmail: `contact@${domain}`,
      contactRole: ["Editor", "Owner", "Webmaster", "Content Manager"][Math.floor(Math.random() * 4)],
      monthlyTraffic: `${trafficK}K`,
      fitScore,
      matchReasons,
      isUnlocked: false,
      isSaved: false,
      isHidden: false,
      isNew: i < 5, // Make the first 5 prospects "new"
    });
  }
  
  // Insert the prospects into the database
  const insertedProspects = await db.insert(prospects).values(sampleProspects as any[]).returning();
  
  console.log(`Successfully seeded ${insertedProspects.length} prospects.`);
  process.exit(0);
}

seedProspects().catch(error => {
  console.error('Error seeding database:', error);
  process.exit(1);
});