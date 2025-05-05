/**
 * Cache TTL Validation Script
 * 
 * This script tests the alignment between frontend cache TTL and indexer update frequency.
 * Run it with: npx ts-node -r tsconfig-paths/register src/scripts/validateCacheTtl.ts
 */

import { getRedisClient } from '@/src/lib/redis/client';
import prisma from '@/src/lib/db/prisma';
import TokenPriceService from '@/src/lib/services/tokenPriceService';

async function validateCacheTTL() {
  console.log('Starting cache TTL validation...');
  
  try {
    // Step 1: Get a token to test with
    console.log('Finding a token to test...');
    const token = await prisma.token.findFirst({
      where: {
        priceUSD: { not: null }
      },
      select: {
        id: true,
        symbol: true,
        priceUSD: true
      }
    });
    
    if (!token) {
      console.error('No token found with price data. Please ensure the indexer has run.');
      return;
    }
    
    console.log(`Using token ${token.symbol} (${token.id}) with price $${token.priceUSD}`);
    
    // Step 2: Clear any existing cache for this token
    const redis = getRedisClient();
    await redis.del(`token:${token.id}:priceUSD`);
    console.log('Cleared existing cache entry');
    
    // Step 3: Request the price which should cache it
    console.log('Fetching price (should cache it)...');
    const price = await TokenPriceService.getTokenPriceUSD(token.id);
    console.log(`Price fetched: $${price}`);
    
    // Step 4: Check that it was cached
    const ttl = await redis.ttl(`token:${token.id}:priceUSD`);
    console.log(`Cache TTL: ${ttl} seconds`);
    
    // Step 5: Verify TTL is around 5 minutes (300 seconds)
    if (ttl > 290 && ttl <= 300) {
      console.log('✅ Cache TTL is correctly set to ~5 minutes');
    } else {
      console.warn(`⚠️ Cache TTL is not aligned with the expected 5 minutes. Found: ${ttl} seconds`);
    }
    
    // Step 6: Get the cached value
    const cachedPrice = await redis.get(`token:${token.id}:priceUSD`);
    console.log(`Cached price value: ${cachedPrice}`);
    
    if (cachedPrice) {
      console.log('✅ Price was successfully cached');
    } else {
      console.warn('⚠️ Price was not cached');
    }
    
    // Clean up - close Redis connection
    redis.quit();
    await prisma.$disconnect();
    
    console.log('Cache TTL validation completed.');
  } catch (error) {
    console.error('Error during validation:', error);
  }
}

// Run the validation
validateCacheTTL()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  }); 