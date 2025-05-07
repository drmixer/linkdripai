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
  credits: {
    available: number;
    total: number;
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
  updateUserCredits(userId: number, credits: number): Promise<User>;
  getUserStats(userId: number): Promise<Stats>;
  
  // Prospect methods
  getDailyProspects(userId: number): Promise<Prospect[]>;
  getAllProspects(userId: number): Promise<Prospect[]>;
  getSavedProspects(userId: number): Promise<Prospect[]>;
  getUnlockedProspects(userId: number): Promise<Prospect[]>;
  getProspectById(id: number): Promise<Prospect | undefined>;
  unlockProspect(id: number, userId: number): Promise<Prospect>;
  saveProspect(id: number, userId: number): Promise<Prospect>;
  
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
    // Create some sample prospect data
    const niches = ["Digital Marketing", "SEO", "Content", "Web Dev", "Programming", "Business"];
    const siteTypes = ["Blog with guest posting", "Premium blog", "Tutorial site", "News site", "Resource directory"];
    
    for (let i = 0; i < 20; i++) {
      const niche = niches[Math.floor(Math.random() * niches.length)];
      const siteType = siteTypes[Math.floor(Math.random() * siteTypes.length)];
      const da = Math.floor(Math.random() * 80) + 20;
      const trafficK = Math.floor(Math.random() * 200) + 30;
      const fitScore = Math.floor(Math.random() * 30) + 70;
      
      const prospect: Prospect = {
        id: this.currentProspectId++,
        siteType,
        siteName: "", // Will be revealed when unlocked
        domainAuthority: `${da}`,
        niche,
        monthlyTraffic: `${trafficK}K`,
        contactEmail: "", // Will be revealed when unlocked
        contactRole: "",
        fitScore,
        isUnlocked: false,
        isSaved: false,
        unlockedBy: undefined,
        unlockedAt: undefined,
        createdAt: new Date(),
      };
      
      this.prospects.set(prospect.id, prospect);
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
    const user: User = { 
      ...insertUser,
      id,
      subscription: "Free Trial",
      credits: 10,
      totalCredits: 10,
      dailyOpportunitiesLimit: 5,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserCredits(userId: number, credits: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser = {
      ...user,
      credits,
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
    
    return {
      dailyOpportunities: {
        used: unlockedToday,
        total: user.dailyOpportunitiesLimit,
      },
      credits: {
        available: user.credits,
        total: user.totalCredits,
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
    
    // Filter out already unlocked prospects for this user
    const availableProspects = allProspects.filter(
      (prospect) => !prospect.unlockedBy || prospect.unlockedBy !== userId
    );
    
    // Sort by fit score and take the top ones based on daily limit
    return availableProspects
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, dailyLimit);
  }

  async getAllProspects(userId: number): Promise<Prospect[]> {
    // Return all prospects that are either not unlocked or unlocked by this user
    return Array.from(this.prospects.values()).filter(
      (prospect) => !prospect.unlockedBy || prospect.unlockedBy === userId
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
      responseAt: undefined,
      isFollowUp: false,
      parentEmailId: null,
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
    
    const id = this.currentEmailId++;
    const followUpEmail: OutreachEmail = {
      ...originalEmail,
      id,
      body: `Hi ${originalEmail.contactRole || "there"},

I'm following up on my previous email about ${originalEmail.subject.toLowerCase().includes("guest post") ? "contributing a guest post" : "a potential collaboration"}.

${originalEmail.subject.toLowerCase().includes("guest post") 
  ? "I wanted to make sure you received my pitch for an article idea that I believe would resonate with your audience."
  : "I wanted to check if you had a chance to consider my previous message."}

I'm still very interested in working with ${originalEmail.siteName} and am happy to provide any additional information that might help with your decision.

Please let me know if you're interested or if you have any questions.

Best regards,
[Your Name]
[Your Website]

-------- Original Message --------
${originalEmail.body}`,
      subject: `Follow-up: ${originalEmail.subject}`,
      sentAt: new Date(),
      isFollowUp: true,
      parentEmailId: emailId,
      status: "Awaiting response",
    };
    
    this.emails.set(id, followUpEmail);
    
    // Update original email status if it was "No response"
    if (originalEmail.status === "No response") {
      const updatedOriginal = {
        ...originalEmail,
        status: "Followed up"
      };
      this.emails.set(emailId, updatedOriginal);
    }
    
    return followUpEmail;
  }

  async getUserEmails(userId: number): Promise<OutreachEmail[]> {
    return Array.from(this.emails.values())
      .filter(email => email.userId === userId)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }

  async getRecentEmails(userId: number): Promise<OutreachEmail[]> {
    const allEmails = await this.getUserEmails(userId);
    return allEmails.slice(0, 5); // Return just the 5 most recent emails
  }

  async getUserAnalytics(userId: number, timeRange: string): Promise<Analytics> {
    // Generate mock analytics data
    const now = new Date();
    const dates: string[] = [];
    
    // Generate date labels based on time range
    let days = 30;
    switch (timeRange) {
      case "7days":
        days = 7;
        break;
      case "30days":
        days = 30;
        break;
      case "90days":
        days = 90;
        break;
      case "year":
        days = 365;
        break;
    }
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(now.getDate() - (days - i - 1));
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // Email performance data
    const emailPerformance = dates.map(date => ({
      date,
      sent: Math.floor(Math.random() * 5),
      responses: Math.floor(Math.random() * 3),
    }));
    
    // Backlinks acquired by month
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = now.getMonth();
    const backlinksAcquired = [];
    
    for (let i = 0; i < 6; i++) {
      const monthIndex = (currentMonth - 5 + i) >= 0 
        ? (currentMonth - 5 + i) 
        : (currentMonth - 5 + i + 12);
      
      backlinksAcquired.push({
        month: months[monthIndex],
        count: Math.floor(Math.random() * 5) + 1,
      });
    }
    
    // Response rate by niche
    const responseRateByNiche = [
      { name: "Digital Marketing", value: 35 },
      { name: "SEO", value: 25 },
      { name: "Content", value: 20 },
      { name: "Web Dev", value: 15 },
      { name: "Other", value: 5 },
    ];
    
    // Credit usage over time
    const creditUsage = dates.slice(-14).map(date => ({
      date,
      used: Math.floor(Math.random() * 5) + 1,
      remaining: Math.floor(Math.random() * 20) + 10,
    }));
    
    // DA distribution
    const daDistribution = [
      { range: "0-20", count: Math.floor(Math.random() * 5) },
      { range: "21-40", count: Math.floor(Math.random() * 10) + 5 },
      { range: "41-60", count: Math.floor(Math.random() * 15) + 10 },
      { range: "61-80", count: Math.floor(Math.random() * 5) + 3 },
      { range: "81-100", count: Math.floor(Math.random() * 3) },
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
      credits: 10,
      totalCredits: 10,
      dailyOpportunitiesLimit: 5,
    }).returning();
    return user;
  }

  async updateUserCredits(userId: number, credits: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ credits })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
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
    
    return {
      dailyOpportunities: {
        used: unlockedToday[0]?.count || 0,
        total: user.dailyOpportunitiesLimit,
      },
      credits: {
        available: user.credits,
        total: user.totalCredits,
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
      .limit(user.dailyOpportunitiesLimit);
    
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

I'm following up on my previous email about ${originalEmail.subject.toLowerCase().includes("guest post") ? "contributing a guest post" : "a potential collaboration"}.

${originalEmail.subject.toLowerCase().includes("guest post") 
  ? "I wanted to make sure you received my pitch for an article idea that I believe would resonate with your audience."
  : "I wanted to check if you had a chance to consider my previous message about a possible collaboration opportunity."}

I understand you're likely very busy, but I'd love to get your thoughts on this when you have a moment.

Thanks again for your time.

Best regards,
[Your Name]
[Your Position], [Your Website]`;
    
    const followUpSubject = `Following up: ${originalEmail.subject}`;
    
    const [followUpEmail] = await db.insert(outreachEmails)
      .values({
        prospectId: originalEmail.prospectId,
        userId: originalEmail.userId,
        subject: followUpSubject,
        body: followUpBody,
        status: "Awaiting response",
        siteName: originalEmail.siteName,
        contactEmail: originalEmail.contactEmail,
        contactRole: originalEmail.contactRole,
        domainAuthority: originalEmail.domainAuthority,
        isFollowUp: true,
        parentEmailId: originalEmail.id,
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
    // Get the 5 most recent emails
    return db.select()
      .from(outreachEmails)
      .where(eq(outreachEmails.userId, userId))
      .orderBy(desc(outreachEmails.sentAt))
      .limit(5);
  }

  async getUserAnalytics(userId: number, timeRange: string): Promise<Analytics> {
    // In a real implementation, we would calculate this from actual data
    // For now, let's return mock data
    return {
      emailPerformance: [
        { date: '2023-01-01', sent: 5, opened: 3, responded: 1 },
        { date: '2023-01-02', sent: 7, opened: 4, responded: 2 },
        { date: '2023-01-03', sent: 4, opened: 3, responded: 1 },
        { date: '2023-01-04', sent: 6, opened: 4, responded: 2 },
        { date: '2023-01-05', sent: 8, opened: 5, responded: 3 },
      ],
      backlinksAcquired: [
        { date: '2023-01-01', count: 1 },
        { date: '2023-01-03', count: 1 },
        { date: '2023-01-05', count: 2 },
      ],
      responseRateByNiche: [
        { niche: 'Digital Marketing', rate: 0.35 },
        { niche: 'SEO', rate: 0.42 },
        { niche: 'Content', rate: 0.38 },
        { niche: 'Web Dev', rate: 0.25 },
        { niche: 'Programming', rate: 0.28 },
      ],
      creditUsage: [
        { date: '2023-01-01', used: 5, remaining: 45 },
        { date: '2023-01-02', used: 7, remaining: 38 },
        { date: '2023-01-03', used: 4, remaining: 34 },
        { date: '2023-01-04', used: 6, remaining: 28 },
        { date: '2023-01-05', used: 8, remaining: 20 },
      ],
      daDistribution: [
        { range: '0-20', count: 2 },
        { range: '21-40', count: 8 },
        { range: '41-60', count: 15 },
        { range: '61-80', count: 10 },
        { range: '81-100', count: 5 },
      ],
    };
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
