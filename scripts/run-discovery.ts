// Script to run the discovery pipeline
import { getDiscoveryScheduler } from '../server/services/discovery-scheduler';

async function runDiscovery() {
  console.log('Starting discovery pipeline...');
  
  try {
    const scheduler = getDiscoveryScheduler();
    const result = await scheduler.runDiscoveryPipeline();
    
    console.log('Discovery pipeline completed with result:', result);
    
    if (result.success) {
      console.log('Statistics:');
      console.log(`- Websites analyzed: ${result.stats.websitesAnalyzed}`);
      console.log(`- Opportunities discovered: ${result.stats.opportunitiesDiscovered}`);
      console.log(`- Matches created: ${result.stats.matchesCreated}`);
      console.log(`- Drips assigned: ${result.stats.dripsAssigned}`);
      console.log(`- Errors: ${result.stats.errors}`);
      console.log(`- Duration: ${result.stats.durationMs} ms`);
    } else {
      console.log('Discovery pipeline failed or was skipped');
      console.log('Reason:', result.stats);
    }
  } catch (error) {
    console.error('Error running discovery pipeline:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runDiscovery();