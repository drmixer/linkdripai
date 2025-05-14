/**
 * LemonSqueezy Configuration
 * 
 * This file contains the configuration for LemonSqueezy integration,
 * including variant IDs for subscription plans and splash packages.
 */

import { SubscriptionPlan, SplashPackage } from "../../client/src/lib/subscription-plans";

// Variant IDs for subscription plans in LemonSqueezy
// These need to be set in the environment or updated here with actual values
export const SUBSCRIPTION_PLAN_VARIANTS = {
  [SubscriptionPlan.STARTER]: process.env.LEMON_STARTER_VARIANT_ID || "712223",  // Example ID
  [SubscriptionPlan.GROW]: process.env.LEMON_GROW_VARIANT_ID || "712224",        // Example ID
  [SubscriptionPlan.PRO]: process.env.LEMON_PRO_VARIANT_ID || "712225",          // Example ID
};

// Variant IDs for splash packages in LemonSqueezy
export const SPLASH_PACKAGE_VARIANTS = {
  [SplashPackage.SINGLE]: process.env.LEMON_SINGLE_SPLASH_VARIANT_ID || "712226",  // Example ID
  [SplashPackage.TRIPLE]: process.env.LEMON_TRIPLE_SPLASH_VARIANT_ID || "712227",  // Example ID
  [SplashPackage.SEVEN]: process.env.LEMON_SEVEN_SPLASH_VARIANT_ID || "712228",    // Example ID
};

// Mapping from variant IDs to plan names for webhook processing
export const SUBSCRIPTION_PLAN_MAPPING: Record<string, string> = {
  [SUBSCRIPTION_PLAN_VARIANTS[SubscriptionPlan.STARTER]]: SubscriptionPlan.STARTER,
  [SUBSCRIPTION_PLAN_VARIANTS[SubscriptionPlan.GROW]]: SubscriptionPlan.GROW,
  [SUBSCRIPTION_PLAN_VARIANTS[SubscriptionPlan.PRO]]: SubscriptionPlan.PRO,
};

// Mapping from variant IDs to splash counts for webhook processing
export const SPLASH_PACKAGE_MAPPING: Record<string, number> = {
  [SPLASH_PACKAGE_VARIANTS[SplashPackage.SINGLE]]: 1,
  [SPLASH_PACKAGE_VARIANTS[SplashPackage.TRIPLE]]: 3,
  [SPLASH_PACKAGE_VARIANTS[SplashPackage.SEVEN]]: 7,
};