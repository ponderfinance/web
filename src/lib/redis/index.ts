import { getRedisSingleton, getRedisEventEmitter } from './singleton';

/**
 * UNIFIED REDIS API
 * -----------------
 * This is the main entry point for Redis access throughout the application.
 * All Redis operations should go through this API to ensure connection reuse.
 */

/**
 * Get a Redis client from the application-wide singleton.
 * @deprecated Direct Redis access is discouraged - use the helper methods instead
 */
export function getRedisClient() {
  console.warn('[REDIS] Using getRedisClient directly is deprecated - consider using the helper methods');
  return getRedisSingleton().getRedisClient();
}

/**
 * Get a key from Redis
 */
export async function getKey(key: string): Promise<string | null> {
  try {
    const redis = getRedisSingleton().getRedisClient();
    if (!redis) return null;
    return await redis.get(key);
  } catch (error) {
    console.error(`[REDIS] Error getting key ${key}:`, error);
    return null;
  }
}

/**
 * Set a key in Redis
 */
export async function setKey(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  try {
    const redis = getRedisSingleton().getRedisClient();
    if (!redis) return false;
    
    if (ttlSeconds) {
      await redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (error) {
    console.error(`[REDIS] Error setting key ${key}:`, error);
    return false;
  }
}

/**
 * Get multiple keys from Redis
 */
export async function getMultipleKeys(keys: string[]): Promise<(string | null)[]> {
  try {
    const redis = getRedisSingleton().getRedisClient();
    if (!redis) return keys.map(() => null);
    return await redis.mget(keys);
  } catch (error) {
    console.error(`[REDIS] Error getting multiple keys:`, error);
    return keys.map(() => null);
  }
}

/**
 * Delete a key from Redis
 */
export async function deleteKey(key: string): Promise<boolean> {
  try {
    const redis = getRedisSingleton().getRedisClient();
    if (!redis) return false;
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`[REDIS] Error deleting key ${key}:`, error);
    return false;
  }
}

/**
 * Close the Redis connection safely
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    getRedisSingleton().closeRedisSubscriber();
  } catch (error) {
    console.error('[REDIS] Error closing Redis connection:', error);
  }
}

// Re-export useful types and functions from singleton
export { ConnectionState, ConnectionEvent } from './singleton';
export const getEventEmitter = getRedisEventEmitter;

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