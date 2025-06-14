import { getRedisSingleton } from './singleton';
import type Redis from 'ioredis';

/**
 * @deprecated This module is deprecated - use the redis/index.ts API instead
 * All code here is refactored to use the singleton pattern to avoid connection problems
 */

// Constants for cache prefixes and TTLs - must match indexer
export const CACHE_PREFIXES = {
  PAIR: 'pair:',
  TOKEN: 'token:',
  PROTOCOL: 'protocol:',
  PAIR_METRICS: 'pair_metrics:'
};

export const CACHE_TTLS = {
  SHORT: 60, // 1 minute
  MEDIUM: 5 * 60, // 5 minutes
  LONG: 30 * 60 // 30 minutes
};

/**
 * Get a Redis client - ensures we use the singleton pattern
 * @deprecated Use the redis/index.ts API instead
 */
export function getRedisClient(): Redis {
  console.warn('[REDIS] Using legacy client.ts getRedisClient is deprecated - use redis/index.ts API instead');
  const redis = getRedisSingleton().getRedisClient();
  if (!redis) {
    return createFallbackClient();
  }
  return redis;
}

/**
 * Reset the Redis client - forces reconnection on next getRedisClient call
 * @deprecated This function is no longer needed with the singleton pattern
 */
export function _resetRedisClient(): void {
  console.warn('[REDIS] _resetRedisClient() is deprecated - the singleton manages connections');
  // No-op - the singleton handles this
}

/**
 * Create a fallback Redis client for use when Redis is unavailable
 */
function createFallbackClient(): any {
  // Create a mock object that implements the Redis interface
  const fallback = {
    get: async () => null,
    set: async () => 'OK',
    mget: async () => [],
    ping: async () => 'DUMMY',
    on: () => fallback,
    disconnect: () => {},
  };
  
  console.warn('[REDIS] Using Redis fallback client - data will not be cached!');
  return fallback;
}

/**
 * Read protocol metrics from Redis in a consistent way
 * @deprecated Use the redis/index.ts API instead
 */
export async function getProtocolMetricsFromRedis(): Promise<any | null> {
  try {
    const redis = getRedisClient();
    
    // Get all needed metrics from Redis at once
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
    
    // If essential data is missing, return null
    if (!tvl && !volume24h) {
      return null;
    }
    
    // Return metrics object with values from Redis
    return {
      id: 'redis-metrics',
      timestamp: timestamp ? parseInt(timestamp, 10) : Math.floor(Date.now() / 1000),
      totalValueLockedUSD: tvl || '0',
      dailyVolumeUSD: volume24h || '0',
      weeklyVolumeUSD: volume7d || '0',
      monthlyVolumeUSD: '0', // Not cached in Redis currently
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
 * For testing and development - close the connection
 * @deprecated Use closeRedisConnection from redis/index.ts instead
 */
export function closeRedisConnection() {
  console.warn('[REDIS] Using legacy closeRedisConnection is deprecated');
  getRedisSingleton().closeRedisSubscriber();
}

/**
 * Clear all protocol metrics from Redis cache
 * @deprecated Use the redis/index.ts API instead
 */
export async function clearProtocolMetricsCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    
    // Get all protocol keys
    const keys = await redis.keys(`${CACHE_PREFIXES.PROTOCOL}*`);
    
    if (keys.length === 0) {
      console.log('No protocol metrics found in Redis cache');
      return;
    }
    
    // Delete all protocol keys
    const result = await redis.del(...keys);
    console.log(`Cleared ${result} protocol metrics keys from Redis cache`);
  } catch (error) {
    console.error('Error clearing protocol metrics from Redis:', error);
  }
}

/**
 * Update pair metrics in Redis with poolAPR and rewardAPR values
 * @deprecated This function is no longer needed as metrics are now updated directly by the indexer
 */
export async function updateLocalPairMetricsInRedis() {
  console.warn('DEPRECATED: updateLocalPairMetricsInRedis is no longer needed as metrics are now updated by the indexer');
  return false;
}
