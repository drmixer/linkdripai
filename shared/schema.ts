import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
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
  credits: integer("credits").default(10),
  totalCredits: integer("totalCredits").default(10),
  dailyOpportunitiesLimit: integer("dailyOpportunitiesLimit").default(5),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  subscription: true,
  credits: true,
  totalCredits: true,
  dailyOpportunitiesLimit: true,
  websites: true,
  onboardingCompleted: true,
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
  niche: text("niche").notNull(),
  monthlyTraffic: text("monthlyTraffic").notNull(),
  contactEmail: text("contactEmail"),
  contactRole: text("contactRole"),
  fitScore: integer("fitScore").notNull(),
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
  unlockedBy: true,
  unlockedAt: true,
  createdAt: true,
});

// Outreach emails table
// Have to declare the type first to avoid the circular reference issue
const outreachEmailsTable = "outreachEmails";

export const outreachEmails = pgTable(outreachEmailsTable, {
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
  parentEmailId: integer("parentEmailId").references((): ReturnType<typeof integer> => outreachEmails.id),
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
