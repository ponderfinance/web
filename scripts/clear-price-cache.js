const Redis = require('ioredis');
require('dotenv').config();

async function clearTokenPriceCache() {
  console.log('Starting to clear token price cache from Redis...');
  
  // Connect to Redis using the URL from .env
  const redis = new Redis(process.env.REDIS_URL);
  
  try {
    // First try to find token price related keys
    console.log('Searching for token price related keys...');
    const keys = await redis.keys('*token*price*');
    
    if (keys.length > 0) {
      console.log(`Found ${keys.length} token price related keys:`);
      keys.forEach(key => console.log(`- ${key}`));
      
      // Delete all found keys
      const deletedCount = await redis.del(...keys);
      console.log(`Deleted ${deletedCount} keys from Redis.`);
    } else {
      console.log('No token price keys found with pattern "*token*price*"');
      
      // Try some other common cache patterns
      console.log('Trying alternative patterns...');
      
      // Try token:*:price pattern
      const tokenPriceKeys = await redis.keys('token:*:price');
      if (tokenPriceKeys.length > 0) {
        console.log(`Found ${tokenPriceKeys.length} keys with pattern "token:*:price"`);
        const deletedCount = await redis.del(...tokenPriceKeys);
        console.log(`Deleted ${deletedCount} keys from Redis.`);
      }
      
      // Try price:* pattern
      const priceKeys = await redis.keys('price:*');
      if (priceKeys.length > 0) {
        console.log(`Found ${priceKeys.length} keys with pattern "price:*"`);
        const deletedCount = await redis.del(...priceKeys);
        console.log(`Deleted ${deletedCount} keys from Redis.`);
      }
      
      // Try *:price pattern
      const endingPriceKeys = await redis.keys('*:price');
      if (endingPriceKeys.length > 0) {
        console.log(`Found ${endingPriceKeys.length} keys with pattern "*:price"`);
        const deletedCount = await redis.del(...endingPriceKeys);
        console.log(`Deleted ${deletedCount} keys from Redis.`);
      }
    }
    
    // Check specifically for USDT, USDC, and KKUB related keys
    const specificTokens = ['USDT', 'USDC', 'KKUB'];
    for (const token of specificTokens) {
      const tokenKeys = await redis.keys(`*${token}*`);
      if (tokenKeys.length > 0) {
        console.log(`Found ${tokenKeys.length} keys related to ${token}:`);
        tokenKeys.forEach(key => console.log(`- ${key}`));
        
        const deletedCount = await redis.del(...tokenKeys);
        console.log(`Deleted ${deletedCount} ${token} related keys from Redis.`);
      } else {
        console.log(`No keys found related to ${token}.`);
      }
    }
    
    console.log('Checking for any remaining cache keys...');
    const allKeys = await redis.keys('*cache*');
    if (allKeys.length > 0) {
      console.log(`Found ${allKeys.length} general cache keys.`);
      
      // Prompt before deleting all cache keys
      console.log('These keys might be used for other purposes. Review them before deciding to delete.');
      allKeys.forEach(key => console.log(`- ${key}`));
    } else {
      console.log('No general cache keys found.');
    }
    
    console.log('Redis cache clearing complete.');
    
  } catch (error) {
    console.error('Error clearing Redis cache:', error);
  } finally {
    // Close the Redis connection
    redis.quit();
  }
}

// Run the script
clearTokenPriceCache()
  .then(() => console.log('Cache clearing completed'))
  .catch(console.error); 