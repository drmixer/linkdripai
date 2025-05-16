import { 
  User, 
  InsertUser, 
  Prospect, 
  InsertProspect, 
  OutreachEmail, 
  InsertEmail, 
  users, 
  prospects, 
  outreachEmails 
} from "@shared/schema";
import * as session from "express-session";
import createMemoryStore from "memorystore";
import { eq, ne, and, or, isNull, gte, desc, sql } from "drizzle-orm";
import { db } from "./db";

const MemoryStore = createMemoryStore(session);

interface Stats {
  dailyOpportunities: {
    used: number;
    total: number;
  };
  splashes: {
    available: number;
    total: number;
    nextReset: Date;
  };
  emailsSent: {
    total: number;
    changePercentage: number;
  };
  backlinksSecured: {
    total: number;
    new: number;
    averageDA: number;
  };
}

interface EmailTemplate {
  subject: string;
  body: string;
}

interface Analytics {
  emailPerformance: any[];
  backlinksAcquired: any[];
  responseRateByNiche: any[];
  creditUsage: any[];
  daDistribution: any[];
}

// Modify the interface with any CRUD methods you might need
export interface IStorage {
  sessionStore: session.SessionStore;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserSplashes(userId: number, splashesUsed: number): Promise<User>;
  resetMonthlySplashes(userId: number): Promise<User>;
  getUserStats(userId: number): Promise<Stats>;
  
  // Onboarding methods
  updateUserSubscription(userId: number, plan: string): Promise<User>;
  updateUserWebsites(userId: number, websites: any[]): Promise<User>;
  updateWebsitePreferences(userId: number, websiteIndex: number, preferences: any): Promise<User>;
  completeOnboarding(userId: number): Promise<User>;
  
  // Prospect methods
  getDailyProspects(userId: number): Promise<Prospect[]>;
  getAllProspects(userId: number): Promise<Prospect[]>;
  getSavedProspects(userId: number): Promise<Prospect[]>;
  getUnlockedProspects(userId: number): Promise<Prospect[]>;
  getProspectById(id: number): Promise<Prospect | undefined>;
  unlockProspect(id: number, userId: number): Promise<Prospect>;
  saveProspect(id: number, userId: number): Promise<Prospect>;
  hideProspect(id: number, userId: number): Promise<Prospect>;
  updateProspect(id: number, prospectData: Partial<Prospect>): Promise<Prospect>;
  
  // Email methods
  generateEmail(prospect: Prospect, template: string): Promise<EmailTemplate>;
  sendEmail(email: InsertEmail): Promise<OutreachEmail>;
  createFollowUpEmail(emailId: number, userId: number): Promise<OutreachEmail>;
  getUserEmails(userId: number): Promise<OutreachEmail[]>;
  getRecentEmails(userId: number): Promise<OutreachEmail[]>;
  
  // Analytics methods
  getUserAnalytics(userId: number, timeRange: string): Promise<Analytics>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private prospects: Map<number, Prospect>;
  private emails: Map<number, OutreachEmail>;
  sessionStore: session.SessionStore;
  private currentUserId: number;
  private currentProspectId: number;
  private currentEmailId: number;

  constructor() {
    this.users = new Map();
    this.prospects = new Map();
    this.emails = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    this.currentUserId = 1;
    this.currentProspectId = 1;
    this.currentEmailId = 1;
    
    // Initialize with sample prospects data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create a test user with splashes
    const testUser: User = {
      id: 1,
      username: "demo",
      password: "5c0c0cec7bd0387108f4afd92943fef1.d6e3dbe8ed0ef7ec154f3d2a56f6b027", // 'password'
      firstName: "Demo",
      lastName: "User",
      email: "demo@linkdripai.com",
      subscription: "Grow",
      splashesAllowed: 3,
      splashesUsed: 1,
      lastSplashReset: new Date(),
      billingAnniversary: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dailyOpportunitiesLimit: 10,
      createdAt: new Date(),
      websites: [
        {
          id: 1,
          url: "https://myblog.com",
          name: "My Tech Blog",
          competitors: ["https://competitor.com"],
          topics: ["SEO", "Marketing", "Content"],
          targetCountries: ["US", "UK", "CA"],
          targetDomainAuthority: [20, 80],
          excludeAdultContent: true,
          excludeGambling: true,
          userId: 1
        }
      ],
      onboardingCompleted: true
    };
    this.users.set(1, testUser);
    this.currentUserId = 2;
    
    // Create some sample prospect data
    const niches = ["Digital Marketing", "SEO", "Content", "Web Dev", "Programming", "Business"];
    const siteTypes = ["Blog with guest posting", "Premium blog", "Tutorial site", "News site", "Resource directory"];
    
    // Create 10 locked prospects with Moz metrics but hidden identity
    for (let i = 0; i < 10; i++) {
      const niche = niches[Math.floor(Math.random() * niches.length)];
      const siteType = siteTypes[Math.floor(Math.random() * siteTypes.length)];
      const da = Math.floor(Math.random() * 80) + 20; // DA between 20-99
      const pa = Math.floor(Math.random() * 80) + 20; // PA between 20-99
      const trafficK = Math.floor(Math.random() * 900) + 100; // Traffic between 100K-999K
      const fitScore = Math.floor(Math.random() * 30) + 70; // Fit score between 70-99
      const spamScore = (Math.random() * 10).toFixed(1); // Spam score between 0-10
      const totalLinks = Math.floor(Math.random() * 9000) + 1000; // Between 1K-10K links
      const rootDomainsLinking = Math.floor(Math.random() * 900) + 100; // Between 100-999 linking domains
      
      // These are locked prospects with Moz metrics
      const id = this.currentProspectId++;
      const domain = `${siteType.replace(/\s+/g, '').toLowerCase()}${id}.com`;
      
      const prospect: Prospect = {
        id,
        siteType,
        // These fields will be hidden until unlocked
        siteName: `${siteType.replace(/\s+/g, '')} ${id}`,
        domain,
        // Visible Moz metrics
        domainAuthority: `${da}`,
        pageAuthority: `${pa}`,
        spamScore,
        totalLinks: `${totalLinks}`,
        rootDomainsLinking: `${rootDomainsLinking}`,
        lastCrawled: new Date().toISOString(),
        // Basic info
        niche,
        monthlyTraffic: `${trafficK}K`,
        // Hidden contact info (revealed after unlock)
        contactEmail: `contact@${domain}`,
        contactRole: "Editor",
        contactName: `John Smith ${id}`,
        targetUrl: `https://${domain}/write-for-us`,
        // Status fields
        fitScore,
        isUnlocked: false,
        isSaved: false,
        isNew: true,
        isHidden: false,
        unlockedBy: null,
        unlockedAt: null,
        createdAt: new Date()
      };
      
      this.prospects.set(id, prospect);
    }
    
    // Create 5 already unlocked prospects
    for (let i = 0; i < 5; i++) {
      const niche = niches[Math.floor(Math.random() * niches.length)];
      const siteType = siteTypes[Math.floor(Math.random() * siteTypes.length)];
      const da = Math.floor(Math.random() * 80) + 20;
      const pa = Math.floor(Math.random() * 80) + 20;
      const trafficK = Math.floor(Math.random() * 900) + 100;
      const fitScore = Math.floor(Math.random() * 30) + 70;
      const spamScore = (Math.random() * 10).toFixed(1);
      const totalLinks = Math.floor(Math.random() * 9000) + 1000;
      const rootDomainsLinking = Math.floor(Math.random() * 900) + 100;
      
      const id = this.currentProspectId++;
      const domain = `${siteType.replace(/\s+/g, '').toLowerCase()}${id}.com`;
      
      const prospect: Prospect = {
        id,
        siteType,
        siteName: `${siteType.replace(/\s+/g, '')} ${id}`,
        domain,
        domainAuthority: `${da}`,
        pageAuthority: `${pa}`,
        spamScore,
        totalLinks: `${totalLinks}`,
        rootDomainsLinking: `${rootDomainsLinking}`,
        lastCrawled: new Date().toISOString(),
        niche,
        monthlyTraffic: `${trafficK}K`,
        contactEmail: `contact@${domain}`,
        contactRole: "Editor",
        contactName: `John Smith ${id}`,
        targetUrl: `https://${domain}/write-for-us`,
        fitScore,
        isUnlocked: true,
        isSaved: i % 2 === 0, // Every other one is saved
        isNew: false,
        isHidden: false,
        unlockedBy: 1, // Unlocked by the demo user
        unlockedAt: new Date(Date.now() - 86400000 * (i + 1)), // 1-5 days ago
        createdAt: new Date(Date.now() - 86400000 * (i + 6)) // 6-10 days ago
      };
      
      this.prospects.set(id, prospect);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const billingAnniversary = new Date(now);
    billingAnniversary.setMonth(billingAnniversary.getMonth() + 1);
    
    const user: User = { 
      ...insertUser,
      id,
      subscription: "Free Trial",
      splashesAllowed: 1,
      splashesUsed: 0,
      lastSplashReset: now,
      billingAnniversary,
      dailyOpportunitiesLimit: 5,
      createdAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserSplashes(userId: number, splashesUsed: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = {
      ...user,
      splashesUsed,
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  async resetMonthlySplashes(userId: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Reset Splashes based on subscription
    let splashesAllowed = 1; // Default for Free Trial
    
    switch (user.subscription) {
      case 'Pro':
        splashesAllowed = 7;
        break;
      case 'Grow':
        splashesAllowed = 3;
        break;
      case 'Starter':
        splashesAllowed = 1;
        break;
      default:
        splashesAllowed = 1;
        break;
    }
    
    const now = new Date();
    const billingAnniversary = new Date(now);
    billingAnniversary.setMonth(billingAnniversary.getMonth() + 1);
    
    const updatedUser = {
      ...user,
      splashesUsed: 0,
      splashesAllowed,
      lastSplashReset: now,
      billingAnniversary
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getUserStats(userId: number): Promise<Stats> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Count unlocked prospects for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const unlockedToday = Array.from(this.prospects.values()).filter(
      (prospect) => 
        prospect.unlockedBy === userId && 
        prospect.unlockedAt && 
        prospect.unlockedAt >= today
    ).length;
    
    // Count emails sent
    const userEmails = Array.from(this.emails.values()).filter(
      (email) => email.userId === userId
    );
    
    // Count backlinks secured (simplified: consider emails with "Responded" status)
    const backlinks = userEmails.filter(
      (email) => email.status === "Responded"
    );
    
    // Calculate average DA of backlinks
    const totalDA = backlinks.reduce((sum, email) => {
      const da = typeof email.domainAuthority === 'string' 
        ? parseInt(email.domainAuthority.split('-')[0]) 
        : email.domainAuthority || 0;
      return sum + da;
    }, 0);
    
    const averageDA = backlinks.length > 0 ? Math.round(totalDA / backlinks.length) : 0;
    
    // Calculate next reset date (billing anniversary or last reset + 30 days)
    const nextReset = user.billingAnniversary || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    return {
      dailyOpportunities: {
        used: unlockedToday,
        total: user.dailyOpportunitiesLimit || 5,
      },
      splashes: {
        available: (user.splashesAllowed || 1) - (user.splashesUsed || 0),
        total: user.splashesAllowed || 1,
        nextReset,
      },
      emailsSent: {
        total: userEmails.length,
        changePercentage: 12, // Mocked value for demo
      },
      backlinksSecured: {
        total: backlinks.length,
        new: 3, // Mocked value for demo
        averageDA,
      },
    };
  }

  async getDailyProspects(userId: number): Promise<Prospect[]> {
    // Return a subset of prospects as daily opportunities
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const dailyLimit = user.dailyOpportunitiesLimit;
    const allProspects = Array.from(this.prospects.values());
    
    // Filter out already unlocked prospects for this user and hidden prospects
    const availableProspects = allProspects.filter(
      (prospect) => (!prospect.unlockedBy || prospect.unlockedBy !== userId) && !prospect.isHidden
    );
    
    // Sort by fit score and take the top ones based on daily limit
    return availableProspects
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, dailyLimit);
  }

  async getAllProspects(userId: number): Promise<Prospect[]> {
    // Return all prospects that are either not unlocked or unlocked by this user
    // and not hidden
    return Array.from(this.prospects.values()).filter(
      (prospect) => (!prospect.unlockedBy || prospect.unlockedBy === userId) && !prospect.isHidden
    );
  }

  async getSavedProspects(userId: number): Promise<Prospect[]> {
    return Array.from(this.prospects.values()).filter(
      (prospect) => prospect.isSaved && prospect.unlockedBy === userId
    );
  }

  async getUnlockedProspects(userId: number): Promise<Prospect[]> {
    return Array.from(this.prospects.values()).filter(
      (prospect) => prospect.isUnlocked && prospect.unlockedBy === userId
    );
  }

  async getProspectById(id: number): Promise<Prospect | undefined> {
    return this.prospects.get(id);
  }

  async unlockProspect(id: number, userId: number): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    if (prospect.isUnlocked && prospect.unlockedBy !== userId) {
      throw new Error("This prospect has been unlocked by another user");
    }
    
    // Generate contact details when unlocking
    const domains = ["gmail.com", "outlook.com", "company.com", "site.com", "domain.com"];
    const roles = ["Editor", "Content Manager", "Webmaster", "Marketing Lead", "Partnerships", "SEO Manager"];
    const siteNames = [
      "Digital Marketer Blog", "SEO Guide", "Content Masters", 
      "Web Dev Journal", "Marketing Brew", "Tech Insights",
      "Business Daily", "Growth Hackers", "Coding Resources"
    ];
    
    const siteName = siteNames[Math.floor(Math.random() * siteNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const role = roles[Math.floor(Math.random() * roles.length)];
    
    // Create an email based on the site name
    const nameWords = siteName.toLowerCase().split(' ');
    let email = "";
    if (nameWords.length > 1) {
      email = `${nameWords[0]}.${nameWords[1]}@${domain}`;
    } else {
      email = `contact@${nameWords[0]}.${domain}`;
    }
    
    const updatedProspect: Prospect = {
      ...prospect,
      isUnlocked: true,
      unlockedBy: userId,
      unlockedAt: new Date(),
      siteName,
      contactEmail: email,
      contactRole: role,
    };
    
    this.prospects.set(id, updatedProspect);
    return updatedProspect;
  }

  async saveProspect(id: number, userId: number): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    if (!prospect.isUnlocked || prospect.unlockedBy !== userId) {
      throw new Error("You must unlock this prospect before saving it");
    }
    
    const updatedProspect: Prospect = {
      ...prospect,
      isSaved: true,
    };
    
    this.prospects.set(id, updatedProspect);
    return updatedProspect;
  }
  
  async hideProspect(id: number, userId: number): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    const updatedProspect: Prospect = {
      ...prospect,
      isHidden: true,
    };
    
    this.prospects.set(id, updatedProspect);
    return updatedProspect;
  }
  
  async updateProspect(id: number, prospectData: Partial<Prospect>): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    const updatedProspect: Prospect = {
      ...prospect,
      ...prospectData,
      // Ensure these properties are not accidentally overwritten
      id: prospect.id,
      createdAt: prospect.createdAt,
    };
    
    this.prospects.set(id, updatedProspect);
    return updatedProspect;
  }
  
  // Onboarding methods
  async updateUserSubscription(userId: number, plan: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update subscription related values based on the plan
    let dailyOpportunitiesLimit = 5;
    let splashesAllowed = 1;
    let maxWebsites = 1;
    
    switch (plan) {
      case 'Pro':
        dailyOpportunitiesLimit = 15; // 10-15 drips/day
        splashesAllowed = 7;          // 7 Splashes per month
        maxWebsites = 5;              // Up to 5 websites
        break;
      case 'Grow':
        dailyOpportunitiesLimit = 10; // 7-10 drips/day
        splashesAllowed = 3;          // 3 Splashes per month
        maxWebsites = 2;              // Up to 2 websites
        break;
      case 'Starter':
        dailyOpportunitiesLimit = 7;  // 5-7 drips/day
        splashesAllowed = 1;          // 1 Splash per month
        maxWebsites = 1;              // 1 website only
        break;
      default: // Free Trial
        dailyOpportunitiesLimit = 5;
        splashesAllowed = 1;
        maxWebsites = 1;
        break;
    }
    
    // Reset the splash usage counter and set billing anniversary 
    const now = new Date();
    const billingAnniversary = new Date();
    billingAnniversary.setMonth(billingAnniversary.getMonth() + 1); // Set to one month from now
    
    const updatedUser = {
      ...user,
      subscription: plan,
      dailyOpportunitiesLimit,
      splashesAllowed,
      splashesUsed: 0,
      lastSplashReset: now,
      billingAnniversary,
      maxWebsites
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  async updateUserWebsites(userId: number, websites: any[]): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = {
      ...user,
      websites: websites,
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  async updateWebsitePreferences(userId: number, websiteIndex: number, preferences: any): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    if (!user.websites || !Array.isArray(user.websites) || websiteIndex >= user.websites.length) {
      throw new Error("Website not found");
    }
    
    const websites = [...(user.websites || [])];
    websites[websiteIndex] = {
      ...websites[websiteIndex],
      preferences,
    };
    
    const updatedUser = {
      ...user,
      websites,
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  async completeOnboarding(userId: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = {
      ...user,
      onboardingCompleted: true,
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async generateEmail(prospect: Prospect, template: string): Promise<EmailTemplate> {
    // Generate email templates based on the selected template and prospect data
    const siteName = prospect.siteName || "the website";
    const niche = prospect.niche;
    
    let subject = "";
    let body = "";
    
    switch (template) {
      case "guest-post":
        subject = `Guest post opportunity for ${siteName}`;
        body = `Hi ${prospect.contactRole || "there"},

I'm [Your Name] from [Your Website], and I've been following ${siteName} for quite some time now. I particularly enjoy your content about ${niche} and how you provide valuable insights to your audience.

I notice you publish guest posts on ${niche} topics, and I'd love to contribute an article for your readers. Based on your site's content, I think your audience would find value in an article titled:

"7 Advanced ${niche} Strategies That Boosted Our Results by 156% in 6 Months"

This would be a detailed, actionable case study with real data from our own efforts. I'd include specific tactics, screenshots, and results that your audience could implement right away.

Would this be something your readers would find valuable? I'm happy to tailor the topic or approach to better fit your content guidelines.

Looking forward to potentially collaborating!

Best regards,
[Your Name]
[Your Position], [Your Website]`;
        break;
        
      case "resource-mention":
        subject = `Resource for your ${niche} article on ${siteName}`;
        body = `Hi ${prospect.contactRole || "there"},

I recently came across your excellent article about ${niche} on ${siteName}. The insights you shared about [specific topic] were particularly helpful, and I've already implemented some of your suggestions.

I wanted to reach out because I've created a comprehensive resource that complements the information in your article perfectly. It's a [resource type - guide/tool/template] that helps users [benefit].

You can check it out here: [Resource URL]

I thought this might be a valuable addition to your article, providing your readers with an actionable resource to implement what they've learned. If you find it helpful, perhaps you could consider mentioning or linking to it in your post.

Either way, I wanted to thank you for your excellent content and let you know how much value it's provided.

Best regards,
[Your Name]
[Your Position], [Your Website]`;
        break;
        
      case "collaboration":
        subject = `Collaboration opportunity with ${siteName}`;
        body = `Hi ${prospect.contactRole || "there"},

My name is [Your Name] from [Your Website], a platform focused on ${niche}. I've been following ${siteName} for a while and really appreciate your expertise in the field.

I'm reaching out because I see some great potential for collaboration between our platforms. We serve similar audiences but have complementary offerings that could benefit both our reader bases.

Some potential collaboration ideas:
- Co-creating content that leverages both our expertise
- Cross-promotion to our respective audiences
- Webinar or workshop partnership
- Joint research project on industry trends

Would you be open to discussing these possibilities? I'd love to schedule a quick call to explore how we might work together to provide even more value to our audiences.

Looking forward to your thoughts!

Best regards,
[Your Name]
[Your Position], [Your Website]
[Your Contact Info]`;
        break;
        
      default: // Custom template or fallback
        subject = `Reaching out from [Your Website] about ${niche}`;
        body = `Hi ${prospect.contactRole || "there"},

I'm [Your Name] from [Your Website]. I came across ${siteName} while researching ${niche} resources and was impressed with your content.

[Personalized comment about their website or recent content]

I'm reaching out because [reason for contact/value proposition].

[Additional context, details, or questions]

Would you be interested in discussing this further? I'm available for a call or can provide more information via email.

Thank you for your time and consideration.

Best regards,
[Your Name]
[Your Position], [Your Website]`;
    }
    
    return { subject, body };
  }

  async sendEmail(emailData: InsertEmail): Promise<OutreachEmail> {
    const id = this.currentEmailId++;
    const email: OutreachEmail = {
      ...emailData,
      id,
      sentAt: new Date(),
      status: "Awaiting response",
    };
    
    this.emails.set(id, email);
    return email;
  }

  async createFollowUpEmail(emailId: number, userId: number): Promise<OutreachEmail> {
    const originalEmail = this.emails.get(emailId);
    if (!originalEmail) {
      throw new Error("Email not found");
    }
    
    if (originalEmail.userId !== userId) {
      throw new Error("Unauthorized to follow up on this email");
    }
    
    const followUpBody = `Hi ${originalEmail.contactRole || "there"},

I hope this email finds you well. I reached out to you on ${originalEmail.sentAt.toDateString()} about ${originalEmail.subject}.

I understand you're likely very busy, but I wanted to follow up and see if you had a chance to consider my proposal.

[Add any additional value or incentive here]

I'd be happy to answer any questions you might have.

Best regards,
[Your Name]
[Your Position], [Your Website]`;
    
    const followUpEmail: OutreachEmail = {
      id: this.currentEmailId++,
      userId,
      prospectId: originalEmail.prospectId,
      emailTemplate: "followup",
      subject: `Following up: ${originalEmail.subject}`,
      body: followUpBody,
      contactEmail: originalEmail.contactEmail,
      contactRole: originalEmail.contactRole,
      siteName: originalEmail.siteName,
      domainAuthority: originalEmail.domainAuthority,
      sentAt: new Date(),
      status: "Awaiting response",
      parentEmailId: emailId,
    };
    
    this.emails.set(followUpEmail.id, followUpEmail);
    return followUpEmail;
  }

  async getUserEmails(userId: number): Promise<OutreachEmail[]> {
    return Array.from(this.emails.values()).filter(
      (email) => email.userId === userId
    ).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  async getRecentEmails(userId: number): Promise<OutreachEmail[]> {
    const allEmails = await this.getUserEmails(userId);
    return allEmails.slice(0, 5);
  }

  async getUserAnalytics(userId: number, timeRange: string): Promise<Analytics> {
    // Generate mock analytics data for demo purposes
    const emailPerformance = [
      { date: '2023-01-01', sent: 5, opens: 3, responses: 1 },
      { date: '2023-01-02', sent: 8, opens: 5, responses: 2 },
      { date: '2023-01-03', sent: 4, opens: 3, responses: 1 },
      { date: '2023-01-04', sent: 7, opens: 4, responses: 2 },
      { date: '2023-01-05', sent: 6, opens: 3, responses: 1 },
    ];
    
    const backlinksAcquired = [
      { date: '2023-01-01', count: 0 },
      { date: '2023-01-02', count: 1 },
      { date: '2023-01-03', count: 0 },
      { date: '2023-01-04', count: 2 },
      { date: '2023-01-05', count: 0 },
    ];
    
    const responseRateByNiche = [
      { niche: 'SEO', rate: 0.25 },
      { niche: 'Content', rate: 0.35 },
      { niche: 'Web Dev', rate: 0.2 },
      { niche: 'Digital Marketing', rate: 0.4 },
      { niche: 'Business', rate: 0.15 },
    ];
    
    const creditUsage = [
      { date: '2023-01-01', used: 5, remaining: 45 },
      { date: '2023-01-02', used: 7, remaining: 38 },
      { date: '2023-01-03', used: 4, remaining: 34 },
      { date: '2023-01-04', used: 6, remaining: 28 },
      { date: '2023-01-05', used: 8, remaining: 20 },
    ];
    
    const daDistribution = [
      { range: '0-20', count: Math.floor(Math.random() * 5) },
      { range: '21-40', count: Math.floor(Math.random() * 10) + 5 },
      { range: '41-60', count: Math.floor(Math.random() * 15) + 10 },
      { range: '61-80', count: Math.floor(Math.random() * 5) + 3 },
      { range: '81-100', count: Math.floor(Math.random() * 3) },
    ];
    
    return {
      emailPerformance,
      backlinksAcquired,
      responseRateByNiche,
      creditUsage,
      daDistribution,
    };
  }
}

// Database implementation of the storage interface
export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;
  
  constructor() {
    // Use MemoryStore for simplicity to get the app running
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      subscription: "Free Trial",
      dailyOpportunitiesLimit: 5,
      splashesAllowed: 1,
      splashesUsed: 0,
      lastSplashReset: new Date(),
    }).returning();
    return user;
  }

  async updateUserSubscription(userId: number, plan: string): Promise<User> {
    // Update subscription related values based on the plan
    let dailyOpportunitiesLimit = 5;
    let splashesAllowed = 1;
    let maxWebsites = 1;
    
    switch (plan) {
      case 'Pro':
        dailyOpportunitiesLimit = 15; // 10-15 drips/day
        splashesAllowed = 7;          // 7 Splashes per month
        maxWebsites = 5;              // Up to 5 websites
        break;
      case 'Grow':
        dailyOpportunitiesLimit = 10; // 7-10 drips/day
        splashesAllowed = 3;          // 3 Splashes per month
        maxWebsites = 2;              // Up to 2 websites
        break;
      case 'Starter':
        dailyOpportunitiesLimit = 7;  // 5-7 drips/day
        splashesAllowed = 1;          // 1 Splash per month
        maxWebsites = 1;              // 1 website only
        break;
      default: // Free Trial
        dailyOpportunitiesLimit = 5;
        splashesAllowed = 1;
        maxWebsites = 1;
        break;
    }
    
    // Reset the splash usage counter and set billing anniversary 
    const now = new Date();
    const billingAnniversary = new Date();
    billingAnniversary.setMonth(billingAnniversary.getMonth() + 1); // Set to one month from now
    
    const [updatedUser] = await db.update(users)
      .set({ 
        subscription: plan, 
        dailyOpportunitiesLimit,
        splashesAllowed,
        splashesUsed: 0,
        lastSplashReset: now,
        billingAnniversary,
        maxWebsites
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }

  async updateUserSplashes(userId: number, splashesUsed: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ splashesUsed })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }
  
  async resetMonthlySplashes(userId: number): Promise<User> {
    // Find the user first to check their subscription
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Reset Splashes based on their subscription
    let splashesAllowed = 1; // Default for Free Trial
    
    switch (user.subscription) {
      case 'Pro':
        splashesAllowed = 7;
        break;
      case 'Grow':
        splashesAllowed = 3;
        break;
      case 'Starter':
        splashesAllowed = 1;
        break;
      default:
        splashesAllowed = 1;
        break;
    }
    
    // Update user with reset splash values
    const [updatedUser] = await db.update(users)
      .set({ 
        splashesUsed: 0,
        splashesAllowed,
        lastSplashReset: new Date(),
        billingAnniversary: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async getUserStats(userId: number): Promise<Stats> {
    // Get user data
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Count unlocked prospects for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const unlockedToday = await db.select({ count: sql<number>`count(*)` })
      .from(prospects)
      .where(and(
        eq(prospects.unlockedBy, userId),
        gte(prospects.unlockedAt, today)
      ));
    
    // Count emails sent
    const emailCount = await db.select({ count: sql<number>`count(*)` })
      .from(outreachEmails)
      .where(eq(outreachEmails.userId, userId));
    
    // Count backlinks secured (emails with "Responded" status)
    const backlinks = await db.select({ 
        count: sql<number>`count(*)`,
        avgDa: sql<number>`avg(50)` // Using dummy value as placeholder for avgDa
      })
      .from(outreachEmails)
      .where(and(
        eq(outreachEmails.userId, userId),
        eq(outreachEmails.status, "Responded")
      ));
    
    // Calculate splash information
    const splashesRemaining = (user.splashesAllowed || 0) - (user.splashesUsed || 0);
    
    // Get next reset date for splashes (billing anniversary)
    const nextResetDate = user.billingAnniversary || new Date();
    
    return {
      dailyOpportunities: {
        used: unlockedToday[0]?.count || 0,
        total: user.dailyOpportunitiesLimit || 0,
      },
      splashes: {
        available: splashesRemaining,
        total: user.splashesAllowed || 0,
        nextReset: nextResetDate
      },
      emailsSent: {
        total: emailCount[0]?.count || 0,
        changePercentage: 12, // Mocked for demo
      },
      backlinksSecured: {
        total: backlinks[0]?.count || 0,
        new: 3, // Mocked for demo
        averageDA: Math.round(backlinks[0]?.avgDa || 0),
      },
    };
  }

  async getDailyProspects(userId: number): Promise<Prospect[]> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get prospects that aren't unlocked by this user
    const availableProspects = await db.select()
      .from(prospects)
      .where(or(
        isNull(prospects.unlockedBy),
        ne(prospects.unlockedBy, userId)
      ))
      .orderBy(desc(prospects.fitScore))
      .limit(user.dailyOpportunitiesLimit || 5);
    
    return availableProspects;
  }

  async getAllProspects(userId: number): Promise<Prospect[]> {
    // Return all prospects that are either not unlocked or unlocked by this user
    return db.select()
      .from(prospects)
      .where(or(
        isNull(prospects.unlockedBy),
        eq(prospects.unlockedBy, userId)
      ));
  }

  async getSavedProspects(userId: number): Promise<Prospect[]> {
    return db.select()
      .from(prospects)
      .where(and(
        eq(prospects.isSaved, true),
        eq(prospects.unlockedBy, userId)
      ));
  }

  async getUnlockedProspects(userId: number): Promise<Prospect[]> {
    return db.select()
      .from(prospects)
      .where(and(
        eq(prospects.isUnlocked, true),
        eq(prospects.unlockedBy, userId)
      ));
  }

  async getProspectById(id: number): Promise<Prospect | undefined> {
    const [prospect] = await db.select()
      .from(prospects)
      .where(eq(prospects.id, id));
    
    return prospect;
  }

  async unlockProspect(id: number, userId: number): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    if (prospect.isUnlocked && prospect.unlockedBy !== userId) {
      throw new Error("This prospect has been unlocked by another user");
    }
    
    // Generate contact details when unlocking
    const domains = ["gmail.com", "outlook.com", "company.com", "site.com", "domain.com"];
    const roles = ["Editor", "Content Manager", "Webmaster", "Marketing Lead", "Partnerships", "SEO Manager"];
    const siteNames = [
      "Digital Marketer Blog", "SEO Guide", "Content Masters", 
      "Web Dev Journal", "Marketing Brew", "Tech Insights",
      "Business Daily", "Growth Hackers", "Coding Resources"
    ];
    
    const siteName = siteNames[Math.floor(Math.random() * siteNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const role = roles[Math.floor(Math.random() * roles.length)];
    
    // Create an email based on the site name
    const nameWords = siteName.toLowerCase().split(' ');
    let email = "";
    if (nameWords.length > 1) {
      email = `${nameWords[0]}.${nameWords[1]}@${domain}`;
    } else {
      email = `contact@${nameWords[0]}.${domain}`;
    }
    
    const [updatedProspect] = await db.update(prospects)
      .set({
        isUnlocked: true,
        unlockedBy: userId,
        unlockedAt: new Date(),
        siteName,
        contactEmail: email,
        contactRole: role,
      })
      .where(eq(prospects.id, id))
      .returning();
    
    return updatedProspect;
  }

  async saveProspect(id: number, userId: number): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    if (!prospect.isUnlocked || prospect.unlockedBy !== userId) {
      throw new Error("You must unlock this prospect before saving it");
    }
    
    const [updatedProspect] = await db.update(prospects)
      .set({ isSaved: true })
      .where(eq(prospects.id, id))
      .returning();
    
    return updatedProspect;
  }
  
  async hideProspect(id: number, userId: number): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    const [updatedProspect] = await db.update(prospects)
      .set({ isHidden: true })
      .where(eq(prospects.id, id))
      .returning();
    
    return updatedProspect;
  }
  
  async updateProspect(id: number, prospectData: Partial<Prospect>): Promise<Prospect> {
    const prospect = await this.getProspectById(id);
    if (!prospect) {
      throw new Error("Prospect not found");
    }
    
    // Remove properties that shouldn't be updated
    const { id: _, createdAt: __, ...updateData } = prospectData;
    
    const [updatedProspect] = await db.update(prospects)
      .set(updateData)
      .where(eq(prospects.id, id))
      .returning();
    
    return updatedProspect;
  }

  async generateEmail(prospect: Prospect, template: string): Promise<EmailTemplate> {
    // Generate email templates based on the selected template and prospect data
    const siteName = prospect.siteName || "the website";
    const niche = prospect.niche;
    
    let subject = "";
    let body = "";
    
    switch (template) {
      case "guest-post":
        subject = `Guest post opportunity for ${siteName}`;
        body = `Hi ${prospect.contactRole || "there"},

I'm [Your Name] from [Your Website], and I've been following ${siteName} for quite some time now. I particularly enjoy your content about ${niche} and how you provide valuable insights to your audience.

I notice you publish guest posts on ${niche} topics, and I'd love to contribute an article for your readers. Based on your site's content, I think your audience would find value in an article titled:

"7 Advanced ${niche} Strategies That Boosted Our Results by 156% in 6 Months"

This would be a detailed, actionable case study with real data from our own efforts. I'd include specific tactics, screenshots, and results that your audience could implement right away.

Would this be something your readers would find valuable? I'm happy to tailor the topic or approach to better fit your content guidelines.

Looking forward to potentially collaborating!

Best regards,
[Your Name]
[Your Position], [Your Website]`;
        break;
        
      case "resource-mention":
        subject = `Resource for your ${niche} article on ${siteName}`;
        body = `Hi ${prospect.contactRole || "there"},

I recently came across your excellent article about ${niche} on ${siteName}. The insights you shared about [specific topic] were particularly helpful, and I've already implemented some of your suggestions.

I wanted to reach out because I've created a comprehensive resource that complements the information in your article perfectly. It's a [resource type - guide/tool/template] that helps users [benefit].

You can check it out here: [Resource URL]

I thought this might be a valuable addition to your article, providing your readers with an actionable resource to implement what they've learned. If you find it helpful, perhaps you could consider mentioning or linking to it in your post.

Either way, I wanted to thank you for your excellent content and let you know how much value it's provided.

Best regards,
[Your Name]
[Your Position], [Your Website]`;
        break;
        
      case "collaboration":
        subject = `Collaboration opportunity with ${siteName}`;
        body = `Hi ${prospect.contactRole || "there"},

My name is [Your Name] from [Your Website], a platform focused on ${niche}. I've been following ${siteName} for a while and really appreciate your expertise in the field.

I'm reaching out because I see some great potential for collaboration between our platforms. We serve similar audiences but have complementary offerings that could benefit both our reader bases.

Some potential collaboration ideas:
- Co-creating content that leverages both our expertise
- Cross-promotion to our respective audiences
- Webinar or workshop partnership
- Joint research project on industry trends

Would you be open to discussing these possibilities? I'd love to schedule a quick call to explore how we might work together to provide even more value to our audiences.

Looking forward to your thoughts!

Best regards,
[Your Name]
[Your Position], [Your Website]
[Your Contact Info]`;
        break;
        
      default: // Custom template or fallback
        subject = `Reaching out from [Your Website] about ${niche}`;
        body = `Hi ${prospect.contactRole || "there"},

I'm [Your Name] from [Your Website]. I came across ${siteName} while researching ${niche} resources and was impressed with your content.

[Personalized comment about their website or recent content]

I'm reaching out because [reason for contact/value proposition].

[Additional context, details, or questions]

Would you be interested in discussing this further? I'm available for a call or can provide more information via email.

Thank you for your time and consideration.

Best regards,
[Your Name]
[Your Position], [Your Website]`;
    }
    
    return { subject, body };
  }

  async sendEmail(emailData: InsertEmail): Promise<OutreachEmail> {
    const [email] = await db.insert(outreachEmails)
      .values({
        ...emailData,
        sentAt: new Date(),
        status: "Awaiting response",
      })
      .returning();
    
    return email;
  }

  async createFollowUpEmail(emailId: number, userId: number): Promise<OutreachEmail> {
    const [originalEmail] = await db.select()
      .from(outreachEmails)
      .where(eq(outreachEmails.id, emailId));
    
    if (!originalEmail) {
      throw new Error("Email not found");
    }
    
    if (originalEmail.userId !== userId) {
      throw new Error("Unauthorized to follow up on this email");
    }
    
    const followUpBody = `Hi ${originalEmail.contactRole || "there"},

I hope this email finds you well. I reached out to you on ${originalEmail.sentAt.toDateString()} about ${originalEmail.subject}.

I understand you're likely very busy, but I wanted to follow up and see if you had a chance to consider my proposal.

[Add any additional value or incentive here]

I'd be happy to answer any questions you might have.

Best regards,
[Your Name]
[Your Position], [Your Website]`;
    
    const [followUpEmail] = await db.insert(outreachEmails)
      .values({
        userId,
        prospectId: originalEmail.prospectId,
        emailTemplate: "followup",
        subject: `Following up: ${originalEmail.subject}`,
        body: followUpBody,
        contactEmail: originalEmail.contactEmail,
        contactRole: originalEmail.contactRole,
        siteName: originalEmail.siteName,
        domainAuthority: originalEmail.domainAuthority,
        sentAt: new Date(),
        status: "Awaiting response",
        parentEmailId: emailId,
      })
      .returning();
    
    return followUpEmail;
  }

  async getUserEmails(userId: number): Promise<OutreachEmail[]> {
    return db.select()
      .from(outreachEmails)
      .where(eq(outreachEmails.userId, userId))
      .orderBy(desc(outreachEmails.sentAt));
  }

  async getRecentEmails(userId: number): Promise<OutreachEmail[]> {
    return db.select()
      .from(outreachEmails)
      .where(eq(outreachEmails.userId, userId))
      .orderBy(desc(outreachEmails.sentAt))
      .limit(5);
  }

  async getUserAnalytics(userId: number, timeRange: string): Promise<Analytics> {
    // Generate mock analytics data for demo purposes
    const emailPerformance = [
      { date: '2023-01-01', sent: 5, opens: 3, responses: 1 },
      { date: '2023-01-02', sent: 8, opens: 5, responses: 2 },
      { date: '2023-01-03', sent: 4, opens: 3, responses: 1 },
      { date: '2023-01-04', sent: 7, opens: 4, responses: 2 },
      { date: '2023-01-05', sent: 6, opens: 3, responses: 1 },
    ];
    
    const backlinksAcquired = [
      { date: '2023-01-01', count: 0 },
      { date: '2023-01-02', count: 1 },
      { date: '2023-01-03', count: 0 },
      { date: '2023-01-04', count: 2 },
      { date: '2023-01-05', count: 0 },
    ];
    
    const responseRateByNiche = [
      { niche: 'SEO', rate: 0.25 },
      { niche: 'Content', rate: 0.35 },
      { niche: 'Web Dev', rate: 0.2 },
      { niche: 'Digital Marketing', rate: 0.4 },
      { niche: 'Business', rate: 0.15 },
    ];
    
    const creditUsage = [
      { date: '2023-01-01', used: 5, remaining: 45 },
      { date: '2023-01-02', used: 7, remaining: 38 },
      { date: '2023-01-03', used: 4, remaining: 34 },
      { date: '2023-01-04', used: 6, remaining: 28 },
      { date: '2023-01-05', used: 8, remaining: 20 },
    ];
    
    const daDistribution = [
      { range: '0-20', count: 2 },
      { range: '21-40', count: 8 },
      { range: '41-60', count: 15 },
      { range: '61-80', count: 10 },
      { range: '81-100', count: 5 },
    ];
    
    return {
      emailPerformance,
      backlinksAcquired,
      responseRateByNiche,
      creditUsage,
      daDistribution,
    };
  }
  
  // Onboarding methods
  async updateUserWebsites(userId: number, websites: any[]): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ websites })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  async updateWebsitePreferences(userId: number, websiteIndex: number, preferences: any): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      throw new Error("User not found");
    }
    
    if (!user.websites || !Array.isArray(user.websites) || websiteIndex >= user.websites.length) {
      throw new Error("Website not found");
    }
    
    const websites = [...(user.websites || [])];
    websites[websiteIndex] = {
      ...websites[websiteIndex],
      preferences,
    };
    
    const [updatedUser] = await db.update(users)
      .set({ websites })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("Failed to update user");
    }
    
    return updatedUser;
  }
  
  async completeOnboarding(userId: number): Promise<User> {
    try {
      // Execute a direct SQL query to ensure proper column case
      const result = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!result) {
        throw new Error("User not found");
      }
      
      // Use raw SQL to update the onboardingCompleted column
      await db.$executeRaw`UPDATE users SET "onboardingCompleted" = true WHERE id = ${userId}`;
      
      // Fetch the updated user
      const updatedUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!updatedUser) {
        throw new Error("Failed to fetch updated user");
      }
      
      return updatedUser;
    } catch (error) {
      console.error("Error in completeOnboarding:", error);
      throw error;
    }
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();