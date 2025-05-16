/**
 * This script adds support for multi-channel outreach
 * by creating new tables and types required for tracking different
 * outreach methods beyond just email (social media, contact forms, etc.)
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// Configure neon to use WebSocket
neonConfig.webSocketConstructor = ws;

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function addMultiChannelOutreachSupport() {
  try {
    console.log('Adding multi-channel outreach support to the database...');
    
    // Add the outreach channel type if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_channel') THEN
          CREATE TYPE outreach_channel AS ENUM (
            'email',
            'linkedin',
            'twitter',
            'facebook',
            'instagram',
            'contact_form',
            'phone',
            'other'
          );
        END IF;
      END $$;
    `);
    
    console.log('Created outreach_channel enum type');
    
    // Add the outreach status type if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_status') THEN
          CREATE TYPE outreach_status AS ENUM (
            'draft',
            'scheduled',
            'sent',
            'delivered',
            'opened',
            'clicked',
            'replied',
            'failed',
            'bounced'
          );
        END IF;
      END $$;
    `);
    
    console.log('Created outreach_status enum type');
    
    // Check if outreach_messages table exists, if not create it
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS outreach_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opportunity_id INTEGER NOT NULL REFERENCES discovered_opportunities(id) ON DELETE CASCADE,
        channel outreach_channel NOT NULL,
        status outreach_status NOT NULL DEFAULT 'draft',
        subject TEXT,
        message TEXT NOT NULL,
        template_id INTEGER,
        scheduled_for TIMESTAMP,
        sent_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Created outreach_messages table');
    
    // Check if we need to add indexes for performance
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'outreach_messages' AND indexname = 'outreach_messages_user_id_idx'
        ) THEN
          CREATE INDEX outreach_messages_user_id_idx ON outreach_messages(user_id);
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'outreach_messages' AND indexname = 'outreach_messages_opportunity_id_idx'
        ) THEN
          CREATE INDEX outreach_messages_opportunity_id_idx ON outreach_messages(opportunity_id);
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'outreach_messages' AND indexname = 'outreach_messages_status_idx'
        ) THEN
          CREATE INDEX outreach_messages_status_idx ON outreach_messages(status);
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'outreach_messages' AND indexname = 'outreach_messages_channel_idx'
        ) THEN
          CREATE INDEX outreach_messages_channel_idx ON outreach_messages(channel);
        END IF;
      END $$;
    `);
    
    console.log('Added indexes to outreach_messages table');
    
    // Create outreach templates table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS outreach_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        channel outreach_channel NOT NULL,
        subject TEXT,
        content TEXT NOT NULL,
        variables JSONB,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Created outreach_templates table');
    
    // Add indexes for outreach_templates
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'outreach_templates' AND indexname = 'outreach_templates_user_id_idx'
        ) THEN
          CREATE INDEX outreach_templates_user_id_idx ON outreach_templates(user_id);
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE tablename = 'outreach_templates' AND indexname = 'outreach_templates_channel_idx'
        ) THEN
          CREATE INDEX outreach_templates_channel_idx ON outreach_templates(channel);
        END IF;
      END $$;
    `);
    
    console.log('Added indexes to outreach_templates table');
    
    // Create default templates for each channel
    await createDefaultTemplates();
    
    console.log('Multi-channel outreach support added successfully!');
  } catch (error) {
    console.error('Error adding multi-channel outreach support:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function createDefaultTemplates() {
  // Email template
  await db.execute(sql`
    INSERT INTO outreach_templates (
      user_id, name, description, channel, subject, content, variables, is_default
    )
    SELECT 
      1, 
      'Default Email Template', 
      'Standard email outreach template for link building', 
      'email'::outreach_channel, 
      'Opportunity for collaboration with {{website_name}}', 
      'Hi {{first_name}},\n\nI came across your article on {{article_title}} and noticed it would be a great fit for a resource I recently published about {{topic}}.\n\nWould you be interested in checking it out? I believe it would add value to your readers.\n\nBest regards,\n{{sender_name}}\n{{sender_website}}',
      '{"variables": ["first_name", "website_name", "article_title", "topic", "sender_name", "sender_website"]}',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM outreach_templates WHERE channel = 'email' AND is_default = true
    );
  `);
  
  // LinkedIn template
  await db.execute(sql`
    INSERT INTO outreach_templates (
      user_id, name, description, channel, subject, content, variables, is_default
    )
    SELECT 
      1, 
      'Default LinkedIn Template', 
      'Standard LinkedIn connection and outreach message', 
      'linkedin'::outreach_channel, 
      'Connection Request', 
      'Hi {{first_name}},\n\nI noticed your content about {{topic}} and would love to connect. I work in a similar space and think we could benefit from sharing insights.\n\nLooking forward to connecting,\n{{sender_name}}',
      '{"variables": ["first_name", "topic", "sender_name"]}',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM outreach_templates WHERE channel = 'linkedin' AND is_default = true
    );
  `);
  
  // Twitter template
  await db.execute(sql`
    INSERT INTO outreach_templates (
      user_id, name, description, channel, subject, content, variables, is_default
    )
    SELECT 
      1, 
      'Default Twitter Template', 
      'Standard Twitter DM outreach message', 
      'twitter'::outreach_channel, 
      'Connection Request', 
      'Hi {{first_name}}, loved your content on {{topic}}! I created a resource that complements it well. Would you like to check it out? {{sender_name}}',
      '{"variables": ["first_name", "topic", "sender_name"]}',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM outreach_templates WHERE channel = 'twitter' AND is_default = true
    );
  `);
  
  // Contact form template
  await db.execute(sql`
    INSERT INTO outreach_templates (
      user_id, name, description, channel, subject, content, variables, is_default
    )
    SELECT 
      1, 
      'Default Contact Form Template', 
      'Standard website contact form outreach message', 
      'contact_form'::outreach_channel, 
      'Content collaboration opportunity', 
      'Hello,\n\nI recently found your website and particularly enjoyed your content about {{topic}}. I've created a comprehensive resource on {{resource_topic}} that I believe would be valuable to your audience.\n\nWould you be interested in taking a look? I'd be happy to provide more details.\n\nBest regards,\n{{sender_name}}\n{{sender_email}}\n{{sender_website}}',
      '{"variables": ["topic", "resource_topic", "sender_name", "sender_email", "sender_website"]}',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM outreach_templates WHERE channel = 'contact_form' AND is_default = true
    );
  `);
  
  console.log('Default templates created successfully');
}

// Run the script
addMultiChannelOutreachSupport()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });