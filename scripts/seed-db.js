// Script to seed the database with sample prospects
import { db } from '../server/db.js';
import { prospects } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

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
  
  const sampleProspects = [];
  
  for (let i = 0; i < 20; i++) {
    const niche = niches[Math.floor(Math.random() * niches.length)];
    const siteType = siteTypes[Math.floor(Math.random() * siteTypes.length)];
    const da = Math.floor(Math.random() * 80) + 20;
    const trafficK = Math.floor(Math.random() * 200) + 30;
    const fitScore = Math.floor(Math.random() * 30) + 70;
    
    sampleProspects.push({
      siteType,
      domainAuthority: `${da}`,
      niche,
      monthlyTraffic: `${trafficK}K`,
      fitScore,
      isUnlocked: false,
      isSaved: false,
    });
  }
  
  // Insert the prospects into the database
  const insertedProspects = await db.insert(prospects).values(sampleProspects).returning();
  
  console.log(`Successfully seeded ${insertedProspects.length} prospects.`);
  process.exit(0);
}

seedProspects().catch(error => {
  console.error('Error seeding database:', error);
  process.exit(1);
});