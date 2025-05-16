/**
 * Subscription Plans Configuration
 * 
 * This file defines the subscription plans available in LinkDripAI,
 * including their details, features, and pricing.
 */

export enum SubscriptionPlan {
  STARTER = 'starter',
  GROW = 'grow',
  PRO = 'pro'
}

export interface PlanDetails {
  name: string;
  description: string;
  price: number;
  websites: number;
  dripsPerDay: number;
  splashesPerMonth: number;
  features: string[];
}

export const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
  [SubscriptionPlan.STARTER]: {
    name: 'Starter',
    description: 'Perfect for individual users getting started with backlink outreach.',
    price: 9,
    websites: 1,
    dripsPerDay: 5,
    splashesPerMonth: 1,
    features: [
      '1 website',
      'Up to 5 drips/day/site',
      '1 splash/month',
      'Basic opportunity filtering',
      'Email templates',
      'Basic analytics',
      'Standard support'
    ]
  },
  [SubscriptionPlan.GROW]: {
    name: 'Grow',
    description: 'Ideal for growing websites and small agencies.',
    price: 19,
    websites: 2,
    dripsPerDay: 10,
    splashesPerMonth: 3,
    features: [
      '2 websites',
      'Up to 10 drips/day/site',
      '3 splashes/month',
      'Advanced opportunity filtering',
      'Custom email templates',
      'Enhanced analytics',
      'Priority support',
      'Email tracking'
    ]
  },
  [SubscriptionPlan.PRO]: {
    name: 'Pro',
    description: 'For agencies and serious SEO professionals.',
    price: 39,
    websites: 5,
    dripsPerDay: 15,
    splashesPerMonth: 7,
    features: [
      '5 websites',
      'Up to 15 drips/day/site',
      '7 splashes/month',
      'Advanced opportunity filtering',
      'AI-powered email personalization',
      'Full analytics dashboard',
      'Priority support',
      'Email tracking and scheduling',
      'Team collaboration tools'
    ]
  }
};

// Splash packages for individual purchases
export enum SplashPackage {
  SINGLE = 'single',
  TRIPLE = 'triple',
  SEVEN = 'seven'
}

export interface SplashDetails {
  name: string;
  description: string;
  price: number;
  count: number;
  savings: number;
}

export const SPLASH_DETAILS: Record<SplashPackage, SplashDetails> = {
  [SplashPackage.SINGLE]: {
    name: 'Single Splash',
    description: 'One premium high-DA backlink opportunity',
    price: 7,
    count: 1,
    savings: 0
  },
  [SplashPackage.TRIPLE]: {
    name: 'Triple Splash',
    description: 'Three premium high-DA backlink opportunities',
    price: 18,
    count: 3,
    savings: 15
  },
  [SplashPackage.SEVEN]: {
    name: 'Seven Splash',
    description: 'Seven premium high-DA backlink opportunities',
    price: 35,
    count: 7,
    savings: 30
  }
};