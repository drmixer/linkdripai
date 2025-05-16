/**
 * Maintenance Service for LinkDripAI
 * 
 * This service handles automated maintenance tasks:
 * 1. Cleaning up stalled crawler jobs
 * 2. Monitoring system resources
 * 3. Preventing memory leaks
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, lt, gt } from 'drizzle-orm';
import * as schema from '@shared/schema';
import ws from 'ws';
import { setTimeout } from 'timers/promises';
import cron from 'node-cron';

// Configure neon to use the WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

// Constants
const MAX_JOB_DURATION_HOURS = 1; // Jobs running more than this are considered stalled
const BATCH_SIZE = 10; // Process stalled jobs in smaller batches to avoid timeouts
const PAUSE_BETWEEN_JOBS_MS = 50; // Shorter pause between jobs
const PAUSE_BETWEEN_BATCHES_MS = 500; // Shorter pause between batches

/**
 * Clean up stalled crawler jobs
 */
async function cleanStalledCrawlerJobs() {
  console.log('[MaintenanceService] Starting stalled crawler job cleanup...');
  
  try {
    let cleanedJobs = 0;
    let failedJobs = 0;
    
    // Calculate cutoff time for stalled jobs
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MAX_JOB_DURATION_HOURS);
    
    // Find stalled jobs (in_progress status and started more than MAX_JOB_DURATION_HOURS ago)
    const stalledJobs = await db.select()
      .from(schema.crawlerJobs)
      .where(
        and(
          eq(schema.crawlerJobs.status, 'in_progress'),
          lt(schema.crawlerJobs.startedAt, cutoffTime)
        )
      )
      .orderBy(schema.crawlerJobs.startedAt);
    
    const totalStalledJobs = stalledJobs.length;
    console.log(`[MaintenanceService] Found ${totalStalledJobs} stalled crawler jobs...`);
    
    if (totalStalledJobs === 0) {
      console.log('[MaintenanceService] No stalled jobs to clean up.');
      return;
    }
    
    // Process stalled jobs in batches
    for (let i = 0; i < stalledJobs.length; i += BATCH_SIZE) {
      const batch = stalledJobs.slice(i, i + BATCH_SIZE);
      console.log(`[MaintenanceService] Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(stalledJobs.length / BATCH_SIZE)}`);
      
      for (const job of batch) {
        try {
          const now = new Date();
          const startTime = job.startedAt ? new Date(job.startedAt) : now;
          const durationInSeconds = Math.round((now.getTime() - startTime.getTime()) / 1000);
          
          // Update job status to 'failed' and set completion time
          await db.update(schema.crawlerJobs)
            .set({
              status: 'failed',
              completedAt: now,
              error: 'Job automatically terminated due to exceeding maximum runtime',
              updatedAt: now
            })
            .where(eq(schema.crawlerJobs.id, job.id));
          
          console.log(`[MaintenanceService] Cleaned job #${job.id}: ${job.jobType}, was running for ${durationInSeconds} seconds`);
          cleanedJobs++;
        } catch (error) {
          console.error(`[MaintenanceService] Failed to clean job #${job.id}:`, error);
          failedJobs++;
        }
        
        // Brief pause to avoid overwhelming the database
        await setTimeout(PAUSE_BETWEEN_JOBS_MS);
      }
      
      // Shorter pause between batches
      await setTimeout(PAUSE_BETWEEN_BATCHES_MS);
    }
    
    console.log(`[MaintenanceService] Cleanup complete. Successfully cleaned ${cleanedJobs} jobs. Failed to clean ${failedJobs} jobs.`);
  } catch (error) {
    console.error('[MaintenanceService] Error during crawler job cleanup:', error);
  }
}

/**
 * Initialize maintenance service with scheduled tasks
 */
export function initMaintenanceService() {
  console.log('[MaintenanceService] Initializing maintenance service...');
  
  // Schedule stalled job cleanup to run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await cleanStalledCrawlerJobs();
    } catch (error) {
      console.error('[MaintenanceService] Error running scheduled cleanup:', error);
    }
  });
  
  console.log('[MaintenanceService] Scheduled job cleanup to run every 15 minutes');
  
  // Run an initial cleanup when the server starts
  setTimeout(2000).then(() => {
    cleanStalledCrawlerJobs().catch((err) => {
      console.error('[MaintenanceService] Error running initial cleanup:', err);
    });
  });
}