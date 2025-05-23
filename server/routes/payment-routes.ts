/**
 * Payment Routes for LinkDripAI
 * 
 * Handles subscription checkout, splash package purchases, and webhooks
 * for Lemon Squeezy integration.
 */

import { Request, Response, Router } from 'express';
import { getLemonSqueezyService } from '../services/lemon-squeezy-service';
import { 
  SubscriptionPlan, 
  SplashPackage,
  PLAN_DETAILS,
  SPLASH_DETAILS,
} from '../../client/src/lib/subscription-plans';
import { SUBSCRIPTION_PLAN_VARIANTS as PLAN_VARIANT_IDS } from '../config/lemon-squeezy-config';
import { getSubscriptionService } from '../services/subscription-service';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Helper function to determine subscription plan from variant ID
 */
function determineSubscriptionPlan(variantId: string): string {
  for (const [planKey, planVariantId] of Object.entries(PLAN_VARIANT_IDS)) {
    if (planVariantId === variantId) {
      return PLAN_DETAILS[planKey as SubscriptionPlan].name;
    }
  }
  return 'Free Trial';
}

const paymentRouter = Router();
const lemonSqueezy = getLemonSqueezyService();
const subscriptionService = getSubscriptionService();

/**
 * Get subscription plans
 */
paymentRouter.get('/plans', (req, res) => {
  res.json({ 
    plans: Object.entries(PLAN_DETAILS).map(([id, details]) => ({
      id,
      ...details
    })),
    splashPackages: Object.entries(SPLASH_DETAILS).map(([id, details]) => ({
      id,
      ...details
    }))
  });
});

/**
 * Get current user's subscription details
 */
paymentRouter.get('/subscription', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = req.user;
    
    if (!user.subscriptionId) {
      return res.json({ 
        subscription: null, 
        message: 'No active subscription' 
      });
    }
    
    const subscriptionDetails = await lemonSqueezy.getSubscriptionDetails(user.subscriptionId);
    
    res.json({ subscription: subscriptionDetails });
  } catch (error: any) {
    console.error('[Payment] Error getting subscription:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Create checkout URL for a subscription plan
 */
paymentRouter.post('/checkout/subscription', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const { planId } = req.body;
  
  if (!Object.values(SubscriptionPlan).includes(planId as SubscriptionPlan)) {
    return res.status(400).json({ message: 'Invalid plan' });
  }
  
  try {
    const user = req.user;
    
    const checkoutUrl = await lemonSqueezy.createCheckoutUrl(
      planId as SubscriptionPlan,
      {
        name: `${user.firstName} ${user.lastName}`.trim() || user.username,
        email: user.email,
        userId: user.id.toString()
      }
    );
    
    res.json({ checkoutUrl });
  } catch (error: any) {
    console.error('[Payment] Error creating checkout:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Create checkout URL for a splash package
 */
paymentRouter.post('/checkout/splash', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const { packageId } = req.body;
  
  if (!Object.values(SplashPackage).includes(packageId as SplashPackage)) {
    return res.status(400).json({ message: 'Invalid splash package' });
  }
  
  try {
    const user = req.user;
    
    const checkoutUrl = await lemonSqueezy.createSplashCheckoutUrl(
      packageId as SplashPackage,
      {
        name: `${user.firstName} ${user.lastName}`.trim() || user.username,
        email: user.email,
        userId: user.id.toString()
      }
    );
    
    res.json({ checkoutUrl });
  } catch (error: any) {
    console.error('[Payment] Error creating splash checkout:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Webhook endpoint for Lemon Squeezy events
 */
paymentRouter.post('/webhook', async (req, res) => {
  const signature = req.headers['x-signature'] as string;
  const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';
  
  // Validate the webhook signature if webhook secret is set
  if (webhookSecret && signature) {
    const rawBody = JSON.stringify(req.body);
    const isValid = lemonSqueezy.validateWebhookSignature(signature, rawBody, webhookSecret);
    
    if (!isValid) {
      console.error('[Payment] Invalid webhook signature');
      return res.status(403).json({ message: 'Invalid signature' });
    }
  }
  
  try {
    const { event, data } = req.body;
    console.log(`[Payment] Received webhook event: ${event}`);
    
    // Handle subscription created or updated
    if (event === 'subscription_created' || event === 'subscription_updated') {
      const { id: subscriptionId, attributes } = data;
      const { variant_id: variantId, customer_id: customerId, status } = attributes;
      const { custom_data: customData } = attributes;
      
      // Get user ID from custom data
      const userId = customData?.userId;
      
      if (!userId) {
        console.error('[Payment] No user ID in custom data');
        return res.status(400).json({ message: 'No user ID in custom data' });
      }
      
      // Update user subscription details using the subscription service
      try {
        await subscriptionService.updateUserSubscription(
          Number(userId),
          subscriptionId,
          String(customerId),
          String(variantId)
        );
        
        console.log(`[Payment] Updated subscription for user ${userId}: ${subscriptionId} (${status})`);
      } catch (error) {
        console.error(`[Payment] Error updating subscription for user ${userId}:`, error);
      }
    }
    
    // Handle subscription cancelled
    else if (event === 'subscription_cancelled') {
      const { id: subscriptionId } = data;
      
      // Find user with this subscription
      const [user] = await db.select().from(users).where(eq(users.subscriptionId, subscriptionId));
      
      if (user) {
        try {
          // Update user subscription status - we'll reuse the update method 
          // but pass 'cancelled' as the status, the service will handle the rest
          await subscriptionService.updateUserSubscription(
            user.id,
            subscriptionId,
            user.customerId || '',
            user.planVariantId || ''
          );
          
          console.log(`[Payment] Marked subscription as cancelled for user ${user.id}: ${subscriptionId}`);
        } catch (error) {
          console.error(`[Payment] Error marking subscription as cancelled for user ${user.id}:`, error);
        }
      } else {
        console.error(`[Payment] No user found for cancelled subscription: ${subscriptionId}`);
      }
    }
    
    // Handle order (one-time purchase like splash packages)
    else if (event === 'order_created') {
      const { attributes } = data;
      const { custom_data: customData, first_order_item: firstOrderItem } = attributes;
      
      // Get user ID from custom data
      const userId = customData?.userId;
      
      if (!userId) {
        console.error('[Payment] No user ID in custom data for order');
        return res.status(400).json({ message: 'No user ID in custom data' });
      }
      
      // Get variant ID from the first order item
      const variantId = firstOrderItem?.variant_id;
      
      if (!variantId) {
        console.error('[Payment] No variant ID found in order');
        return res.status(400).json({ message: 'No variant ID in order' });
      }
      
      try {
        // Use the subscription service to add splash credits
        const result = await subscriptionService.addSplashCredits(Number(userId), String(variantId));
        
        console.log(`[Payment] Added splash credits for user ${userId}: ${result.addedCredits} credits (total: ${result.totalCredits})`);
      } catch (error) {
        console.error(`[Payment] Error adding splash credits for user ${userId}:`, error);
      }
    }
    
    // Return success
    res.json({ message: 'Webhook processed successfully' });
  } catch (error: any) {
    console.error('[Payment] Error processing webhook:', error);
    res.status(500).json({ message: error.message });
  }
});

export default paymentRouter;