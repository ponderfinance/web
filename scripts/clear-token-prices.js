const Redis = require('ioredis');
require('dotenv').config();

async function clearTokenPrices() {
  console.log('Starting to clear token price keys from Redis...');
  
  // Connect to Redis using the URL from .env
  const redis = new Redis(process.env.REDIS_URL);
  
  try {
    // Get all token price keys
    const priceKeys = await redis.keys('token:*:priceUSD');
    
    if (priceKeys.length > 0) {
      console.log(`Found ${priceKeys.length} token price keys to clear:`);
      
      // Show current values before clearing
      for (const key of priceKeys) {
        const value = await redis.get(key);
        console.log(`${key} = ${value}`);
      }
      
      // Delete all token price keys
      const deleted = await redis.del(...priceKeys);
      console.log(`Cleared ${deleted} token price keys from Redis`);
    } else {
      console.log('No token price keys found in Redis');
    }
    
    // Clear pair reserve USD keys as well (they're derived from token prices)
    const reserveKeys = await redis.keys('pair:*:reserveUSD');
    
    if (reserveKeys.length > 0) {
      console.log(`\nFound ${reserveKeys.length} pair reserve USD keys to clear:`);
      
      // Show current values before clearing
      for (const key of reserveKeys) {
        const value = await redis.get(key);
        console.log(`${key} = ${value}`);
      }
      
      // Delete all reserve USD keys
      const deleted = await redis.del(...reserveKeys);
      console.log(`Cleared ${deleted} pair reserve USD keys from Redis`);
    } else {
      console.log('No pair reserve USD keys found in Redis');
    }
    
    // Clear any token list cache entries
    const tokenListKeys = await redis.keys('tokens:*');
    
    if (tokenListKeys.length > 0) {
      console.log(`\nFound ${tokenListKeys.length} token list keys to clear:`);
      tokenListKeys.forEach(key => console.log(`- ${key}`));
      
      const deleted = await redis.del(...tokenListKeys);
      console.log(`Cleared ${deleted} token list keys from Redis`);
    } else {
      console.log('No token list keys found in Redis');
    }
    
    console.log('\nToken price cache clearing completed successfully');
    
  } catch (error) {
    console.error('Error clearing token prices from Redis:', error);
  } finally {
    // Close the Redis connection
    redis.quit();
  }
}

// Run the script
clearTokenPrices()
  .then(() => console.log('All cache clearing operations completed'))
  .catch(console.error); 