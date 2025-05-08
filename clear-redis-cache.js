
/**
 * This script clears the Redis cache for metrics to force a refresh
 */
const Redis = require('ioredis');

async function clearCache() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  try {
    console.log('Connecting to Redis...');
    
    // Clear protocol metrics cache
    await redis.del('protocol:volume24h');
    await redis.del('protocol:volume7d');
    await redis.del('protocol:tvl');
    await redis.del('protocol:volume24hChange');
    await redis.del('protocol:volume1hChange');
    
    console.log('Cleared protocol metrics cache in Redis');
  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    redis.quit();
  }
}

clearCache();
