/**
 * Redis Exports Compatibility Layer
 * 
 * This file provides backward compatibility for older imports.
 * It re-exports functions and constants from the centralized Redis implementation.
 * 
 * @deprecated Import from '@/src/lib/redis' instead
 */

import { getRedisClient as getRedisClientFromConfig } from '@/src/config/redis';
import { CACHE_PREFIXES, CACHE_TTLS } from '@/src/lib/redis';

/**
 * Get or create a Redis client
 * @deprecated Import from '@/src/lib/redis' instead
 */
export function getRedisClient() {
  return getRedisClientFromConfig();
}

// Re-export constants
export { CACHE_PREFIXES, CACHE_TTLS };

/**
 * Get protocol metrics from Redis
 * @deprecated Use MetricsService instead
 */
export async function getProtocolMetricsFromRedis(): Promise<any | null> {
  try {
    const redis = getRedisClient();
    if (!redis) return null;
    
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
      totalValueLockedUsd: tvl || '0',
      dailyVolumeUsd: volume24h || '0',
      weeklyVolumeUsd: volume7d || '0',
      monthlyVolumeUsd: '0',
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
 * @deprecated Use CacheManager.invalidateByPrefix instead
 */
export async function clearProtocolMetricsCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    
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