/**
 * Script to check memory usage and identify potential memory leaks
 * This helps diagnose server downtime issues
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, desc, sql } from 'drizzle-orm';
import * as schema from '../shared/schema';
import ws from 'ws';

// Configure neon to use the WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

// Format memory size to human-readable format
function formatMemoryUsage(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
}

// Check system resource usage
async function checkSystemResources() {
  console.log('==== System Resource Check ====');
  
  // Node.js memory usage
  const memoryUsage = process.memoryUsage();
  
  console.log('Memory Usage:');
  console.log(`- RSS (Resident Set Size): ${formatMemoryUsage(memoryUsage.rss)}`);
  console.log(`- Heap Total: ${formatMemoryUsage(memoryUsage.heapTotal)}`);
  console.log(`- Heap Used: ${formatMemoryUsage(memoryUsage.heapUsed)}`);
  console.log(`- External: ${formatMemoryUsage(memoryUsage.external)}`);
  console.log(`- Array Buffers: ${formatMemoryUsage(memoryUsage.arrayBuffers || 0)}`);
  
  // Check memory usage percentage
  const heapUsedPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  console.log(`Heap Usage: ${heapUsedPercentage.toFixed(2)}%`);
  
  if (heapUsedPercentage > 85) {
    console.log('⚠️ WARNING: Heap usage is very high (>85%)');
  } else if (heapUsedPercentage > 70) {
    console.log('⚠️ NOTICE: Heap usage is getting high (>70%)');
  }
  
  // CPU usage estimate (very rough approximation)
  const startTime = process.hrtime();
  const startUsage = process.cpuUsage();
  
  // Do some CPU-intensive work
  let sum = 0;
  for (let i = 0; i < 10000000; i++) {
    sum += i;
  }
  
  const elapTime = process.hrtime(startTime);
  const elapUsage = process.cpuUsage(startUsage);
  
  const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
  const elapUserMS = elapUsage.user / 1000;
  const elapSystMS = elapUsage.system / 1000;
  const cpuPercent = Math.round(100 * (elapUserMS + elapSystMS) / elapTimeMS);
  
  console.log(`Estimated CPU Load: ${cpuPercent}%`);
  
  if (cpuPercent > 80) {
    console.log('⚠️ WARNING: CPU usage is very high');
  }
}

// Check active crawler jobs that might be causing load
async function checkActiveCrawlerJobs() {
  console.log('\n==== Active Crawler Jobs ====');
  
  try {
    const activeJobs = await db.select()
      .from(schema.crawlerJobs)
      .where(eq(schema.crawlerJobs.status, 'in_progress'))
      .orderBy(desc(schema.crawlerJobs.startedAt));
    
    console.log(`Found ${activeJobs.length} active crawler jobs`);
    
    if (activeJobs.length > 0) {
      activeJobs.forEach(job => {
        const duration = job.startedAt 
          ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)
          : 0;
        
        console.log(`- Job #${job.id}: ${job.jobType}, running for ${duration} seconds`);
      });
      
      // Check for long-running jobs
      const longRunningJobs = activeJobs.filter(job => {
        const duration = job.startedAt 
          ? Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000)
          : 0;
        return duration > 3600; // More than 1 hour
      });
      
      if (longRunningJobs.length > 0) {
        console.log(`⚠️ WARNING: Found ${longRunningJobs.length} long-running jobs (>1 hour)`);
      }
    }
  } catch (error) {
    console.error('Error checking crawler jobs:', error);
  }
}

// Check for problematic database queries
async function checkDatabaseQueries() {
  console.log('\n==== Database Query Analysis ====');
  
  try {
    // Check for long-running queries
    const longRunningQueries = await pool.query(`
      SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
      FROM pg_stat_activity 
      WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 seconds'
      ORDER BY duration DESC;
    `);
    
    if (longRunningQueries.rowCount > 0) {
      console.log(`Found ${longRunningQueries.rowCount} long-running queries (>5 seconds)`);
      longRunningQueries.rows.forEach((query, i) => {
        console.log(`- Query #${i+1}: Running for ${query.duration}`);
        console.log(`  ${query.query.substring(0, 100)}...`);
      });
    } else {
      console.log('No long-running queries detected.');
    }
    
    // Check database size
    const dbSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `);
    
    console.log(`Current database size: ${dbSize.rows[0].size}`);
    
    // Check table sizes
    const tableSizes = await pool.query(`
      SELECT 
        tablename, 
        pg_size_pretty(pg_total_relation_size('"' || tablename || '"')) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('"' || tablename || '"') DESC
      LIMIT 5;
    `);
    
    console.log('Top 5 largest tables:');
    tableSizes.rows.forEach((table, i) => {
      console.log(`- ${i+1}. ${table.tablename}: ${table.size}`);
    });
  } catch (error) {
    console.error('Error checking database queries:', error);
  }
}

// Main function to run the check
async function runResourceCheck() {
  console.log('🔍 Starting system resource and performance check...');
  
  try {
    // Check system resources
    await checkSystemResources();
    
    // Check active crawler jobs
    await checkActiveCrawlerJobs();
    
    // Check database queries
    await checkDatabaseQueries();
    
    console.log('\n✅ Resource check completed!');
    console.log('\nRecommendations:');
    console.log('1. If memory usage is high (>85%), consider terminating long-running processes');
    console.log('2. If crawler jobs have been running for hours, they may need to be restarted');
    console.log('3. Long-running database queries may indicate optimization opportunities');
    console.log('4. Consider implementing a process manager like PM2 for automatic restarts');
    
  } catch (error) {
    console.error('❌ Error during resource check:', error);
  } finally {
    await pool.end();
  }
}

// Run the check when imported as a module
// For ESM compatibility
runResourceCheck();

export { runResourceCheck };