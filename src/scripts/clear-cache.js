require('dotenv').config();
const Redis = require('ioredis');

async function clearCache() {
  console.log('Connecting to Redis...');
  
  // Create Redis client
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  try {
    console.log('Clearing token price cache...');
    
    // Clear all token price keys
    const tokenPriceKeys = await redis.keys('token:*:priceUSD');
    if (tokenPriceKeys.length > 0) {
      await redis.del(...tokenPriceKeys);
      console.log(`✅ Deleted ${tokenPriceKeys.length} token price cache entries`);
    } else {
      console.log('No token price cache entries found');
    }
    
    // Clear pair reserve cache
    const pairReserveKeys = await redis.keys('pair:*:reserveUSD');
    if (pairReserveKeys.length > 0) {
      await redis.del(...pairReserveKeys);
      console.log(`✅ Deleted ${pairReserveKeys.length} pair reserve cache entries`);
    } else {
      console.log('No pair reserve cache entries found');
    }
    
    // Clear any other cache that might contain price data
    const otherPriceKeys = await redis.keys('*price*');
    if (otherPriceKeys.length > 0) {
      await redis.del(...otherPriceKeys);
      console.log(`✅ Deleted ${otherPriceKeys.length} other price-related cache entries`);
    } else {
      console.log('No other price-related cache entries found');
    }
    
    console.log('🎉 Cache clearing completed successfully');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  } finally {
    // Close Redis connection
    redis.disconnect();
  }
}

// Run the script
clearCache()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to clear cache:', error);
    process.exit(1);
  }); 