export enum SubscriptionPlan {
  FREE_TRIAL = "Free Trial",
  STARTER = "Starter",
  GROW = "Grow",
  PRO = "Pro",
}

export enum SplashPackage {
  SINGLE = "Single Splash",
  TRIPLE = "Triple Pack",
  SEVEN = "Seven Pack",
}

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: number | string;
  description?: string;
}

export interface PlanDetails {
  name: string;
  enum: SubscriptionPlan;
  price: {
    monthly: number;
    annually?: number;
  };
  features: PlanFeature[];
  dripsPerDay: number;
  splashesPerMonth: number;
  maxWebsites: number;
  ctaText: string;
  popular?: boolean;
  variant?: string; // Lemon Squeezy variant ID
}

export const planFeatures: Record<string, PlanFeature> = {
  domainInsights: {
    name: "Domain Insights",
    included: true,
    description: "Domain Authority, Spam Score, and more metrics"
  },
  seoMetrics: {
    name: "SEO Metrics",
    included: true,
    description: "Page Authority, Domain Authority and backlink data"
  },
  relevanceScoring: {
    name: "Relevance Scoring",
    included: true,
    description: "AI-powered content matching with your website"
  },
  premiumFilter: {
    name: "Premium Filters",
    included: false,
    description: "Advanced filtering options to find the best opportunities"
  },
  advancedMetrics: {
    name: "Advanced Metrics",
    included: false,
    description: "Expanded SEO metrics and analytics"
  },
  contactExtraction: {
    name: "Contact Extraction",
    included: true,
    description: "Email and social media contact information"
  },
  emailOutreach: {
    name: "Email Outreach",
    included: true,
    description: "Send emails directly from the platform"
  },
  multichannel: {
    name: "Multi-channel Outreach",
    included: false,
    description: "Contact via email, social media, and contact forms"
  },
  templates: {
    name: "Outreach Templates",
    included: true,
    limit: "5 templates",
    description: "Customizable outreach templates"
  },
  automatedFollowups: {
    name: "Automated Follow-ups",
    included: false,
    description: "Schedule automatic follow-up messages"
  },
  reporting: {
    name: "Performance Reports",
    included: false,
    description: "Detailed reports on your outreach performance"
  },
  aiAssistant: {
    name: "AI Writing Assistant",
    included: false,
    description: "AI-powered writing suggestions for outreach"
  },
  apiAccess: {
    name: "API Access",
    included: false,
    description: "Access our API for custom integrations"
  },
  supportBasic: {
    name: "Email Support",
    included: true,
    description: "Get help via email"
  },
  supportPriority: {
    name: "Priority Support",
    included: false,
    description: "Priority email and chat support"
  }
};

export interface SplashPackageDetails {
  name: string;
  enum: SplashPackage;
  price: number;
  count: number;
  savePercentage?: number;
  description?: string;
  variant?: string; // Lemon Squeezy variant ID
}

export const splashPackages: SplashPackageDetails[] = [
  {
    name: "Single Splash",
    enum: SplashPackage.SINGLE,
    price: 7,
    count: 1,
    description: "One premium opportunity with high-quality contact info"
  },
  {
    name: "Triple Pack",
    enum: SplashPackage.TRIPLE,
    price: 18,
    count: 3,
    savePercentage: 14,
    description: "3 premium opportunities with high-quality contact info"
  },
  {
    name: "Seven Pack",
    enum: SplashPackage.SEVEN,
    price: 35,
    count: 7,
    savePercentage: 29,
    description: "7 premium opportunities with high-quality contact info"
  }
];

export const subscriptionPlans: PlanDetails[] = [
  {
    name: "Free Trial",
    enum: SubscriptionPlan.FREE_TRIAL,
    price: {
      monthly: 0
    },
    features: [
      { ...planFeatures.domainInsights },
      { ...planFeatures.seoMetrics },
      { ...planFeatures.relevanceScoring },
      { ...planFeatures.contactExtraction },
      { ...planFeatures.emailOutreach },
      { ...planFeatures.templates, limit: "3 templates" },
      { ...planFeatures.supportBasic },
      { ...planFeatures.premiumFilter, included: false },
      { ...planFeatures.advancedMetrics, included: false },
      { ...planFeatures.multichannel, included: false },
      { ...planFeatures.automatedFollowups, included: false },
      { ...planFeatures.reporting, included: false },
    ],
    dripsPerDay: 5,
    splashesPerMonth: 1,
    maxWebsites: 1,
    ctaText: "Start Free Trial",
  },
  {
    name: "Starter",
    enum: SubscriptionPlan.STARTER,
    price: {
      monthly: 9,
      annually: 90
    },
    features: [
      { ...planFeatures.domainInsights },
      { ...planFeatures.seoMetrics },
      { ...planFeatures.relevanceScoring },
      { ...planFeatures.contactExtraction },
      { ...planFeatures.emailOutreach },
      { ...planFeatures.templates, limit: "5 templates" },
      { ...planFeatures.supportBasic },
      { ...planFeatures.premiumFilter, included: false },
      { ...planFeatures.advancedMetrics, included: false },
      { ...planFeatures.multichannel, included: false },
      { ...planFeatures.automatedFollowups, included: false },
      { ...planFeatures.reporting, included: false },
    ],
    dripsPerDay: 5,
    splashesPerMonth: 1,
    maxWebsites: 1,
    ctaText: "Get Started",
  },
  {
    name: "Grow",
    enum: SubscriptionPlan.GROW,
    price: {
      monthly: 19,
      annually: 190
    },
    features: [
      { ...planFeatures.domainInsights },
      { ...planFeatures.seoMetrics },
      { ...planFeatures.relevanceScoring },
      { ...planFeatures.contactExtraction },
      { ...planFeatures.emailOutreach },
      { ...planFeatures.templates, limit: "10 templates" },
      { ...planFeatures.supportBasic },
      { ...planFeatures.premiumFilter, included: true },
      { ...planFeatures.advancedMetrics, included: true },
      { ...planFeatures.multichannel, included: true },
      { ...planFeatures.automatedFollowups, included: false },
      { ...planFeatures.reporting, included: false },
    ],
    dripsPerDay: 10,
    splashesPerMonth: 3,
    maxWebsites: 2,
    ctaText: "Upgrade to Grow",
    popular: true,
  },
  {
    name: "Pro",
    enum: SubscriptionPlan.PRO,
    price: {
      monthly: 39,
      annually: 390
    },
    features: [
      { ...planFeatures.domainInsights },
      { ...planFeatures.seoMetrics },
      { ...planFeatures.relevanceScoring },
      { ...planFeatures.contactExtraction },
      { ...planFeatures.emailOutreach },
      { ...planFeatures.templates, limit: "Unlimited" },
      { ...planFeatures.supportPriority, included: true },
      { ...planFeatures.premiumFilter, included: true },
      { ...planFeatures.advancedMetrics, included: true },
      { ...planFeatures.multichannel, included: true },
      { ...planFeatures.automatedFollowups, included: true },
      { ...planFeatures.reporting, included: true },
      { ...planFeatures.aiAssistant, included: true },
    ],
    dripsPerDay: 15,
    splashesPerMonth: 7,
    maxWebsites: 5,
    ctaText: "Upgrade to Pro",
  }
];