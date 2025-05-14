/**
 * Subscription Routes
 * 
 * This file implements the API routes for subscription management,
 * including checkout URLs for subscriptions and splash packages,
 * and splash feature functionality.
 */

import { Router } from 'express';
import { getLemonSqueezyService } from '../services/lemon-squeezy-service';
import { storage } from '../storage';
import {
  SUBSCRIPTION_PLAN_VARIANTS,
  SPLASH_PACKAGE_VARIANTS
} from '../config/lemon-squeezy-config';
import { z } from 'zod';

const router = Router();
const lemonSqueezy = getLemonSqueezyService();

// Middleware to check if user is authenticated
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Get user's subscription details
router.get('/details', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    let subscriptionDetails = null;
    
    // If the user has a subscription, get details from LemonSqueezy
    if (user.subscriptionId) {
      try {
        subscriptionDetails = await lemonSqueezy.getSubscriptionDetails(user.subscriptionId);
      } catch (error) {
        console.error('[Subscription] Error getting subscription details:', error);
        // Just continue with null subscription details
      }
    }
    
    // Calculate next billing date and amount
    const billingInfo = user.subscriptionRenewsAt 
      ? {
          nextBillingDate: user.subscriptionRenewsAt,
          amount: subscriptionDetails?.amount || null,
          status: user.subscriptionStatus || 'inactive'
        }
      : null;
    
    // Return subscription details
    res.json({
      subscription: user.subscription || null,
      status: user.subscriptionStatus || 'inactive',
      billingInfo,
      websites: user.websites || 1,
      splashesUsed: user.splashesUsed || 0,
      splashesTotal: user.splashesLimit || 1
    });
    
  } catch (error: any) {
    console.error('[Subscription] Error getting subscription details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create checkout URL for subscription
router.post('/checkout', isAuthenticated, async (req, res) => {
  try {
    // Validate request body
    const schema = z.object({
      planId: z.string(),
      redirectUrl: z.string().optional(),
      name: z.string().optional(),
      email: z.string().email().optional(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    
    const { planId, redirectUrl, name, email } = result.data;
    const userId = req.user!.id;
    
    // Get the variant ID for the plan
    const variantId = SUBSCRIPTION_PLAN_VARIANTS[planId as keyof typeof SUBSCRIPTION_PLAN_VARIANTS];
    if (!variantId) {
      return res.status(400).json({ message: "Invalid plan ID" });
    }
    
    // Create checkout URL
    const checkoutUrl = await lemonSqueezy.createCheckoutUrl(
      planId as any,
      {
        name: name || `${req.user!.firstName} ${req.user!.lastName}`.trim(),
        email: email || req.user!.email,
        userId: userId.toString(),
      },
      redirectUrl
    );
    
    res.json({ checkoutUrl });
  } catch (error: any) {
    console.error('[Subscription] Error creating checkout URL:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create checkout URL for splash package
router.post('/splash-checkout', isAuthenticated, async (req, res) => {
  try {
    // Validate request body
    const schema = z.object({
      splashPackage: z.string(),
      redirectUrl: z.string().optional(),
      name: z.string().optional(),
      email: z.string().email().optional(),
    });
    
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    
    const { splashPackage, redirectUrl, name, email } = result.data;
    const userId = req.user!.id;
    
    // Get the variant ID for the splash package
    const variantId = SPLASH_PACKAGE_VARIANTS[splashPackage as keyof typeof SPLASH_PACKAGE_VARIANTS];
    if (!variantId) {
      return res.status(400).json({ message: "Invalid splash package" });
    }
    
    // Create checkout URL
    const checkoutUrl = await lemonSqueezy.createSplashCheckoutUrl(
      splashPackage as any,
      {
        name: name || `${req.user!.firstName} ${req.user!.lastName}`.trim(),
        email: email || req.user!.email,
        userId: userId.toString(),
      },
      redirectUrl
    );
    
    res.json({ checkoutUrl });
  } catch (error: any) {
    console.error('[Subscription] Error creating splash checkout URL:', error);
    res.status(500).json({ message: error.message });
  }
});

// Use a splash credit to get a premium opportunity
router.post('/use-splash', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if user has splash credits available
    const splashesUsed = user.splashesUsed || 0;
    let splashesLimit = 1; // Default for Free Trial/Starter
    
    // Determine splash limit based on subscription
    if (user.subscription === 'Pro') {
      splashesLimit = 7;
    } else if (user.subscription === 'Grow') {
      splashesLimit = 3;
    }
    
    // Add any additional splashes from purchases
    splashesLimit += (user.splashesAdded || 0);
    
    // Check if user has available splash credits
    if (splashesUsed >= splashesLimit) {
      return res.status(400).json({ 
        message: "No splash credits available. Please upgrade your plan or purchase additional splash credits." 
      });
    }
    
    // Get user websites to find available domains for opportunities
    const websites = await storage.getUserWebsites(userId);
    
    if (!websites || websites.length === 0) {
      return res.status(400).json({ 
        message: "No websites configured. Please add at least one website to use splash." 
      });
    }
    
    // Get a random premium opportunity
    const opportunity = await storage.getRandomPremiumOpportunity();
    
    if (!opportunity) {
      return res.status(404).json({ 
        message: "No premium opportunities available at the moment. Please try again later." 
      });
    }
    
    // Increment the user's splash usage
    await storage.updateUserSplashCredits(userId, splashesUsed + 1);
    
    // Add opportunity to user's drips
    await storage.addOpportunityToDrips(userId, opportunity.id, true);
    
    // Return the opportunity
    res.json({
      opportunityId: opportunity.id,
      splashesUsed: splashesUsed + 1,
      splashesLimit
    });
  } catch (error: any) {
    console.error('[Subscription] Error using splash:', error);
    res.status(500).json({ message: error.message });
  }
});

// Cancel subscription
router.post('/cancel', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user || !user.subscriptionId) {
      return res.status(400).json({ message: "No active subscription found" });
    }
    
    // Cancel the subscription in LemonSqueezy
    await lemonSqueezy.cancelSubscription(user.subscriptionId);
    
    // Update user record
    await storage.updateUserSubscription(userId, {
      subscriptionStatus: 'cancelled'
    });
    
    res.json({ success: true, message: "Subscription cancelled successfully" });
  } catch (error: any) {
    console.error('[Subscription] Error cancelling subscription:', error);
    res.status(500).json({ message: error.message });
  }
});

// Resume subscription
router.post('/resume', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user || !user.subscriptionId) {
      return res.status(400).json({ message: "No subscription found" });
    }
    
    if (user.subscriptionStatus !== 'cancelled') {
      return res.status(400).json({ message: "Subscription is not cancelled" });
    }
    
    // Resume the subscription in LemonSqueezy
    await lemonSqueezy.resumeSubscription(user.subscriptionId);
    
    // Update user record
    await storage.updateUserSubscription(userId, {
      subscriptionStatus: 'active'
    });
    
    res.json({ success: true, message: "Subscription resumed successfully" });
  } catch (error: any) {
    console.error('[Subscription] Error resuming subscription:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;