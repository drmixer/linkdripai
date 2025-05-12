CREATE TYPE "public"."discovery_status" AS ENUM('discovered', 'analyzed', 'validated', 'rejected', 'matched', 'assigned', 'premium', 'unlocked', 'contacted', 'converted', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('resource_page', 'directory', 'blog', 'guest_post', 'competitor_backlink', 'social_mention', 'forum', 'comment_section');--> statement-breakpoint
CREATE TABLE "analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"date" timestamp DEFAULT now(),
	"emailsSent" integer DEFAULT 0,
	"emailsResponded" integer DEFAULT 0,
	"prospectsUnlocked" integer DEFAULT 0,
	"backlinksSecured" integer DEFAULT 0,
	"creditsUsed" integer DEFAULT 0,
	"data" json
);
--> statement-breakpoint
CREATE TABLE "crawlerJobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"jobType" text NOT NULL,
	"targetUrl" text,
	"status" text DEFAULT 'pending',
	"startedAt" timestamp,
	"completedAt" timestamp,
	"results" json,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "dailyDrips" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"websiteId" integer NOT NULL,
	"date" timestamp DEFAULT now(),
	"opportunitiesLimit" integer NOT NULL,
	"opportunitiesDelivered" integer DEFAULT 0,
	"isPurchasedExtra" boolean DEFAULT false,
	"matches" json DEFAULT '[]'::json
);
--> statement-breakpoint
CREATE TABLE "discoveredOpportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"sourceType" "source_type" NOT NULL,
	"pageTitle" text,
	"pageContent" text,
	"contactInfo" json,
	"domainAuthority" integer DEFAULT 0,
	"pageAuthority" integer DEFAULT 0,
	"spamScore" integer DEFAULT 0,
	"isPremium" boolean DEFAULT false,
	"discoveredAt" timestamp DEFAULT now(),
	"lastChecked" timestamp DEFAULT now(),
	"status" "discovery_status" DEFAULT 'discovered',
	"rawData" json,
	"validationData" json,
	CONSTRAINT "discoveredOpportunities_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "opportunityMatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"websiteId" integer NOT NULL,
	"prospectId" integer NOT NULL,
	"matchScore" integer NOT NULL,
	"matchReason" json,
	"assignedAt" timestamp DEFAULT now(),
	"showDate" timestamp,
	"status" text DEFAULT 'pending',
	"userDismissed" boolean DEFAULT false,
	"userSaved" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "outreachEmails" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer NOT NULL,
	"userId" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'Awaiting response',
	"siteName" text NOT NULL,
	"contactEmail" text NOT NULL,
	"contactRole" text,
	"domainAuthority" text,
	"sentAt" timestamp DEFAULT now(),
	"responseAt" timestamp,
	"isFollowUp" boolean DEFAULT false,
	"parentEmailId" integer
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" serial PRIMARY KEY NOT NULL,
	"siteType" text NOT NULL,
	"siteName" text,
	"domain" text,
	"domainAuthority" text NOT NULL,
	"pageAuthority" text,
	"spamScore" text,
	"totalLinks" text,
	"rootDomainsLinking" text,
	"lastCrawled" text,
	"niche" text NOT NULL,
	"monthlyTraffic" text NOT NULL,
	"contactEmail" text,
	"contactRole" text,
	"contactName" text,
	"targetUrl" text,
	"fitScore" integer NOT NULL,
	"matchReasons" json DEFAULT '[]'::json,
	"isUnlocked" boolean DEFAULT false,
	"isSaved" boolean DEFAULT false,
	"isNew" boolean DEFAULT true,
	"isHidden" boolean DEFAULT false,
	"unlockedBy" integer,
	"unlockedat" timestamp,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "splashUsage" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"websiteId" integer,
	"usedAt" timestamp DEFAULT now(),
	"count" integer DEFAULT 1,
	"source" text DEFAULT 'monthly_allowance'
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"subscription" text DEFAULT 'Free Trial',
	"dailyOpportunitiesLimit" integer DEFAULT 5,
	"splashesallowed" integer DEFAULT 1,
	"splashesused" integer DEFAULT 0,
	"lastsplashreset" timestamp DEFAULT now(),
	"createdAt" timestamp DEFAULT now(),
	"websites" json DEFAULT '[]'::json,
	"onboardingCompleted" boolean DEFAULT false,
	"emailprovider" text,
	"fromemail" text,
	"emailconfigured" boolean DEFAULT false,
	"emailverified" boolean DEFAULT false,
	"emailapikey" text,
	"emailtermsaccepted" boolean DEFAULT false,
	"emailprovidersettings" json,
	"websiteemailsettings" json,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "websiteProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"websiteId" integer NOT NULL,
	"keywords" json DEFAULT '[]'::json,
	"topics" json DEFAULT '[]'::json,
	"contentTypes" json DEFAULT '[]'::json,
	"analyzedAt" timestamp DEFAULT now(),
	"activeBacklinks" integer DEFAULT 0,
	"domainAuthority" integer,
	"targetNiches" json DEFAULT '[]'::json,
	"avoidNiches" json DEFAULT '[]'::json,
	"linkTypePreferences" json DEFAULT '[]'::json,
	"lastUpdated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"niche" text,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dailyDrips" ADD CONSTRAINT "dailyDrips_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dailyDrips" ADD CONSTRAINT "dailyDrips_websiteId_websites_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."websites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunityMatches" ADD CONSTRAINT "opportunityMatches_websiteId_websites_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."websites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunityMatches" ADD CONSTRAINT "opportunityMatches_prospectId_prospects_id_fk" FOREIGN KEY ("prospectId") REFERENCES "public"."prospects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreachEmails" ADD CONSTRAINT "outreachEmails_prospectId_prospects_id_fk" FOREIGN KEY ("prospectId") REFERENCES "public"."prospects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreachEmails" ADD CONSTRAINT "outreachEmails_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_unlockedBy_users_id_fk" FOREIGN KEY ("unlockedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splashUsage" ADD CONSTRAINT "splashUsage_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splashUsage" ADD CONSTRAINT "splashUsage_websiteId_websites_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."websites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websiteProfiles" ADD CONSTRAINT "websiteProfiles_websiteId_websites_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."websites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;