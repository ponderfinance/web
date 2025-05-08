/**
 * Redis exports for consistent usage throughout the application
 */
import Redis from 'ioredis';

// Constants for cache prefixes and TTLs - must match indexer
export const CACHE_PREFIXES = {
  PAIR: 'pair:',
  TOKEN: 'token:',
  PROTOCOL: 'protocol:'
};

export const CACHE_TTLS = {
  SHORT: 60, // 1 minute
  MEDIUM: 5 * 60, // 5 minutes
  LONG: 30 * 60 // 30 minutes
};

// Single Redis client instance for the application
let redisClient: Redis | null = null;

/**
 * Get or create a Redis client
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`Connecting to Redis at ${redisUrl.split('@').pop()}`);
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        return Math.min(times * 50, 2000);
      },
      maxRetriesPerRequest: 3
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    redisClient.on('connect', () => {
      console.log('Successfully connected to Redis');
    });
  }
  
  return redisClient;
}

/**
 * Get protocol metrics from Redis
 */
export async function getProtocolMetricsFromRedis(): Promise<any | null> {
  try {
    const redis = getRedisClient();
    
    const [
      tvl,
      volume24h,
      volume7d,
      volume1h,
      volume24hChange,
      volume1hChange,
      timestamp
    ] = await redis.mget([
      `${CACHE_PREFIXES.PROTOCOL}tvl`,
      `${CACHE_PREFIXES.PROTOCOL}volume24h`,
      `${CACHE_PREFIXES.PROTOCOL}volume7d`,
      `${CACHE_PREFIXES.PROTOCOL}volume1h`,
      `${CACHE_PREFIXES.PROTOCOL}volume24hChange`,
      `${CACHE_PREFIXES.PROTOCOL}volume1hChange`,
      `${CACHE_PREFIXES.PROTOCOL}timestamp`
    ]);
    
    if (!tvl && !volume24h) {
      return null;
    }
    
    return {
      id: 'redis-metrics',
      timestamp: timestamp ? parseInt(timestamp, 10) : Math.floor(Date.now() / 1000),
      totalValueLockedUSD: tvl || '0',
      dailyVolumeUSD: volume24h || '0',
      weeklyVolumeUSD: volume7d || '0',
      monthlyVolumeUSD: '0',
      volume1h: volume1h || '0',
      volume1hChange: volume1hChange ? parseFloat(volume1hChange) : 0,
      volume24hChange: volume24hChange ? parseFloat(volume24hChange) : 0
    };
  } catch (error) {
    console.error('Error reading protocol metrics from Redis:', error);
    return null;
  }
}

/**
 * Clear protocol metrics cache
 */
export async function clearProtocolMetricsCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    
    const keys = await redis.keys(`${CACHE_PREFIXES.PROTOCOL}*`);
    
    if (keys.length === 0) {
      console.log('No protocol metrics found in Redis cache');
      return;
    }
    
    const result = await redis.del(...keys);
    console.log(`Cleared ${result} protocol metrics keys from Redis cache`);
  } catch (error) {
    console.error('Error clearing protocol metrics from Redis:', error);
  }
} 