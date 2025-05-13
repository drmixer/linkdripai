// Script to clear all opportunities and related data from the database
import { db } from '../server/db';
import { 
  discoveredOpportunities, 
  opportunityMatches, 
  dailyDrips
} from '../shared/schema';
import { sql } from 'drizzle-orm';

async function clearOpportunities() {
  console.log('Clearing all opportunities and related data...');
  
  try {
    // First delete all daily drips
    const dripsResult = await db.execute(sql`DELETE FROM "dailyDrips"`);
    console.log(`Deleted ${dripsResult.rowCount} daily drips.`);
    
    // Then delete all opportunity matches
    const matchesResult = await db.execute(sql`DELETE FROM "opportunityMatches"`);
    console.log(`Deleted ${matchesResult.rowCount} opportunity matches.`);
    
    // Finally delete all discovered opportunities
    const oppsResult = await db.execute(sql`DELETE FROM "discoveredOpportunities"`);
    console.log(`Deleted ${oppsResult.rowCount} discovered opportunities.`);
    
    console.log('Successfully cleared all opportunity data.');
  } catch (error) {
    console.error('Error clearing opportunities:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the main function
clearOpportunities().then(() => {
  console.log('All done!');
});