/**
 * Strict Redis Operations
 * 
 * These functions use the strict connection manager that prevents connection storms
 * by enforcing a single Redis connection for the entire application.
 */

import { getStrictRedisClient, getConnectionState, getConnectionEventEmitter } from './connectionManager';
import { getLocalCache } from './cache';
import { getCircuitBreaker, CircuitState } from './circuitBreaker';
import { ConnectionState, ConnectionEvent } from './singleton';

// Cache TTL constants
export const CACHE_TTLS = {
  SHORT: 60, // 1 minute
  MEDIUM: 5 * 60, // 5 minutes
  LONG: 30 * 60 // 30 minutes
};

// Cache key prefixes - must match indexer
export const CACHE_PREFIXES = {
  PAIR: 'pair:',
  TOKEN: 'token:',
  PROTOCOL: 'protocol:',
  PAIR_METRICS: 'pair_metrics:'
};

/**
 * Get a key from Redis with failsafe
 */
export async function getKeyStrict(key: string): Promise<string | null> {
  const localCache = getLocalCache();
  const circuitBreaker = getCircuitBreaker();
  
  // Try local cache first for optimal performance
  const cachedValue = localCache.get(key);
  if (cachedValue !== null) {
    return cachedValue;
  }
  
  // Check circuit breaker and connection state
  if (!circuitBreaker.canRequest() || getConnectionState().state !== ConnectionState.CONNECTED) {
    return null;
  }
  
  try {
    const redis = await getStrictRedisClient();
    if (!redis) return null;
    
    const value = await redis.get(key);
    
    // Update cache if value exists
    if (value) {
      localCache.set(key, value, CACHE_TTLS.MEDIUM);
    }
    
    // Record success
    circuitBreaker.recordSuccess();
    
    return value;
  } catch (error) {
    console.error(`[REDIS-STRICT] Error getting key ${key}:`, error);
    circuitBreaker.recordFailure(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Set a key in Redis with failsafe
 */
export async function setKeyStrict(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  const localCache = getLocalCache();
  const circuitBreaker = getCircuitBreaker();
  
  // Always update local cache
  if (ttlSeconds) {
    localCache.set(key, value, ttlSeconds);
  } else {
    localCache.set(key, value);
  }
  
  // Check circuit breaker and connection state
  if (!circuitBreaker.canRequest() || getConnectionState().state !== ConnectionState.CONNECTED) {
    return false;
  }
  
  try {
    const redis = await getStrictRedisClient();
    if (!redis) return false;
    
    if (ttlSeconds) {
      await redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await redis.set(key, value);
    }
    
    // Record success
    circuitBreaker.recordSuccess();
    
    return true;
  } catch (error) {
    console.error(`[REDIS-STRICT] Error setting key ${key}:`, error);
    circuitBreaker.recordFailure(error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Get multiple keys from Redis with failsafe
 */
export async function getMultipleKeysStrict(keys: string[]): Promise<(string | null)[]> {
  const localCache = getLocalCache();
  const circuitBreaker = getCircuitBreaker();
  
  // Try local cache first for all keys
  const cachedResults: (string | null)[] = keys.map(key => localCache.get(key));
  
  // If all keys are in cache, return cached values
  if (!cachedResults.includes(null)) {
    return cachedResults;
  }
  
  // Check circuit breaker and connection state
  if (!circuitBreaker.canRequest() || getConnectionState().state !== ConnectionState.CONNECTED) {
    return cachedResults;
  }
  
  try {
    const redis = await getStrictRedisClient();
    if (!redis) return cachedResults;
    
    const results = await redis.mget(keys);
    
    // Update cache with values
    keys.forEach((key, index) => {
      const value = results[index];
      if (value) {
        localCache.set(key, value, CACHE_TTLS.MEDIUM);
      }
    });
    
    // Record success
    circuitBreaker.recordSuccess();
    
    return results;
  } catch (error) {
    console.error(`[REDIS-STRICT] Error getting multiple keys:`, error);
    circuitBreaker.recordFailure(error instanceof Error ? error : new Error(String(error)));
    return cachedResults;
  }
}

/**
 * Delete a key from Redis with failsafe
 */
export async function deleteKeyStrict(key: string): Promise<boolean> {
  const localCache = getLocalCache();
  const circuitBreaker = getCircuitBreaker();
  
  // Always delete from local cache
  localCache.delete(key);
  
  // Check circuit breaker and connection state
  if (!circuitBreaker.canRequest() || getConnectionState().state !== ConnectionState.CONNECTED) {
    return false;
  }
  
  try {
    const redis = await getStrictRedisClient();
    if (!redis) return false;
    
    await redis.del(key);
    
    // Record success
    circuitBreaker.recordSuccess();
    
    return true;
  } catch (error) {
    console.error(`[REDIS-STRICT] Error deleting key ${key}:`, error);
    circuitBreaker.recordFailure(error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Connection events from the strict manager
 */
export const strictEventEmitter = getConnectionEventEmitter();

/**
 * Export connection states
 */
export { ConnectionState, ConnectionEvent }; 