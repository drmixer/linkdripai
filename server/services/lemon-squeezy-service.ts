/**
 * Lemon Squeezy API Service
 * 
 * Handles integration with Lemon Squeezy for payment processing and subscription management
 * for the LinkDripAI platform.
 */
import axios from 'axios';
import crypto from 'crypto';
import { SUBSCRIPTION_PLAN_VARIANTS, SPLASH_PACKAGE_VARIANTS } from '../config/lemon-squeezy-config';
import { SubscriptionPlan, SplashPackage } from '../../client/src/lib/subscription-plans';

export class LemonSqueezyService {
  private apiKey: string;
  private baseUrl: string = 'https://api.lemonsqueezy.com/v1';
  private storeId: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LEMON_SQUEEZY_API_KEY || '';
    this.storeId = process.env.LEMON_SQUEEZY_STORE_ID || '';
    
    if (!this.apiKey) {
      console.warn('[LemonSqueezy] Warning: No API key provided');
    }
    
    if (!this.storeId) {
      console.warn('[LemonSqueezy] Warning: No store ID provided');
    }
  }

  /**
   * Make an authenticated request to the Lemon Squeezy API
   */
  private async makeRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    data?: any
  ) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data
      });
      
      return response.data;
    } catch (error) {
      console.error('[LemonSqueezy] API Error:', error);
      throw error;
    }
  }

  /**
   * Get store details
   */
  async getStores() {
    return this.makeRequest('GET', '/stores');
  }

  /**
   * Get products in the store
   */
  async getProducts() {
    return this.makeRequest('GET', '/products');
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    return this.makeRequest('GET', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Check if a subscription is active
   */
  async isSubscriptionActive(subscriptionId: string): Promise<boolean> {
    try {
      const response = await this.getSubscription(subscriptionId);
      const status = response?.data?.attributes?.status;
      return status === 'active';
    } catch (error) {
      console.error('[LemonSqueezy] Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get subscription details including plan information
   */
  async getSubscriptionDetails(subscriptionId: string) {
    try {
      const response = await this.getSubscription(subscriptionId);
      if (!response.data) {
        throw new Error('Invalid subscription response');
      }
      
      const subscription = response.data;
      const {
        status,
        renews_at,
        ends_at,
        product_id,
        variant_id,
        customer_id,
        pause,
      } = subscription.attributes;
      
      // Try to get variant details for the price
      let price = null;
      try {
        const variantResponse = await this.makeRequest('GET', `/variants/${variant_id}`);
        if (variantResponse.data) {
          price = variantResponse.data.attributes.price;
        }
      } catch (err) {
        console.error('[LemonSqueezy] Error getting variant details:', err);
      }
      
      return {
        id: subscription.id,
        status,
        renewsAt: renews_at,
        endsAt: ends_at,
        productId: product_id,
        variantId: variant_id,
        customerId: customer_id,
        isPaused: !!pause,
        amount: price,
      };
    } catch (error) {
      console.error('[LemonSqueezy] Error getting subscription details:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string) {
    return this.makeRequest('DELETE', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Resume a subscription
   */
  async resumeSubscription(subscriptionId: string) {
    return this.makeRequest('PATCH', `/subscriptions/${subscriptionId}/resume`);
  }

  /**
   * Create a checkout URL for a subscription plan
   */
  async createCheckoutUrl(
    plan: SubscriptionPlan,
    customData: {
      name: string;
      email: string;
      userId: string;
    },
    redirectUrl?: string
  ): Promise<string> {
    try {
      // Get the variant ID for the plan
      const variantId = SUBSCRIPTION_PLAN_VARIANTS[plan];
      if (!variantId) {
        throw new Error(`Invalid plan: ${plan}`);
      }
      
      // Create checkout URL
      const response = await this.makeRequest('POST', '/checkouts', {
        data: {
          type: 'checkouts',
          attributes: {
            store_id: this.storeId,
            variant_id: variantId,
            custom_price: 0, // Use the variant's price
            product_options: {
              name: customData.name,
              email: customData.email,
              custom_data: {
                userId: customData.userId
              },
              receipt_link_url: redirectUrl || process.env.LEMON_SQUEEZY_REDIRECT_URL || '',
              receipt_thank_you_note: 'Thank you for subscribing to LinkDripAI!',
              enable_receipt_email: true,
            },
            checkout_options: {
              embed: false,
              media: true,
              button_color: '#4F46E5',
            }
          }
        }
      });
      
      return response.data.attributes.url;
    } catch (error) {
      console.error('[LemonSqueezy] Error creating checkout URL:', error);
      throw error;
    }
  }

  /**
   * Create a checkout URL for a splash package
   */
  async createSplashCheckoutUrl(
    splashPackage: SplashPackage,
    customData: {
      name: string;
      email: string;
      userId: string;
    },
    redirectUrl?: string
  ): Promise<string> {
    try {
      // Get the variant ID for the splash package
      const variantId = SPLASH_PACKAGE_VARIANTS[splashPackage];
      if (!variantId) {
        throw new Error(`Invalid splash package: ${splashPackage}`);
      }
      
      // Create checkout URL
      const response = await this.makeRequest('POST', '/checkouts', {
        data: {
          type: 'checkouts',
          attributes: {
            store_id: this.storeId,
            variant_id: variantId,
            custom_price: 0, // Use the variant's price
            product_options: {
              name: customData.name,
              email: customData.email,
              custom_data: {
                userId: customData.userId
              },
              receipt_link_url: redirectUrl || process.env.LEMON_SQUEEZY_REDIRECT_URL || '',
              receipt_thank_you_note: 'Thank you for purchasing Splash credits!',
              enable_receipt_email: true,
            },
            checkout_options: {
              embed: false,
              media: true,
              button_color: '#4F46E5',
            }
          }
        }
      });
      
      return response.data.attributes.url;
    } catch (error) {
      console.error('[LemonSqueezy] Error creating splash checkout URL:', error);
      throw error;
    }
  }

  /**
   * Validate a webhook signature
   */
  validateWebhookSignature(signature: string, payload: string, secret: string): boolean {
    try {
      // Create HMAC-SHA256 signature
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      // Compare with the provided signature
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(computedSignature)
      );
    } catch (error) {
      console.error('[LemonSqueezy] Error validating webhook signature:', error);
      return false;
    }
  }
  
  /**
   * Get plan variant IDs
   */
  getPlanVariantIds(): Record<string, string> {
    return SUBSCRIPTION_PLAN_VARIANTS;
  }
  
  /**
   * Get splash variant IDs
   */
  getSplashVariantIds(): Record<string, string> {
    return SPLASH_PACKAGE_VARIANTS;
  }
}

// Singleton instance to be used throughout the app
let lemonSqueezyServiceInstance: LemonSqueezyService | null = null;

export function getLemonSqueezyService(): LemonSqueezyService {
  if (!lemonSqueezyServiceInstance) {
    lemonSqueezyServiceInstance = new LemonSqueezyService();
  }
  return lemonSqueezyServiceInstance;
}