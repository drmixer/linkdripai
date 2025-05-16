import { pgTable, text, serial, integer, boolean, timestamp, json, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  email: text("email").notNull(),
  // Subscription related fields
  subscription: text("subscription").default("Free Trial"),
  subscriptionId: text("subscriptionId"), // Lemon Squeezy subscription ID
  subscriptionStatus: text("subscriptionStatus").default("none"), // active, cancelled, past_due, etc.
  planVariantId: text("planVariantId"), // Lemon Squeezy variant ID for the plan
  customerId: text("customer_id"), // Lemon Squeezy customer ID
  subscriptionRenewsAt: timestamp("subscriptionRenewsAt"), // When the subscription renews
  subscriptionEndsAt: timestamp("subscriptionEndsAt"), // When the subscription ends if cancelled
  splashCredits: integer("splash_credits").default(0), // Purchased splash credits
  // Old subscription tracking fields - maintained for backward compatibility
  dailyOpportunitiesLimit: integer("dailyOpportunitiesLimit").default(5),
  splashesAllowed: integer("splashesallowed").default(1),
  splashesUsed: integer("splashesused").default(0),
  lastSplashReset: timestamp("lastsplashreset").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
  websites: json("websites").$type<{
    url: string;
    niche: string;
    description: string;
    preferences?: {
      linkTypes: string[];
      avoidNiches?: string;
      dripPriorities: string[];
    };
  }[]>().default([]),
  onboardingCompleted: boolean("onboardingCompleted").default(false),
  // Email integration fields
  emailProvider: text("emailprovider"),
  fromEmail: text("fromemail"),  // Changed from emailFromAddress to match DB convention
  emailConfigured: boolean("emailconfigured").default(false),
  emailVerified: boolean("emailverified").default(false),
  emailApiKey: text("emailapikey"),
  emailTermsAccepted: boolean("emailtermsaccepted").default(false),
  // Provider-specific settings stored as JSON
  emailProviderSettings: json("emailprovidersettings").$type<{
    // SendGrid settings
    sendgrid?: {
      apiKey: string;
    };
    // SMTP settings
    smtp?: {
      server: string;
      port: string | number;
      username: string;
      password: string;
      secure: boolean;
    };
    // Gmail settings
    gmail?: {
      clientId: string;
      clientSecret: string;
      refreshToken?: string;
      accessToken?: string;
    };
  }>(),
  // Website-specific email settings
  websiteEmailSettings: json("websiteemailsettings").$type<{
    [websiteId: string]: {
      fromEmail: string;
      verified: boolean;
      signature?: string;
    };
  }>(),
});

// Basic insert schema for user registration
const baseInsertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  subscription: true,
  subscriptionId: true,
  subscriptionStatus: true,
  planVariantId: true,
  customerId: true,
  subscriptionRenewsAt: true,
  subscriptionEndsAt: true,
  splashCredits: true,
  dailyOpportunitiesLimit: true,
  splashesAllowed: true,
  splashesUsed: true,
  lastSplashReset: true,
  websites: true,
  onboardingCompleted: true,
  emailProvider: true,
  fromEmail: true,
  emailConfigured: true,
  emailVerified: true,
  emailApiKey: true,
  emailTermsAccepted: true,
  emailProviderSettings: true,
  websiteEmailSettings: true,
});

// Extended schema with plan information for registration process
export const insertUserSchema = baseInsertUserSchema.extend({
  plan: z.enum(["Free Trial", "Starter", "Grow", "Pro"]).optional(),
});

// Email settings related schemas

// Email settings for users 
export const emailSettings = pgTable("emailSettings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  provider: text("provider"),
  fromEmail: text("fromEmail"),
  fromName: text("fromName"),
  isConfigured: boolean("isConfigured").default(false),
  isVerified: boolean("isVerified").default(false),
  termsAccepted: boolean("termsAccepted").default(false),
  sendgridApiKey: text("sendgridApiKey"),
  smtpHost: text("smtpHost"),
  smtpPort: integer("smtpPort"),
  smtpUsername: text("smtpUsername"),
  smtpPassword: text("smtpPassword"),
  gmailClientId: text("gmailClientId"),
  gmailClientSecret: text("gmailClientSecret"),
  gmailRefreshToken: text("gmailRefreshToken"),
  verificationToken: text("verificationToken"),
  verificationExpires: timestamp("verificationExpires"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
export const emailSettingsSchema = z.object({
  provider: z.enum(["sendgrid", "smtp", "gmail"]),
  fromEmail: z.string().email("Please enter a valid email address"),
  isConfigured: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  termsAccepted: z.boolean(),
  
  // Provider-specific settings
  providerSettings: z.object({
    // SendGrid
    sendgrid: z.object({
      apiKey: z.string()
    }).optional(),
    
    // SMTP
    smtp: z.object({
      server: z.string(),
      port: z.union([z.string(), z.number()]),
      username: z.string(),
      password: z.string(),
      secure: z.boolean().default(true)
    }).optional(),
    
    // Gmail
    gmail: z.object({
      clientId: z.string(),
      clientSecret: z.string(),
      refreshToken: z.string().optional(),
      accessToken: z.string().optional()
    }).optional()
  }).optional(),
  
  // Website specific settings
  websiteSettings: z.record(z.string(), z.object({
    fromEmail: z.string().email(),
    verified: z.boolean().default(false),
    signature: z.string().optional()
  })).optional()
});

// Websites table - for users to manage multiple websites
export const websites = pgTable("websites", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  url: text("url").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  niche: text("niche"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const insertWebsiteSchema = createInsertSchema(websites).omit({
  id: true,
  createdAt: true,
});

// Prospects table - for backlink opportunities
export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  siteType: text("siteType").notNull(),
  siteName: text("siteName"),
  domain: text("domain"),
  domainAuthority: text("domainAuthority").notNull(),
  pageAuthority: text("pageAuthority"),
  spamScore: text("spamScore"),
  totalLinks: text("totalLinks"),
  rootDomainsLinking: text("rootDomainsLinking"),
  lastCrawled: text("lastCrawled"),
  niche: text("niche").notNull(),
  monthlyTraffic: text("monthlyTraffic").notNull(),
  contactEmail: text("contactEmail"),
  contactRole: text("contactRole"),
  contactName: text("contactName"),
  targetUrl: text("targetUrl"),
  fitScore: integer("fitScore").notNull(),
  matchReasons: json("matchReasons").$type<string[]>().default([]),
  isUnlocked: boolean("isUnlocked").default(false),
  isSaved: boolean("isSaved").default(false),
  isNew: boolean("isNew").default(true),
  isHidden: boolean("isHidden").default(false),
  unlockedBy: integer("unlockedBy").references(() => users.id),
  unlockedAt: timestamp("unlockedat"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const insertProspectSchema = createInsertSchema(prospects).omit({
  id: true,
  isUnlocked: true,
  isSaved: true,
  isHidden: true,
  unlockedBy: true,
  unlockedAt: true,
  createdAt: true,
  matchReasons: true,
});

// Outreach emails table without circular references
export const outreachEmails = pgTable("outreachEmails", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId").notNull().references(() => prospects.id),
  userId: integer("userId").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").default("Awaiting response"),
  siteName: text("siteName").notNull(),
  contactEmail: text("contactEmail").notNull(),
  contactRole: text("contactRole"),
  domainAuthority: text("domainAuthority"),
  sentAt: timestamp("sentAt").defaultNow(),
  responseAt: timestamp("responseAt"),
  isFollowUp: boolean("isFollowUp").default(false),
  parentEmailId: integer("parentEmailId"),
  
  // New fields for email tracking and threading
  messageId: text("messageId"), // Unique ID for tracking in email headers
  threadId: text("threadId"), // For grouping conversations
  providerMessageId: text("providerMessageId"), // External provider's message ID
  replyContent: text("replyContent"), // Store reply content when received
  replyHeaders: json("replyHeaders").$type<Record<string, string>>(), // Store headers from replies
  lastCheckedAt: timestamp("lastCheckedAt"), // Last time we checked for replies
  errorMessage: text("errorMessage"), // Error message if email sending fails
  replyMessageId: text("replyMessageId"), // Message ID of the reply email
});

export const insertEmailSchema = createInsertSchema(outreachEmails).omit({
  id: true,
  sentAt: true,
  responseAt: true,
  isFollowUp: true,
  parentEmailId: true,
  messageId: true,
  threadId: true,
  providerMessageId: true,
  replyContent: true,
  replyHeaders: true,
  lastCheckedAt: true,
});

// Stats/Analytics table
export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  date: timestamp("date").defaultNow(),
  emailsSent: integer("emailsSent").default(0),
  emailsResponded: integer("emailsResponded").default(0),
  prospectsUnlocked: integer("prospectsUnlocked").default(0),
  backlinksSecured: integer("backlinksSecured").default(0),
  creditsUsed: integer("creditsUsed").default(0),
  data: json("data"),
});

// Source types for opportunity discovery
export const sourceTypeEnum = pgEnum('source_type', [
  'resource_page',
  'directory',
  'blog',
  'guest_post',
  'competitor_backlink',
  'social_mention',
  'forum',
  'comment_section'
]);

// Status of the opportunity in the discovery pipeline
export const discoveryStatusEnum = pgEnum('discovery_status', [
  'discovered',      // Initial discovery
  'analyzed',        // Analyzed but not yet matched
  'validated',       // Passed validation pipeline
  'rejected',        // Failed validation pipeline
  'matched',         // Matched to user(s)
  'assigned',        // Assigned to user's daily feed
  'premium',         // Reserved for premium splash
  'unlocked',        // Unlocked by user
  'contacted',       // Email sent
  'converted',       // Backlink secured
  'failed',          // Failed attempt
  'expired'          // No longer valid
]);

// Website analysis data for better matching
export const websiteProfiles = pgTable("websiteProfiles", {
  id: serial("id").primaryKey(),
  websiteId: integer("websiteId").notNull().references(() => websites.id),
  keywords: json("keywords").$type<string[]>().default([]),
  topics: json("topics").$type<string[]>().default([]),
  contentTypes: json("contentTypes").$type<string[]>().default([]),
  analyzedAt: timestamp("analyzedAt").defaultNow(),
  activeBacklinks: integer("activeBacklinks").default(0),
  domainAuthority: integer("domainAuthority"),
  targetNiches: json("targetNiches").$type<string[]>().default([]),
  avoidNiches: json("avoidNiches").$type<string[]>().default([]),
  linkTypePreferences: json("linkTypePreferences").$type<string[]>().default([]),
  lastUpdated: timestamp("lastUpdated").defaultNow(),
});

// Raw discovered opportunities before processing
export const discoveredOpportunities = pgTable("discoveredOpportunities", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  domain: text("domain").notNull(),
  sourceType: sourceTypeEnum("sourceType").notNull(),
  pageTitle: text("pageTitle"),
  pageContent: text("pageContent"),
  contactInfo: json("contactInfo").$type<{
    emails?: string[];
    socialProfiles?: Array<{
      platform: string;
      url: string;
      username: string;
      displayName?: string;
    }>;
    contactForms?: string[];
    phoneNumbers?: string[];
    addresses?: Array<{
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    }>;
    contactPerson?: {
      name?: string;
      title?: string;
      department?: string;
    };
    extractionDetails?: {
      normalized: boolean;
      source: string;
      version: string;
      lastUpdated: string;
    };
    lastVerified?: string; // ISO date string
    sources?: string[]; // Where this contact info was found
    confidence?: number; // 0-1 confidence score for the contact info
  }>(),
  // Metrics from validation process
  domainAuthority: integer("domainAuthority").default(0),
  pageAuthority: integer("pageAuthority").default(0),
  spamScore: integer("spamScore").default(0),
  isPremium: boolean("isPremium").default(false), // Premium high-quality opportunity for Splash
  // Tracking fields
  discoveredAt: timestamp("discoveredAt").defaultNow(),
  lastChecked: timestamp("lastChecked").defaultNow(),
  status: discoveryStatusEnum("status").default('discovered'),
  statusNote: text("statusNote"), // Additional status information like error messages
  rawData: json("rawData"),
  validationData: json("validationData"), // Store detailed validation metrics
});

// Opportunity match records - links users to opportunities
export const opportunityMatches = pgTable("opportunityMatches", {
  id: serial("id").primaryKey(),
  websiteId: integer("websiteId").notNull().references(() => websites.id),
  userId: integer("userId").notNull().references(() => users.id),
  opportunityId: integer("opportunityId").notNull().references(() => discoveredOpportunities.id),
  matchScore: integer("matchScore").default(0), // 0-100 matching score
  matchReason: json("matchReason").$type<string[]>(), // Reasons for match
  assignedAt: timestamp("assignedAt").defaultNow(),
  showDate: timestamp("showDate"), // When to show in the feed
  status: text("status").default("pending"), // pending, shown, interacted, expired
  userDismissed: boolean("userDismissed").default(false),
  userSaved: boolean("userSaved").default(false),
  isPremium: boolean("isPremium").default(false), // Is this a premium (Splash) match
});

// Daily drip allocations
export const dailyDrips = pgTable("dailyDrips", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  opportunityId: integer("opportunityId").notNull().references(() => discoveredOpportunities.id),
  dripDate: timestamp("dripDate").defaultNow(),
  status: text("status").default("active"), // active, clicked, saved, hidden
  isPremium: boolean("isPremium").default(false), // Is this a premium (Splash) match
});

// Splash usage tracking
export const splashUsage = pgTable("splashUsage", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  websiteId: integer("websiteId").references(() => websites.id),
  usedAt: timestamp("usedAt").defaultNow(),
  count: integer("count").default(1),
  source: text("source").default("monthly_allowance"), // allowance or purchased
});

// Contact activity type enum
export const contactMethodEnum = pgEnum('contact_method', [
  'email',              // Email outreach
  'social_message',     // Direct message on social platform
  'contact_form',       // Submission via a contact form
  'phone_call',         // Phone outreach
  'in_person',          // In-person meeting
  'other'               // Other contact methods
]);

// Contact activity status enum
export const contactActivityStatusEnum = pgEnum('contact_activity_status', [
  'pending',            // Activity recorded but outcome unknown
  'sent',               // Message sent successfully
  'replied',            // Got a response
  'success',            // Achieved desired outcome (e.g., backlink)
  'rejected',           // Request explicitly rejected
  'failed',             // Failed to deliver/technical issue
  'no_response'         // No response after follow-up period
]);
export const contactStatusEnum = pgEnum('contact_status', [
  'planned',            // Planned but not executed yet
  'in_progress',        // Started but not completed (e.g., draft email)
  'sent',               // Email sent or form submitted
  'delivered',          // Confirmed delivery (e.g., email didn't bounce)
  'opened',             // Email was opened
  'clicked',            // Links in email were clicked
  'replied',            // Received a reply
  'converted',          // Resulted in a backlink
  'rejected',           // Request was rejected
  'bounced',            // Email bounced or form submission failed
  'no_response',        // No response after follow-up period
  'postponed',          // Contact postponed by user
  'cancelled'           // Contact cancelled
]);

// Contact activities - unified tracking for all outreach efforts
export const contactActivities = pgTable("contactActivities", {
  id: serial("id").primaryKey(),
  
  // Relations
  userId: integer("userId").notNull().references(() => users.id),
  websiteId: integer("websiteId").references(() => websites.id),
  opportunityId: integer("opportunityId").notNull().references(() => discoveredOpportunities.id),
  emailId: integer("emailId").references(() => outreachEmails.id), // Optional reference to email if method is email
  
  // Contact method tracking
  contactMethod: contactMethodEnum("contactMethod").notNull(), // Email, social media, contact form, etc.
  contactPlatform: text("contactPlatform"), // Specific platform (LinkedIn, Twitter, etc.)
  contactDetails: text("contactDetails"), // Email address, URL, user handle, etc.
  
  // Content
  subject: text("subject"), // Subject line or topic
  message: text("message"), // Content of the outreach
  attachments: json("attachments").$type<string[]>(), // URLs or references to attachments
  
  // Status tracking
  status: contactStatusEnum("status").default('planned'),
  statusNote: text("statusNote"), // Additional notes about the status
  isFollowUp: boolean("isFollowUp").default(false), // Is this a follow-up attempt
  parentActivityId: integer("parentActivityId"), // Link to previous contact activity
  
  // Timing
  plannedAt: timestamp("plannedAt"), // When the contact is scheduled
  executedAt: timestamp("executedAt"), // When the contact was actually made
  respondedAt: timestamp("respondedAt"), // When a response was received
  lastStatusChange: timestamp("lastStatusChange").defaultNow(),
  
  // Tracking
  trackingId: text("trackingId"), // Unique ID for tracking responses
  responseContent: text("responseContent"), // Content of the response
  responseMetadata: json("responseMetadata"), // Additional data about the response
  
  // Reminders & follow-up
  reminderDate: timestamp("reminderDate"), // When to remind the user about this contact
  followUpScheduled: timestamp("followUpScheduled"), // When follow-up is scheduled
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow()
});

// Schema for inserting a new contact activity
export const insertContactActivitySchema = createInsertSchema(contactActivities).omit({
  id: true,
  trackingId: true,
  responseContent: true,
  responseMetadata: true,
  lastStatusChange: true,
  createdAt: true, 
  updatedAt: true
});

// Crawler configuration and status
export const crawlerJobs = pgTable("crawlerJobs", {
  id: serial("id").primaryKey(),
  jobType: text("jobType").notNull(), // discovery, verification, refresh
  targetUrl: text("targetUrl"),
  status: text("status").default("pending"), // pending, in_progress, completed, failed
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  results: json("results"),
  error: text("error"),
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Website = typeof websites.$inferSelect;
export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;

export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;

export type OutreachEmail = typeof outreachEmails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;

export type Analytic = typeof analytics.$inferSelect;

export type WebsiteProfile = typeof websiteProfiles.$inferSelect;
export type DiscoveredOpportunity = typeof discoveredOpportunities.$inferSelect;
export type OpportunityMatch = typeof opportunityMatches.$inferSelect;
export type DailyDrip = typeof dailyDrips.$inferSelect;
export type SplashUsage = typeof splashUsage.$inferSelect;
export type CrawlerJob = typeof crawlerJobs.$inferSelect;
export type EmailSetting = typeof emailSettings.$inferSelect;

// New contact activity types
export type ContactActivity = typeof contactActivities.$inferSelect;
export type InsertContactActivity = z.infer<typeof insertContactActivitySchema>;
export type ContactMethod = typeof contactMethodEnum.enumValues[number];
export type ContactStatus = typeof contactStatusEnum.enumValues[number];
