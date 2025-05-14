/**
 * Email Status Display Analysis
 * 
 * This script analyzes the current state of contact activities and suggests improvements
 * for visual indicators of email status in the dashboard.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, not, isNull, count, sql } from 'drizzle-orm';
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

/**
 * Analyze contact activities and status distributions
 */
async function analyzeContactActivities() {
  console.log('Analyzing contact activities and email status distribution...');
  
  try {
    // Count activities by type
    const activityTypes = await db
      .select({
        type: schema.contactActivities.type,
        count: count(),
      })
      .from(schema.contactActivities)
      .groupBy(schema.contactActivities.type);
    
    console.log('\n=== Activity Types ===');
    activityTypes.forEach(type => {
      console.log(`${type.type}: ${type.count}`);
    });
    
    // Count activities by status
    const activityStatus = await db
      .select({
        status: schema.contactActivities.status,
        count: count(),
      })
      .from(schema.contactActivities)
      .groupBy(schema.contactActivities.status);
    
    console.log('\n=== Activity Status ===');
    activityStatus.forEach(status => {
      console.log(`${status.status}: ${status.count}`);
    });
    
    // Count activities by type and status
    const typeStatusMatrix = await db
      .select({
        type: schema.contactActivities.type,
        status: schema.contactActivities.status,
        count: count(),
      })
      .from(schema.contactActivities)
      .groupBy(schema.contactActivities.type, schema.contactActivities.status);
    
    console.log('\n=== Type/Status Matrix ===');
    
    // Create a map for easier access
    const matrix: Record<string, Record<string, number>> = {};
    typeStatusMatrix.forEach(item => {
      if (!matrix[item.type]) {
        matrix[item.type] = {};
      }
      matrix[item.type][item.status] = item.count;
    });
    
    // Determine all status values
    const allStatuses = [...new Set(typeStatusMatrix.map(item => item.status))].sort();
    
    // Print header row
    console.log('Type | ' + allStatuses.join(' | '));
    console.log('-'.repeat(100));
    
    // Print each type's stats
    Object.keys(matrix).forEach(type => {
      const values = allStatuses.map(status => matrix[type][status] || 0);
      console.log(`${type} | ${values.join(' | ')}`);
    });
    
    // Analyze email activities specifically
    const emailActivities = await db
      .select({
        count: count(),
      })
      .from(schema.contactActivities)
      .where(eq(schema.contactActivities.type, 'email'));
    
    const emailCount = emailActivities[0]?.count || 0;
    
    // Get opportunities with emails
    const opportunitiesWithEmails = await db
      .select({
        count: count(),
      })
      .from(schema.discoveredOpportunities)
      .where(
        sql`${schema.discoveredOpportunities.contactInfo}::jsonb->'emails' IS NOT NULL AND 
            jsonb_array_length(${schema.discoveredOpportunities.contactInfo}::jsonb->'emails') > 0`
      );
    
    const withEmailsCount = opportunitiesWithEmails[0]?.count || 0;
    
    // Calculate email outreach percentage
    const emailOutreachPercentage = emailCount > 0 && withEmailsCount > 0
      ? Math.round((emailCount / withEmailsCount) * 100)
      : 0;
    
    console.log('\n=== Email Outreach Coverage ===');
    console.log(`Opportunities with emails: ${withEmailsCount}`);
    console.log(`Email activities recorded: ${emailCount}`);
    console.log(`Coverage: ${emailOutreachPercentage}%`);
    
    // Generate dashboard improvement recommendations
    console.log('\n=== Dashboard Improvement Recommendations ===');
    
    // Determine if we have a "Sent" folder distinct from other statuses
    const hasSentStatus = activityStatus.some(status => 
      status.status === 'sent' || status.status === 'delivered'
    );
    
    if (!hasSentStatus) {
      console.log('1. Add distinct "Sent" status to clearly track sent emails');
    }
    
    // Check if we have visual indicators for different statuses
    console.log('2. Add clear visual indicators for email status:');
    console.log('   - Pending: Gray/yellow icon');
    console.log('   - Sent: Blue icon');
    console.log('   - Delivered: Green icon');
    console.log('   - Opened: Green check icon');
    console.log('   - Replied: Green double-check icon');
    console.log('   - Failed: Red warning icon');
    console.log('   - Bounced: Red exclamation icon');
    
    // Email engagement metrics recommendation
    console.log('3. Add email engagement metrics to dashboard:');
    console.log('   - Open rate: % of sent emails that were opened');
    console.log('   - Reply rate: % of sent emails that received replies');
    console.log('   - Response time: Average time to reply');
    
    // Status transition recommendation
    console.log('4. Implement status transition history:');
    console.log('   - Track when emails change status');
    console.log('   - Display timeline of status changes');
    console.log('   - Allow filtering by current status');
    
    // Email batch tracking
    console.log('5. Add batch tracking and analytics:');
    console.log('   - Group emails sent in campaigns/batches');
    console.log('   - Track performance metrics by batch');
    console.log('   - Compare effectiveness across different batches');
    
    console.log('\nAnalysis complete!');
  } catch (error) {
    console.error('Error analyzing contact activities:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeContactActivities();