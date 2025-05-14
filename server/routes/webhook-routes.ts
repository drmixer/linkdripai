/**
 * LemonSqueezy Webhook Routes
 * 
 * This file implements the webhook endpoints to handle payment and subscription events
 * from LemonSqueezy, including subscription creation, updates, cancellations, and
 * one-time purchases of splash packages.
 */

import { Router } from 'express';
import { getLemonSqueezyService } from '../services/lemon-squeezy-service';
import { storage } from '../storage';
import { 
  SPLASH_PACKAGE_MAPPING, 
  SUBSCRIPTION_PLAN_MAPPING
} from '../config/lemon-squeezy-config';

const router = Router();
const lemonSqueezy = getLemonSqueezyService();

// Verify webhook signature
const verifySignature = (req: any, res: any, next: any) => {
  const signature = req.headers['x-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  
  if (!secret) {
    console.error('[Webhook] No webhook secret configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }
  
  if (!signature) {
    console.error('[Webhook] No signature in request');
    return res.status(400).json({ error: 'No signature provided' });
  }
  
  const isValid = lemonSqueezy.validateWebhookSignature(signature, payload, secret);
  
  if (!isValid) {
    console.error('[Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};

// Main webhook endpoint that processes all LemonSqueezy events
router.post('/webhook', verifySignature, async (req, res) => {
  try {
    const { meta, data } = req.body;
    const event = meta.event_name;
    
    console.log(`[Webhook] Received event: ${event}`);
    
    // Handle different event types
    switch (event) {
      case 'subscription_created':
        await handleSubscriptionCreated(data);
        break;
        
      case 'subscription_updated':
        await handleSubscriptionUpdated(data);
        break;
        
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(data);
        break;
        
      case 'order_created':
        await handleOrderCreated(data);
        break;
        
      default:
        console.log(`[Webhook] Unhandled event type: ${event}`);
    }
    
    // Respond with success
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

/**
 * Handle subscription_created event
 * This happens when a user subscribes to a plan for the first time
 */
async function handleSubscriptionCreated(data: any) {
  try {
    const {
      id: subscriptionId,
      attributes: {
        customer_id: customerId,
        variant_id: variantId,
        user_email: email,
        user_name: name,
        status,
        ends_at: endsAt,
        renews_at: renewsAt,
        order_id: orderId,
        product_id: productId,
        first_subscription_item: firstItem,
        custom_data: customData
      }
    } = data;

    const userId = customData?.userId;
    
    if (!userId) {
      console.error('[Webhook] No user ID in custom data for subscription creation');
      return;
    }
    
    // Determine plan from variant ID
    let planName = 'Unknown';
    for (const [variant, plan] of Object.entries(SUBSCRIPTION_PLAN_MAPPING)) {
      if (variant === variantId.toString()) {
        planName = plan;
        break;
      }
    }
    
    console.log(`[Webhook] Creating subscription for user ${userId}: ${planName} plan`);
    
    // Update user with subscription info
    await storage.updateUserSubscription(parseInt(userId, 10), {
      subscriptionId: subscriptionId.toString(),
      planVariantId: variantId.toString(),
      subscription: planName,
      subscriptionStatus: status,
      subscriptionRenewsAt: renewsAt ? new Date(renewsAt) : null,
      subscriptionEndsAt: endsAt ? new Date(endsAt) : null
    });
    
    console.log(`[Webhook] Subscription ${subscriptionId} created for user ${userId}`);
  } catch (error) {
    console.error('[Webhook] Error handling subscription creation:', error);
    throw error;
  }
}

/**
 * Handle subscription_updated event
 * This happens when a subscription is updated (upgraded, downgraded, payment method changed, etc.)
 */
async function handleSubscriptionUpdated(data: any) {
  try {
    const {
      id: subscriptionId,
      attributes: {
        variant_id: variantId,
        status,
        ends_at: endsAt,
        renews_at: renewsAt,
        pause: pauseInfo
      }
    } = data;
    
    // Determine plan from variant ID
    let planName = 'Unknown';
    for (const [variant, plan] of Object.entries(SUBSCRIPTION_PLAN_MAPPING)) {
      if (variant === variantId.toString()) {
        planName = plan;
        break;
      }
    }
    
    // Find user with this subscription ID
    const user = await storage.getUserBySubscriptionId(subscriptionId.toString());
    
    if (!user) {
      console.error(`[Webhook] No user found with subscription ID ${subscriptionId}`);
      return;
    }
    
    console.log(`[Webhook] Updating subscription for user ${user.id}: ${planName} plan, status: ${status}`);
    
    // Update user with subscription info
    await storage.updateUserSubscription(user.id, {
      planVariantId: variantId.toString(),
      subscription: planName,
      subscriptionStatus: status,
      subscriptionRenewsAt: renewsAt ? new Date(renewsAt) : null,
      subscriptionEndsAt: endsAt ? new Date(endsAt) : null
    });
    
    console.log(`[Webhook] Subscription ${subscriptionId} updated for user ${user.id}`);
  } catch (error) {
    console.error('[Webhook] Error handling subscription update:', error);
    throw error;
  }
}

/**
 * Handle subscription_cancelled event
 * This happens when a subscription is cancelled
 */
async function handleSubscriptionCancelled(data: any) {
  try {
    const {
      id: subscriptionId,
      attributes: {
        status,
        ends_at: endsAt
      }
    } = data;
    
    // Find user with this subscription ID
    const user = await storage.getUserBySubscriptionId(subscriptionId.toString());
    
    if (!user) {
      console.error(`[Webhook] No user found with subscription ID ${subscriptionId}`);
      return;
    }
    
    console.log(`[Webhook] Cancelling subscription for user ${user.id}, effective: ${endsAt}`);
    
    // Update user with subscription info
    await storage.updateUserSubscription(user.id, {
      subscriptionStatus: status,
      subscriptionEndsAt: endsAt ? new Date(endsAt) : null
    });
    
    console.log(`[Webhook] Subscription ${subscriptionId} cancelled for user ${user.id}`);
  } catch (error) {
    console.error('[Webhook] Error handling subscription cancellation:', error);
    throw error;
  }
}

/**
 * Handle order_created event
 * This happens for one-time purchases like splash packages
 */
async function handleOrderCreated(data: any) {
  try {
    const {
      id: orderId,
      attributes: {
        identifier,
        user_email: email,
        first_order_item: firstItem,
        custom_data: customData
      }
    } = data;
    
    // Check if this is a splash package purchase
    const variantId = firstItem?.variant_id;
    const userId = customData?.userId;
    
    if (!variantId || !userId) {
      console.log(`[Webhook] Order ${orderId} is not a splash package or missing user ID`);
      return;
    }
    
    // Determine if this is a splash package and how many splashes
    let splashCount = 0;
    for (const [variant, count] of Object.entries(SPLASH_PACKAGE_MAPPING)) {
      if (variant === variantId.toString()) {
        splashCount = count;
        break;
      }
    }
    
    if (splashCount === 0) {
      console.log(`[Webhook] Order ${orderId} doesn't match a known splash package`);
      return;
    }
    
    console.log(`[Webhook] Processing splash package order ${orderId} for user ${userId}: ${splashCount} splashes`);
    
    // Update user's splash credits
    await storage.updateUserSplashes(parseInt(userId, 10), splashCount);
    
    console.log(`[Webhook] Added ${splashCount} splashes for user ${userId} from order ${orderId}`);
  } catch (error) {
    console.error('[Webhook] Error handling order creation:', error);
    throw error;
  }
}

export default router;