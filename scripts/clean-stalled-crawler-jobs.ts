/**
 * Script to clean up stalled crawler jobs
 * 
 * This script identifies and terminates crawler jobs that have been running for
 * an excessive amount of time, likely due to getting stuck or encountering errors.
 * It helps prevent memory leaks and performance degradation.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, lt, gt, sql } from 'drizzle-orm';
import * as schema from '../shared/schema';
import ws from 'ws';
import { setTimeout } from 'timers/promises';

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
const BATCH_SIZE = 20; // Process stalled jobs in batches to avoid database overload

interface CleanupStats {
  totalStalledJobs: number;
  cleanedJobs: number;
  failedJobs: number;
  jobsById: Record<number, {
    id: number;
    jobType: string; 
    status: string;
    startedAt: Date | null;
    duration: number; // in seconds
    outcome: 'cleaned' | 'failed';
  }>;
}

/**
 * Main function to clean up stalled crawler jobs
 */
async function cleanStalledCrawlerJobs() {
  console.log('Starting stalled crawler job cleanup...');
  
  try {
    const stats: CleanupStats = {
      totalStalledJobs: 0,
      cleanedJobs: 0,
      failedJobs: 0,
      jobsById: {}
    };
    
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
    
    stats.totalStalledJobs = stalledJobs.length;
    console.log(`Found ${stalledJobs.length} stalled crawler jobs...`);
    
    // Process stalled jobs in batches
    for (let i = 0; i < stalledJobs.length; i += BATCH_SIZE) {
      const batch = stalledJobs.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(stalledJobs.length / BATCH_SIZE)}`);
      
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
          
          console.log(`Cleaned job #${job.id}: ${job.jobType}, was running for ${durationInSeconds} seconds`);
          
          stats.cleanedJobs++;
          stats.jobsById[job.id] = {
            id: job.id,
            jobType: job.jobType,
            status: job.status,
            startedAt: job.startedAt,
            duration: durationInSeconds,
            outcome: 'cleaned'
          };
        } catch (error) {
          console.error(`Failed to clean job #${job.id}: ${error}`);
          
          stats.failedJobs++;
          if (job.startedAt) {
            const duration = Math.round((new Date().getTime() - new Date(job.startedAt).getTime()) / 1000);
            stats.jobsById[job.id] = {
              id: job.id,
              jobType: job.jobType,
              status: job.status,
              startedAt: job.startedAt,
              duration: duration,
              outcome: 'failed'
            };
          }
        }
        
        // Brief pause to avoid overwhelming the database
        await setTimeout(100);
      }
      
      // Longer pause between batches
      await setTimeout(1000);
    }
    
    // Generate summary report
    console.log('\n=== Cleanup Summary ===');
    console.log(`Total stalled jobs: ${stats.totalStalledJobs}`);
    console.log(`Successfully cleaned: ${stats.cleanedJobs}`);
    console.log(`Failed to clean: ${stats.failedJobs}`);
    
    // Show job types summary
    const jobTypeCounts: Record<string, number> = {};
    Object.values(stats.jobsById).forEach(job => {
      jobTypeCounts[job.jobType] = (jobTypeCounts[job.jobType] || 0) + 1;
    });
    
    console.log('\nJob Types Cleaned:');
    Object.entries(jobTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`- ${type}: ${count}`);
      });
    
    // Show longest running jobs
    const topJobs = Object.values(stats.jobsById)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    console.log('\nLongest Running Jobs Cleaned:');
    topJobs.forEach(job => {
      const hours = Math.floor(job.duration / 3600);
      const minutes = Math.floor((job.duration % 3600) / 60);
      console.log(`- Job #${job.id}: ${job.jobType}, running for ${hours}h ${minutes}m (${job.outcome})`);
    });
    
    console.log('\nCleanup completed!');
  } catch (error) {
    console.error('Error during crawler job cleanup:', error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup if this script is executed directly
cleanStalledCrawlerJobs();