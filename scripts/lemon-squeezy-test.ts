/**
 * LemonSqueezy Test Script
 * 
 * This script tests the connection to LemonSqueezy and lists products and variants
 * to help with configuration of variant IDs for LinkDripAI.
 */

import axios from 'axios';

// Simple API client for direct testing
class LemonSqueezyTestClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.lemonsqueezy.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    if (!this.apiKey) {
      throw new Error('Lemon Squeezy API key is required');
    }
  }

  /**
   * Make a request to the LemonSqueezy API
   */
  async makeRequest(
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
}

async function testLemonSqueezy() {
  try {
    console.log('Testing LemonSqueezy API Connection...');
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY || '';
    
    if (!apiKey) {
      throw new Error('LEMON_SQUEEZY_API_KEY environment variable is not set');
    }
    
    const lemonSqueezy = new LemonSqueezyTestClient(apiKey);
    
    // Get stores
    console.log('\n--- Stores ---');
    const stores = await lemonSqueezy.makeRequest('GET', '/stores');
    
    if (stores?.data) {
      console.log(`Found ${stores.data.length} stores:`);
      for (const store of stores.data) {
        console.log(`- ${store.attributes.name} (ID: ${store.id})`);
      }
    } else {
      console.log('No stores found.');
    }
    
    // Get products
    console.log('\n--- Products ---');
    const products = await lemonSqueezy.makeRequest('GET', '/products');
    
    if (products?.data) {
      console.log(`Found ${products.data.length} products:`);
      for (const product of products.data) {
        console.log(`\n- ${product.attributes.name} (ID: ${product.id})`);
        console.log(`  Price: $${product.attributes.price_formatted}`);
        console.log(`  Status: ${product.attributes.status}`);
        
        // Get variants for this product
        const variants = await lemonSqueezy.makeRequest('GET', `/variants?filter[product_id]=${product.id}`);
        
        if (variants?.data) {
          console.log(`  Variants (${variants.data.length}):`);
          for (const variant of variants.data) {
            console.log(`  - ${variant.attributes.name} (Variant ID: ${variant.id})`);
            console.log(`    Price: $${variant.attributes.price_formatted}`);
          }
        }
      }
    } else {
      console.log('No products found.');
    }
    
    console.log('\nVariant IDs for environment variables:');
    console.log('\n# Subscription Plans');
    console.log('LEMON_SQUEEZY_STARTER_VARIANT_ID=802543');
    console.log('LEMON_SQUEEZY_GROW_VARIANT_ID=802555');
    console.log('LEMON_SQUEEZY_PRO_VARIANT_ID=802556');
    console.log('\n# Splash Packages');
    console.log('LEMON_SQUEEZY_SINGLE_SPLASH_VARIANT_ID=802558');
    console.log('LEMON_SQUEEZY_TRIPLE_SPLASH_VARIANT_ID=802561');
    console.log('LEMON_SQUEEZY_SEVEN_SPLASH_VARIANT_ID=802564');
    
  } catch (error) {
    console.error('Error testing LemonSqueezy:', error);
  }
}

testLemonSqueezy().catch(console.error);