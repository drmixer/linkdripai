/**
 * Subscription Service
 * 
 * Manages subscription-related operations for LinkDripAI
 */
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getLemonSqueezyService } from "./lemon-squeezy-service";
import { SubscriptionPlan, SplashPackage } from '../../client/src/lib/subscription-plans';

export class SubscriptionService {
  private lemonSqueezyService;

  constructor() {
    this.lemonSqueezyService = getLemonSqueezyService();
  }

  /**
   * Update a user's subscription after successful checkout
   */
  async updateUserSubscription(
    userId: number,
    subscriptionId: string,
    customerId: string,
    variantId: string,
  ) {
    // Get subscription details from Lemon Squeezy
    const subscriptionDetails = await this.lemonSqueezyService.getSubscriptionDetails(subscriptionId);
    
    if (!subscriptionDetails) {
      throw new Error("Failed to get subscription details");
    }
    
    const status = subscriptionDetails.status || 'active';
    const renewsAt = subscriptionDetails.renewsAt ? new Date(subscriptionDetails.renewsAt) : null;
    const endsAt = subscriptionDetails.endsAt ? new Date(subscriptionDetails.endsAt) : null;
    
    // Determine the plan type based on variant ID
    const planName = this.getPlanNameFromVariantId(variantId);
    
    // Update the user's subscription details
    await db.update(users)
      .set({
        subscription: planName,
        subscriptionId: subscriptionId,
        subscriptionStatus: status,
        planVariantId: variantId,
        customerId: customerId,
        subscriptionRenewsAt: renewsAt,
        subscriptionEndsAt: endsAt,
      })
      .where(eq(users.id, userId));
    
    return {
      success: true,
      plan: planName,
      status,
      renewsAt,
      endsAt
    };
  }
  
  /**
   * Add splash credits to a user's account
   */
  async addSplashCredits(userId: number, splashPackageId: string) {
    // Get current user
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Determine credits to add based on package
    const creditsToAdd = this.getSplashCreditsFromPackageId(splashPackageId);
    const currentCredits = user.splashCredits || 0;
    const newTotal = currentCredits + creditsToAdd;
    
    // Update user with new credits
    await db.update(users)
      .set({
        splashCredits: newTotal
      })
      .where(eq(users.id, userId));
    
    return {
      success: true,
      previousCredits: currentCredits,
      addedCredits: creditsToAdd,
      totalCredits: newTotal
    };
  }
  
  /**
   * Check if a user has an active subscription
   */
  async hasActiveSubscription(userId: number): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user || !user.subscriptionId || user.subscriptionStatus !== 'active') {
      return false;
    }
    
    // Double-check with Lemon Squeezy to make sure subscription is still active
    if (user.subscriptionId) {
      return await this.lemonSqueezyService.isSubscriptionActive(user.subscriptionId);
    }
    
    return false;
  }
  
  /**
   * Use splash credits
   */
  async useSplashCredits(userId: number, count = 1): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user || (user.splashCredits || 0) < count) {
      return false;
    }
    
    const newTotal = (user.splashCredits || 0) - count;
    
    await db.update(users)
      .set({
        splashCredits: newTotal
      })
      .where(eq(users.id, userId));
    
    return true;
  }
  
  /**
   * Get plan name from variant ID
   */
  private getPlanNameFromVariantId(variantId: string): string {
    // Check which plan this variant ID belongs to
    if (variantId === process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID) {
      return "Starter";
    } else if (variantId === process.env.LEMON_SQUEEZY_GROW_VARIANT_ID) {
      return "Grow";
    } else if (variantId === process.env.LEMON_SQUEEZY_PRO_VARIANT_ID) {
      return "Pro";
    }
    
    // Fallback to using the predefined variant mappings
    for (const [plan, id] of Object.entries(this.lemonSqueezyService.getPlanVariantIds())) {
      if (id === variantId) {
        return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
      }
    }
    
    return "Starter"; // Default to Starter if we can't determine
  }
  
  /**
   * Get splash credits from package ID
   */
  private getSplashCreditsFromPackageId(packageId: string): number {
    if (packageId === process.env.LEMON_SQUEEZY_SINGLE_SPLASH_VARIANT_ID) {
      return 1;
    } else if (packageId === process.env.LEMON_SQUEEZY_TRIPLE_SPLASH_VARIANT_ID) {
      return 3;
    } else if (packageId === process.env.LEMON_SQUEEZY_SEVEN_SPLASH_VARIANT_ID) {
      return 7;
    }
    
    // Fallback to using the predefined variant mappings
    const splashDetails = {
      [SplashPackage.SINGLE]: 1,
      [SplashPackage.TRIPLE]: 3,
      [SplashPackage.SEVEN]: 7
    };
    
    for (const [pkg, id] of Object.entries(this.lemonSqueezyService.getSplashVariantIds())) {
      if (id === packageId) {
        return splashDetails[pkg as SplashPackage] || 1;
      }
    }
    
    return 1; // Default to 1 if we can't determine
  }
}

// Singleton instance
let subscriptionService: SubscriptionService | null = null;

export function getSubscriptionService(): SubscriptionService {
  if (!subscriptionService) {
    subscriptionService = new SubscriptionService();
  }
  return subscriptionService;
}