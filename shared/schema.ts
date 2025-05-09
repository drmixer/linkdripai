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
  subscription: text("subscription").default("Free Trial"),
  dailyOpportunitiesLimit: integer("dailyOpportunitiesLimit").default(5),
  splashesAllowed: integer("splashesAllowed").default(1),
  splashesUsed: integer("splashesUsed").default(0),
  lastSplashReset: timestamp("lastSplashReset").defaultNow(),
  billingAnniversary: timestamp("billingAnniversary").defaultNow(),
  maxWebsites: integer("maxWebsites").default(1),
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
});

// Basic insert schema for user registration
const baseInsertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  subscription: true,
  dailyOpportunitiesLimit: true,
  splashesAllowed: true,
  splashesUsed: true,
  lastSplashReset: true,
  billingAnniversary: true,
  maxWebsites: true,
  websites: true,
  onboardingCompleted: true,
});

// Extended schema with plan information for registration process
export const insertUserSchema = baseInsertUserSchema.extend({
  plan: z.enum(["Free Trial", "Starter", "Grow", "Pro"]).optional(),
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
  unlockedAt: timestamp("unlockedAt"),
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
});

export const insertEmailSchema = createInsertSchema(outreachEmails).omit({
  id: true,
  sentAt: true,
  responseAt: true,
  isFollowUp: true,
  parentEmailId: true,
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
  'matched',         // Matched to user(s)
  'assigned',        // Assigned to user's daily feed
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
    email?: string;
    form?: string;
    social?: string[];
  }>(),
  discoveredAt: timestamp("discoveredAt").defaultNow(),
  lastChecked: timestamp("lastChecked").defaultNow(),
  status: discoveryStatusEnum("status").default('discovered'),
  rawData: json("rawData"),
});

// Opportunity match records - links users to opportunities
export const opportunityMatches = pgTable("opportunityMatches", {
  id: serial("id").primaryKey(),
  websiteId: integer("websiteId").notNull().references(() => websites.id),
  prospectId: integer("prospectId").notNull().references(() => prospects.id),
  matchScore: integer("matchScore").notNull(), // 0-100 matching score
  matchReason: json("matchReason").$type<string[]>(), // Reasons for match
  assignedAt: timestamp("assignedAt").defaultNow(),
  showDate: timestamp("showDate"), // When to show in the feed
  status: text("status").default("pending"), // pending, shown, interacted, expired
  userDismissed: boolean("userDismissed").default(false),
  userSaved: boolean("userSaved").default(false),
});

// Daily drip allocations
export const dailyDrips = pgTable("dailyDrips", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  websiteId: integer("websiteId").notNull().references(() => websites.id),
  date: timestamp("date").defaultNow(),
  opportunitiesLimit: integer("opportunitiesLimit").notNull(),
  opportunitiesDelivered: integer("opportunitiesDelivered").default(0),
  isPurchasedExtra: boolean("isPurchasedExtra").default(false),
  matches: json("matches").$type<number[]>().default([]), // Array of opportunityMatch IDs
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
export type CrawlerJob = typeof crawlerJobs.$inferSelect;
