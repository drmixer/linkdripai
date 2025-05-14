/**
 * LemonSqueezy Configuration
 * 
 * This file contains the configuration for the LemonSqueezy integration,
 * including variant IDs for subscription plans and splash packages.
 * 
 * These values should be set as environment variables for security and flexibility.
 */

export const SUBSCRIPTION_VARIANT_IDS = {
  // Subscription plan variant IDs
  STARTER: process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID || '802543',
  GROW: process.env.LEMON_SQUEEZY_GROW_VARIANT_ID || '802555',
  PRO: process.env.LEMON_SQUEEZY_PRO_VARIANT_ID || '802556',
};

export const SPLASH_PACKAGE_VARIANT_IDS = {
  // Splash package variant IDs
  SINGLE: process.env.LEMON_SQUEEZY_SINGLE_SPLASH_VARIANT_ID || '802558',
  TRIPLE: process.env.LEMON_SQUEEZY_TRIPLE_SPLASH_VARIANT_ID || '802561',
  SEVEN: process.env.LEMON_SQUEEZY_SEVEN_SPLASH_VARIANT_ID || '802564',
};

// Map subscription variant IDs to plan names
export const SUBSCRIPTION_PLAN_MAPPING: Record<string, string> = {
  [SUBSCRIPTION_VARIANT_IDS.STARTER]: 'Starter',
  [SUBSCRIPTION_VARIANT_IDS.GROW]: 'Grow',
  [SUBSCRIPTION_VARIANT_IDS.PRO]: 'Pro',
};

// Map plan names to features
export const PLAN_FEATURES = {
  Starter: {
    websitesLimit: 1,
    dailyDripsPerSite: 5,
    splashesPerMonth: 1,
    advancedFilters: false,
  },
  Grow: {
    websitesLimit: 2,
    dailyDripsPerSite: 10,
    splashesPerMonth: 3,
    advancedFilters: true,
  },
  Pro: {
    websitesLimit: 5,
    dailyDripsPerSite: 15,
    splashesPerMonth: 7,
    advancedFilters: true,
  },
};

// Map splash package variant IDs to number of splashes
export const SPLASH_PACKAGE_MAPPING: Record<string, number> = {
  [SPLASH_PACKAGE_VARIANT_IDS.SINGLE]: 1,
  [SPLASH_PACKAGE_VARIANT_IDS.TRIPLE]: 3,
  [SPLASH_PACKAGE_VARIANT_IDS.SEVEN]: 7,
};