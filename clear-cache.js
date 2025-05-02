// Script to clear Redis cache
require('dotenv').config();
const Redis = require('ioredis');

async function main() {
  console.log('Connecting to Redis...');
  
  // Create Redis client
  const redis = new Redis(process.env.REDIS_URL);
  
  try {
    console.log('Clearing chart data cache...');
    
    // Get all keys matching the pattern for chart data
    const chartKeys = await redis.keys('chart:*');
    console.log(`Found ${chartKeys.length} chart-related keys in Redis cache`);
    
    if (chartKeys.length > 0) {
      // Delete all chart keys
      const result = await redis.del(...chartKeys);
      console.log(`Successfully deleted ${result} keys from Redis cache`);
    } else {
      console.log('No chart data keys found in cache');
    }
    
    console.log('Cache clearing completed!');
  } catch (error) {
    console.error('Error clearing Redis cache:', error);
  } finally {
    // Close Redis connection
    redis.disconnect();
  }
}

main().catch(console.error); 