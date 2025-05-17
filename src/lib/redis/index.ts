/**
 * UNIFIED REDIS API - STRICT CONNECTION MANAGEMENT
 * 
 * This module provides Redis operations with strict connection management
 * to prevent connection storms. We use a single connection for the entire
 * application and enforce strict retry policies.
 */

// Import from strict implementations
import { 
  getKeyStrict, 
  setKeyStrict, 
  getMultipleKeysStrict, 
  deleteKeyStrict,
  CACHE_PREFIXES,
  CACHE_TTLS,
  strictEventEmitter,
  ConnectionState,
  ConnectionEvent
} from './strictOperations';

// Import from centralized config
import {
  getRedisClient as getConfigRedisClient,
  getRedisSubscriber as getConfigRedisSubscriber,
  getRedisEventEmitter as getConfigEventEmitter,
  registerRedisConnection,
  unregisterRedisConnection,
  shutdownRedisConnections
} from '@/src/config/redis';

// Import channels from constants
import { REDIS_CHANNELS } from '@/src/constants/redis-channels';

// Re-export from central constants
export { REDIS_CHANNELS };

// Re-export functions with standard names
export const getKey = getKeyStrict;
export const setKey = setKeyStrict;
export const getMultipleKeys = getMultipleKeysStrict;
export const deleteKey = deleteKeyStrict;
export { CACHE_PREFIXES, CACHE_TTLS };

// Export connection state enums
export { ConnectionState, ConnectionEvent };

// Export event emitter for subscribers
export const getEventEmitter = () => {
  // We want to get the emitter from config while maintaining backward compatibility
  return getConfigEventEmitter() || strictEventEmitter;
};

/**
 * Close the Redis connection safely - preferred method
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    await shutdownRedisConnections();
  } catch (error) {
    console.error('[REDIS] Error closing Redis connections:', error);
  }
}

/**
 * Get the Redis client instance
 * Use the high-level API functions instead when possible
 */
export function getRedisClient() {
  return getConfigRedisClient();
}

/**
 * Get the Redis subscriber instance
 * Use the high-level subscription API instead when possible 
 */
export function getRedisSubscriber() {
  return getConfigRedisSubscriber();
}

// Export connection registration functions
export { registerRedisConnection, unregisterRedisConnection };

// Export utility types for use with Redis data
export type RedisEntityType = 'token' | 'pair' | 'transaction' | 'metrics';
export type RedisEntityId = string;
export type RedisTimestamp = number;

/**
 * Build a Redis channel name from entity type and optional ID
 */
export function buildRedisChannelName(entityType: RedisEntityType, entityId?: string): string {
  const baseChannel = entityType === 'metrics' 
    ? REDIS_CHANNELS.METRICS_UPDATED
    : entityType === 'token'
      ? REDIS_CHANNELS.TOKEN_UPDATED
      : entityType === 'pair'
        ? REDIS_CHANNELS.PAIR_UPDATED
        : REDIS_CHANNELS.TRANSACTION_UPDATED;
  
  return entityId ? `${baseChannel}:${entityId}` : baseChannel;
}

/**
 * Safely get a value from Redis, handling null clients
 * This helps avoid the need for null checks everywhere
 */
export async function safeRedisGet(key: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  
  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`[REDIS] Error getting key ${key}:`, error);
    return null;
  }
}

/**
 * Safely set a value in Redis, handling null clients
 */
export async function safeRedisSet(key: string, value: string, ttl?: number): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  
  try {
    if (ttl) {
      await redis.set(key, value, 'EX', ttl);
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
 * Safely delete a key from Redis, handling null clients
 */
export async function safeRedisDelete(key: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`[REDIS] Error deleting key ${key}:`, error);
    return false;
  }
}
