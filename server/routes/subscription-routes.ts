/**
 * Subscription and Payment Routes
 * 
 * Handles subscription plans, checkout, splash purchases, and user subscription details
 */

import { Router } from 'express';
import { getLemonSqueezyService, SubscriptionPlan, SplashPackage } from '../services/lemon-squeezy-service';
import { getSubscriptionService } from '../services/subscription-service';
import { storage } from '../storage';

const router = Router();
const lemonSqueezyService = getLemonSqueezyService();
const subscriptionService = getSubscriptionService();

/**
 * Get available subscription plans
 */
router.get('/plans', (req, res) => {
  try {
    // Get plan details 
    const plans = [
      {
        id: SubscriptionPlan.STARTER,
        name: 'Starter',
        price: 9,
        websites: 1,
        dripsPerDay: 5,
        splashesPerMonth: 1
      },
      {
        id: SubscriptionPlan.GROW,
        name: 'Grow',
        price: 19,
        websites: 2,
        dripsPerDay: 10,
        splashesPerMonth: 3
      },
      {
        id: SubscriptionPlan.PRO,
        name: 'Pro',
        price: 39,
        websites: 5,
        dripsPerDay: 15,
        splashesPerMonth: 7
      }
    ];

    return res.status(200).json({ plans });
  } catch (error) {
    console.error('Error getting subscription plans:', error);
    return res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

/**
 * Get user's current subscription details
 */
router.get('/subscription', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.user;
    
    // Check if user has an active subscription
    if (!user.subscriptionId) {
      return res.status(200).json({ 
        subscription: { 
          isActive: false, 
          plan: null 
        } 
      });
    }

    try {
      // Get subscription details from Lemon Squeezy
      const subscriptionDetails = await lemonSqueezyService.getSubscriptionDetails(user.subscriptionId);
      
      // Determine subscription plan from variant ID
      const planVariantIds = lemonSqueezyService.getPlanVariantIds();
      const planEntry = Object.entries(planVariantIds).find(([_, variantId]) => 
        variantId === user.planVariantId
      );
      const planName = planEntry ? planEntry[0] : 'Unknown';
      
      // Format subscription data
      const subscription = {
        isActive: await subscriptionService.hasActiveSubscription(user.id),
        plan: planName,
        status: subscriptionDetails.status,
        renewsAt: subscriptionDetails.renewsAt,
        urls: subscriptionDetails.urls
      };
      
      return res.status(200).json({ subscription });
    } catch (error) {
      console.error('Error getting subscription details:', error);
      
      // Return basic information if we can't get details from Lemon Squeezy
      return res.status(200).json({ 
        subscription: { 
          isActive: await subscriptionService.hasActiveSubscription(user.id),
          plan: user.subscription || 'Unknown',
          status: user.subscriptionStatus || 'Unknown'
        } 
      });
    }
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return res.status(500).json({ error: 'Failed to get subscription details' });
  }
});

/**
 * Create a checkout for subscription plan
 */
router.post('/checkout/subscription', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId } = req.body;
    
    if (!planId || !Object.values(SubscriptionPlan).includes(planId as SubscriptionPlan)) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    const user = req.user;
    
    // Create checkout URL
    const checkoutUrl = await lemonSqueezyService.createCheckoutUrl(
      planId as SubscriptionPlan,
      {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        userId: user.id.toString()
      }
    );
    
    return res.status(200).json({ checkoutUrl });
  } catch (error) {
    console.error('Error creating subscription checkout:', error);
    return res.status(500).json({ error: 'Failed to create checkout' });
  }
});

/**
 * Create a checkout for splash package
 */
router.post('/checkout/splash', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { packageId } = req.body;
    
    if (!packageId || !Object.values(SplashPackage).includes(packageId as SplashPackage)) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    const user = req.user;
    
    // Create checkout URL
    const checkoutUrl = await lemonSqueezyService.createSplashCheckoutUrl(
      packageId as SplashPackage,
      {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        userId: user.id.toString()
      }
    );
    
    return res.status(200).json({ checkoutUrl });
  } catch (error) {
    console.error('Error creating splash checkout:', error);
    return res.status(500).json({ error: 'Failed to create checkout' });
  }
});

/**
 * Get user stats including remaining splashes
 */
router.get('/user-stats', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.user;
    const hasActiveSubscription = await subscriptionService.hasActiveSubscription(user.id);
    
    // Get plan details to determine max websites and splashes
    let maxWebsites = 1;
    let maxSplashesPerMonth = 0;
    
    if (hasActiveSubscription && user.subscription) {
      switch(user.subscription.toLowerCase()) {
        case 'starter':
          maxWebsites = 1;
          maxSplashesPerMonth = 1;
          break;
        case 'grow':
          maxWebsites = 2;
          maxSplashesPerMonth = 3;
          break;
        case 'pro':
          maxWebsites = 5;
          maxSplashesPerMonth = 7;
          break;
        default:
          maxWebsites = 1;
          maxSplashesPerMonth = 0;
      }
    }
    
    // Calculate remaining splashes
    const splashesUsed = user.splashesUsed || 0;
    const splashesAdded = user.splashesAdded || 0;
    const remainingSplashes = Math.max(0, (maxSplashesPerMonth + splashesAdded - splashesUsed));
    
    // Get user websites
    const websites = await storage.getUserWebsites(user.id);
    
    return res.status(200).json({
      remainingSplashes,
      maxSplashesPerMonth,
      hasActiveSubscription,
      maxWebsites,
      websites
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    return res.status(500).json({ error: 'Failed to get user stats' });
  }
});

/**
 * Use a splash credit
 */
router.post('/splashes/use', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = req.user;
    
    // Check if user has enough splash credits
    const hasActiveSubscription = await subscriptionService.hasActiveSubscription(user.id);
    
    if (!hasActiveSubscription) {
      return res.status(403).json({ error: 'Active subscription required' });
    }
    
    // Use splash credit
    const success = await subscriptionService.useSplashCredits(user.id);
    
    if (!success) {
      return res.status(400).json({ error: 'No splash credits available' });
    }
    
    // Get premium opportunity
    const opportunity = await storage.getRandomPremiumOpportunity(user.id);
    
    if (!opportunity) {
      // Refund splash credit if no opportunities found
      await storage.updateUserSplashCredits(user.id, -1);
      return res.status(404).json({ error: 'No premium opportunities available' });
    }
    
    // Add opportunity to user's drips
    await storage.addOpportunityToDrips(user.id, opportunity.id, true);
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error using splash credit:', error);
    return res.status(500).json({ error: 'Failed to use splash credit' });
  }
});

export default router;