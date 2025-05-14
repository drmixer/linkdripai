/**
 * Lemon Squeezy API Service
 * 
 * Handles integration with Lemon Squeezy for payment processing and subscription management
 * for the LinkDripAI platform.
 */

import axios from 'axios';

// Subscription plan IDs - these should match your actual product IDs in Lemon Squeezy
export enum SubscriptionPlan {
  STARTER = 'starter',   // $9/mo - 1 website, 5 drips/day/site, 1 splash/month
  GROW = 'grow',         // $19/mo - 2 websites, 10 drips/day/site, 3 splashes/month
  PRO = 'pro'            // $39/mo - 5 websites, 15 drips/day/site, 7 splashes/month
}

// Splash package options
export enum SplashPackage {
  SINGLE = 'single',     // $7 - 1 splash
  TRIPLE = 'triple',     // $18 - 3 splashes
  SEVEN = 'seven'        // $35 - 7 splashes
}

// Plan details for reference
export const PLAN_DETAILS = {
  [SubscriptionPlan.STARTER]: {
    name: 'Starter',
    price: 9,
    websites: 1,
    dripsPerDay: 5,
    splashesPerMonth: 1,
    description: 'Perfect for individuals getting started with link building',
  },
  [SubscriptionPlan.GROW]: {
    name: 'Grow',
    price: 19,
    websites: 2,
    dripsPerDay: 10,
    splashesPerMonth: 3,
    description: 'Ideal for small businesses looking to scale their outreach',
  },
  [SubscriptionPlan.PRO]: {
    name: 'Pro',
    price: 39,
    websites: 5,
    dripsPerDay: 15,
    splashesPerMonth: 7,
    description: 'For agencies and serious link builders who need maximum results',
  }
};

// Splash package details
export const SPLASH_DETAILS = {
  [SplashPackage.SINGLE]: {
    name: 'Single Splash',
    price: 7,
    quantity: 1,
    description: 'One premium opportunity credit',
  },
  [SplashPackage.TRIPLE]: {
    name: 'Triple Splash',
    price: 18,
    quantity: 3,
    description: 'Three premium opportunity credits (save $3)',
  },
  [SplashPackage.SEVEN]: {
    name: 'Seven Splash',
    price: 35,
    quantity: 7,
    description: 'Seven premium opportunity credits (save $14)',
  }
};

// Map subscription plan IDs to actual Lemon Squeezy variant IDs
// These need to be updated with your actual IDs from Lemon Squeezy
export const PLAN_VARIANT_IDS: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.STARTER]: process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID || '',
  [SubscriptionPlan.GROW]: process.env.LEMON_SQUEEZY_GROW_VARIANT_ID || '',
  [SubscriptionPlan.PRO]: process.env.LEMON_SQUEEZY_PRO_VARIANT_ID || ''
};

// Map splash package IDs to actual Lemon Squeezy variant IDs
export const SPLASH_VARIANT_IDS: Record<SplashPackage, string> = {
  [SplashPackage.SINGLE]: process.env.LEMON_SQUEEZY_SINGLE_SPLASH_VARIANT_ID || '',
  [SplashPackage.TRIPLE]: process.env.LEMON_SQUEEZY_TRIPLE_SPLASH_VARIANT_ID || '',
  [SplashPackage.SEVEN]: process.env.LEMON_SQUEEZY_SEVEN_SPLASH_VARIANT_ID || ''
};

export class LemonSqueezyService {
  private apiKey: string;
  private baseUrl: string = 'https://api.lemonsqueezy.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LEMON_SQUEEZY_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Lemon Squeezy API key is required');
    }
  }
  
  /**
   * Make an authenticated request to the Lemon Squeezy API
   */
  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE', 
    endpoint: string, 
    data?: any
  ) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        data
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`[LemonSqueezy] API error:`, error.response?.data || error.message);
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
      const status = response.data.attributes.status;
      
      // Subscription is active if status is active
      return status === 'active';
    } catch (error) {
      console.error(`[LemonSqueezy] Error checking subscription ${subscriptionId}:`, error);
      return false;
    }
  }
  
  /**
   * Get subscription details including plan information
   */
  async getSubscriptionDetails(subscriptionId: string) {
    try {
      const response = await this.getSubscription(subscriptionId);
      
      // Extract key details
      const { 
        status, 
        urls,
        renews_at, 
        ends_at,
        variant_id,
        customer_id
      } = response.data.attributes;
      
      // Determine the plan based on variant ID
      let plan: SubscriptionPlan | null = null;
      
      for (const [planKey, variantId] of Object.entries(PLAN_VARIANT_IDS)) {
        if (variantId === variant_id.toString()) {
          plan = planKey as SubscriptionPlan;
          break;
        }
      }
      
      return {
        subscriptionId,
        status,
        isActive: status === 'active',
        renewsAt: renews_at,
        endsAt: ends_at,
        customerId: customer_id,
        variantId: variant_id,
        plan,
        planDetails: plan ? PLAN_DETAILS[plan] : null,
        urls
      };
    } catch (error) {
      console.error(`[LemonSqueezy] Error getting subscription details ${subscriptionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a checkout URL for a subscription plan
   */
  async createCheckoutUrl(
    plan: SubscriptionPlan,
    customerEmail?: string,
    customerName?: string,
    customData?: any
  ) {
    const variantId = PLAN_VARIANT_IDS[plan];
    
    if (!variantId) {
      throw new Error(`Invalid plan variant ID for plan: ${plan}`);
    }
    
    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: customerEmail,
            name: customerName,
            custom_data: customData || {},
          },
          product_options: {
            redirect_url: `${process.env.APP_URL || 'https://linkdripai.com'}/dashboard`,
            receipt_button_text: 'Return to LinkDripAI',
            receipt_link_url: `${process.env.APP_URL || 'https://linkdripai.com'}/dashboard`,
            receipt_thank_you_note: 'Thank you for subscribing to LinkDripAI!'
          },
          variant_id: parseInt(variantId, 10)
        }
      }
    };
    
    try {
      const response = await this.makeRequest('POST', '/checkouts', checkoutData);
      return response.data.attributes.url;
    } catch (error) {
      console.error(`[LemonSqueezy] Error creating checkout for plan ${plan}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a checkout URL for a splash package
   */
  async createSplashCheckoutUrl(
    splashPackage: SplashPackage,
    customerEmail?: string,
    customerName?: string,
    customData?: any
  ) {
    const variantId = SPLASH_VARIANT_IDS[splashPackage];
    
    if (!variantId) {
      throw new Error(`Invalid splash variant ID for package: ${splashPackage}`);
    }
    
    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: customerEmail,
            name: customerName,
            custom_data: customData || {},
          },
          product_options: {
            redirect_url: `${process.env.APP_URL || 'https://linkdripai.com'}/dashboard`,
            receipt_button_text: 'Return to LinkDripAI',
            receipt_link_url: `${process.env.APP_URL || 'https://linkdripai.com'}/dashboard`,
            receipt_thank_you_note: 'Thank you for purchasing premium opportunities!'
          },
          variant_id: parseInt(variantId, 10)
        }
      }
    };
    
    try {
      const response = await this.makeRequest('POST', '/checkouts', checkoutData);
      return response.data.attributes.url;
    } catch (error) {
      console.error(`[LemonSqueezy] Error creating checkout for splash package ${splashPackage}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate a webhook signature
   */
  validateWebhookSignature(signature: string, payload: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const calculatedSignature = hmac.update(payload).digest('hex');
      
      return signature === calculatedSignature;
    } catch (error) {
      console.error('[LemonSqueezy] Webhook signature validation error:', error);
      return false;
    }
  }
}

// Create a singleton instance
let lemonSqueezyService: LemonSqueezyService | null = null;

export function getLemonSqueezyService(): LemonSqueezyService {
  if (!lemonSqueezyService) {
    lemonSqueezyService = new LemonSqueezyService();
  }
  
  return lemonSqueezyService;
}