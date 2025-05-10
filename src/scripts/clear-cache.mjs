import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Cache key prefixes (copied from CacheManager)
const CACHE_PREFIXES = {
  METRICS: 'metrics:',
  TVL: 'tvl:',
  PROTOCOL: 'protocol:'
};

async function clearCache() {
  console.log('Starting cache clearing process...');
  
  // Get Redis connection info from environment
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('REDIS_URL not found in environment variables');
    process.exit(1);
  }
  
  console.log(`Connecting to Redis at ${redisUrl.split('@').pop()}`); // Safe logging without credentials
  
  // Create Redis client
  const redis = new Redis(redisUrl);
  
  try {
    // Test connection
    const pingResponse = await redis.ping();
    console.log(`Redis connection test: ${pingResponse}`);
    
    // Clear metrics cache
    let deletedKeys = 0;
    
    // Clear metrics: prefix
    deletedKeys += await clearKeysByPrefix(redis, CACHE_PREFIXES.METRICS);
    console.log(`Cleared keys with prefix ${CACHE_PREFIXES.METRICS}`);
    
    // Clear tvl: prefix
    deletedKeys += await clearKeysByPrefix(redis, CACHE_PREFIXES.TVL);
    console.log(`Cleared keys with prefix ${CACHE_PREFIXES.TVL}`);
    
    // Clear protocol: prefix
    deletedKeys += await clearKeysByPrefix(redis, CACHE_PREFIXES.PROTOCOL);
    console.log(`Cleared keys with prefix ${CACHE_PREFIXES.PROTOCOL}`);
    
    console.log(`Total deleted keys: ${deletedKeys}`);
    
    // Also clear any Relay cache in Redis (if exists)
    const relayKeys = await redis.keys('relay:*');
    if (relayKeys.length > 0) {
      await redis.del(...relayKeys);
      console.log(`Cleared ${relayKeys.length} Relay cache keys`);
    }
    
    // Also clear any chart cache
    const chartKeys = await redis.keys('chart:*');
    if (chartKeys.length > 0) {
      await redis.del(...chartKeys);
      console.log(`Cleared ${chartKeys.length} chart cache keys`);
    }
    
    // Check if there are any protocol metrics keys left
    const remainingMetricsKeys = await redis.keys(`${CACHE_PREFIXES.METRICS}*`);
    const remainingTvlKeys = await redis.keys(`${CACHE_PREFIXES.TVL}*`);
    const remainingProtocolKeys = await redis.keys(`${CACHE_PREFIXES.PROTOCOL}*`);
    
    console.log(`Remaining metrics keys: ${remainingMetricsKeys.length}`);
    console.log(`Remaining TVL keys: ${remainingTvlKeys.length}`);
    console.log(`Remaining protocol keys: ${remainingProtocolKeys.length}`);
    
    console.log('Cache clearing completed successfully!');
    
  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    // Close the Redis connection
    redis.quit();
    console.log('Redis connection closed');
  }
}

// Helper function to clear keys by prefix using SCAN
async function clearKeysByPrefix(redis, prefix) {
  let cursor = '0';
  let deletedCount = 0;
  
  do {
    // SCAN through Redis keys with the prefix
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      `${prefix}*`,
      'COUNT',
      1000
    );
    
    cursor = nextCursor;
    
    if (keys.length > 0) {
      console.log(`Found ${keys.length} keys with prefix ${prefix}`);
      await redis.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== '0');
  
  return deletedCount;
}

// Run the script
clearCache().catch(console.error); 