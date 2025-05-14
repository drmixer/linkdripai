/**
 * LemonSqueezy Test Script
 * 
 * This script tests the connection to LemonSqueezy and lists products and variants
 * to help with configuration of variant IDs for LinkDripAI.
 */

import { getLemonSqueezyService } from '../server/services/lemon-squeezy-service';

async function testLemonSqueezy() {
  try {
    console.log('Testing LemonSqueezy API Connection...');
    const lemonSqueezy = getLemonSqueezyService();
    
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
    
    console.log('\nCopy the Variant IDs to set up your environment variables:\n');
    console.log('# Example .env additions:');
    console.log('# LEMON_SQUEEZY_STARTER_VARIANT_ID=12345');
    console.log('# LEMON_SQUEEZY_GROW_VARIANT_ID=12346');
    console.log('# LEMON_SQUEEZY_PRO_VARIANT_ID=12347');
    console.log('# LEMON_SQUEEZY_SINGLE_SPLASH_VARIANT_ID=12348');
    console.log('# LEMON_SQUEEZY_TRIPLE_SPLASH_VARIANT_ID=12349');
    console.log('# LEMON_SQUEEZY_SEVEN_SPLASH_VARIANT_ID=12350');
    
  } catch (error) {
    console.error('Error testing LemonSqueezy:', error);
  }
}

testLemonSqueezy().catch(console.error);