/**
 * Centralized Cache Manager Service
 * 
 * Provides a unified interface for caching operations with support for:
 * - Multiple cache levels (memory, Redis, persistent)
 * - Configurable TTL settings per data type
 * - Cache versioning and invalidation strategies
 * - Cache statistics and monitoring
 */

import { Redis } from 'ioredis';
import { getRedisClient } from '@/src/lib/redis/client';
import { createHash } from 'crypto';

// Default TTL values (in seconds)
const DEFAULT_TTL = {
  // Very short-lived data like prices
  VOLATILE: 10,
  
  // Standard TTL for most data
  STANDARD: 5 * 60,
  
  // Long-lived data that changes infrequently
  EXTENDED: 30 * 60,
  
  // Data that is extremely stable
  STABLE: 24 * 60 * 60,
};

// Cache key prefixes by data type
export enum CachePrefix {
  TOKEN = 'token:',
  PAIR = 'pair:',
  USER = 'user:',
  METRICS = 'metrics:',
  CHART = 'chart:',
  VOLUME = 'volume:',
  TVL = 'tvl:',
  PRICE = 'price:',
}

// Cache types
export enum CacheType {
  MEMORY = 'memory',
  REDIS = 'redis',
  ALL = 'all',
}

// Cache level configuration
export interface CacheConfig {
  ttl: number;
  prefix: CachePrefix;
  version?: string;
  useMemory?: boolean;
  useRedis?: boolean;
}

// Type definition for memory cache
export interface MemoryCacheEntry {
  value: any;
  expiry: number; // Timestamp when the cache will expire
}

// Define stats interface for type safety
interface CacheStats {
  hits: {
    memory: number;
    redis: number;
  };
  misses: {
    memory: number;
    redis: number;
  };
  sets: {
    memory: number;
    redis: number;
  };
  invalidations: {
    memory: number;
    redis: number;
    prefixes: number;
  };
}

// In-memory cache storage
const memoryCache = new Map<string, MemoryCacheEntry>();

// Cache statistics
const stats: CacheStats = {
  hits: {
    memory: 0,
    redis: 0,
  },
  misses: {
    memory: 0,
    redis: 0,
  },
  sets: {
    memory: 0,
    redis: 0,
  },
  invalidations: {
    memory: 0,
    redis: 0,
    prefixes: 0,
  },
};

/**
 * Generate a standardized cache key
 */
export function generateCacheKey(
  prefix: CachePrefix,
  id: string,
  subKey?: string,
  version?: string
): string {
  const baseKey = `${prefix}${id}${subKey ? `:${subKey}` : ''}`;
  return version ? `${baseKey}:v${version}` : baseKey;
}

/**
 * Generate a hash key for complex objects
 */
export function generateHashKey(obj: any): string {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return createHash('md5').update(str).digest('hex');
}

/**
 * Centralized Cache Manager
 */
export const CacheManager = {
  /**
   * Get an item from cache, trying memory first, then Redis
   */
  async get<T>(
    prefix: CachePrefix,
    id: string,
    subKey?: string,
    config?: Partial<CacheConfig>
  ): Promise<T | null> {
    const key = generateCacheKey(
      prefix,
      id,
      subKey,
      config?.version
    );
    const useMemory = config?.useMemory !== false;
    const useRedis = config?.useRedis !== false;

    // Try memory cache first (fastest)
    if (useMemory) {
      const memoryResult = this.getFromMemory<T>(key);
      if (memoryResult !== null) {
        stats.hits.memory++;
        return memoryResult;
      }
      stats.misses.memory++;
    }

    // Try Redis next
    if (useRedis) {
      try {
        const redis = getRedisClient();
        const redisResult = await redis.get(key);
        
        if (redisResult) {
          stats.hits.redis++;
          const parsed = JSON.parse(redisResult) as T;
          
          // Add to memory cache for future fast access
          if (useMemory) {
            this.setInMemory(key, parsed, config?.ttl || DEFAULT_TTL.STANDARD);
          }
          
          return parsed;
        }
        stats.misses.redis++;
      } catch (error) {
        console.error(`Redis cache get error for key ${key}:`, error);
      }
    }

    return null;
  },

  /**
   * Get multiple items from cache in batch
   */
  async getBulk<T>(
    prefix: CachePrefix,
    ids: string[],
    subKey?: string,
    config?: Partial<CacheConfig>
  ): Promise<Record<string, T>> {
    const result: Record<string, T> = {};
    const missedIds: string[] = [];
    const useMemory = config?.useMemory !== false;
    const useRedis = config?.useRedis !== false;
    const version = config?.version;

    // First try memory cache for all items
    if (useMemory) {
      for (const id of ids) {
        const key = generateCacheKey(prefix, id, subKey, version);
        const memoryResult = this.getFromMemory<T>(key);
        
        if (memoryResult !== null) {
          result[id] = memoryResult;
          stats.hits.memory++;
        } else {
          missedIds.push(id);
          stats.misses.memory++;
        }
      }
    } else {
      missedIds.push(...ids);
    }

    // If we got all items from memory, we're done
    if (missedIds.length === 0) {
      return result;
    }

    // Try Redis for the items not found in memory
    if (useRedis) {
      try {
        const redis = getRedisClient();
        const keys = missedIds.map(id => 
          generateCacheKey(prefix, id, subKey, version)
        );
        
        if (keys.length > 0) {
          const redisResults = await redis.mget(...keys);
          
          redisResults.forEach((redisResult, index) => {
            if (redisResult) {
              const id = missedIds[index];
              const parsed = JSON.parse(redisResult) as T;
              result[id] = parsed;
              stats.hits.redis++;
              
              // Add to memory cache for future access
              if (useMemory) {
                const key = generateCacheKey(prefix, id, subKey, version);
                this.setInMemory(key, parsed, config?.ttl || DEFAULT_TTL.STANDARD);
              }
            } else {
              stats.misses.redis++;
            }
          });
        }
      } catch (error) {
        console.error(`Redis cache bulk get error:`, error);
      }
    }

    return result;
  },

  /**
   * Set an item in cache (both memory and Redis by default)
   */
  async set<T>(
    prefix: CachePrefix,
    id: string,
    value: T,
    subKey?: string,
    config?: Partial<CacheConfig>
  ): Promise<void> {
    // Use provided TTL or get default based on prefix
    const ttl = config?.ttl || this.getDefaultTTL(prefix);
    const key = generateCacheKey(
      prefix,
      id,
      subKey,
      config?.version
    );
    const useMemory = config?.useMemory !== false;
    const useRedis = config?.useRedis !== false;

    // Set in memory cache
    if (useMemory) {
      this.setInMemory(key, value, ttl);
      stats.sets.memory++;
    }

    // Set in Redis
    if (useRedis) {
      try {
        const redis = getRedisClient();
        const serialized = JSON.stringify(value);
        await redis.set(key, serialized, 'EX', ttl);
        stats.sets.redis++;
      } catch (error) {
        console.error(`Redis cache set error for key ${key}:`, error);
      }
    }
  },

  /**
   * Set multiple items in cache at once
   */
  async setBulk<T>(
    prefix: CachePrefix,
    items: Array<{ id: string; value: T }>,
    subKey?: string,
    config?: Partial<CacheConfig>
  ): Promise<void> {
    if (items.length === 0) return;

    const ttl = config?.ttl || this.getDefaultTTL(prefix);
    const useMemory = config?.useMemory !== false;
    const useRedis = config?.useRedis !== false;
    const version = config?.version;

    // Set in memory cache
    if (useMemory) {
      for (const item of items) {
        const key = generateCacheKey(prefix, item.id, subKey, version);
        this.setInMemory(key, item.value, ttl);
      }
      stats.sets.memory += items.length;
    }

    // Set in Redis using pipeline for efficiency
    if (useRedis) {
      try {
        const redis = getRedisClient();
        const pipeline = redis.pipeline();

        for (const item of items) {
          const key = generateCacheKey(prefix, item.id, subKey, version);
          const serialized = JSON.stringify(item.value);
          pipeline.set(key, serialized, 'EX', ttl);
        }

        await pipeline.exec();
        stats.sets.redis += items.length;
      } catch (error) {
        console.error(`Redis cache bulk set error:`, error);
      }
    }
  },

  /**
   * Invalidate a specific cache item
   */
  async invalidate(
    prefix: CachePrefix,
    id: string,
    subKey?: string,
    cacheType: CacheType = CacheType.ALL
  ): Promise<void> {
    const key = generateCacheKey(prefix, id, subKey);

    // Clear from memory cache
    if (cacheType === CacheType.ALL || cacheType === CacheType.MEMORY) {
      if (memoryCache.delete(key)) {
        stats.invalidations.memory++;
      }
    }

    // Clear from Redis
    if (cacheType === CacheType.ALL || cacheType === CacheType.REDIS) {
      try {
        const redis = getRedisClient();
        await redis.del(key);
        stats.invalidations.redis++;
      } catch (error) {
        console.error(`Redis cache invalidate error for key ${key}:`, error);
      }
    }
  },

  /**
   * Invalidate multiple cache items at once
   */
  async invalidateBulk(
    prefix: CachePrefix,
    ids: string[],
    subKey?: string,
    cacheType: CacheType = CacheType.ALL
  ): Promise<void> {
    if (ids.length === 0) return;

    // Generate all keys
    const keys = ids.map(id => generateCacheKey(prefix, id, subKey));

    // Clear from memory cache
    if (cacheType === CacheType.ALL || cacheType === CacheType.MEMORY) {
      let count = 0;
      for (const key of keys) {
        if (memoryCache.delete(key)) {
          count++;
        }
      }
      stats.invalidations.memory += count;
    }

    // Clear from Redis using pipeline for efficiency
    if (cacheType === CacheType.ALL || cacheType === CacheType.REDIS) {
      try {
        const redis = getRedisClient();
        if (keys.length > 0) {
          await redis.del(...keys);
          stats.invalidations.redis += keys.length;
        }
      } catch (error) {
        console.error(`Redis cache bulk invalidate error:`, error);
      }
    }
  },

  /**
   * Invalidate all cache items with a specific prefix
   */
  async invalidateByPrefix(
    prefix: CachePrefix,
    cacheType: CacheType = CacheType.ALL
  ): Promise<void> {
    // Clear matching prefix from memory cache
    if (cacheType === CacheType.ALL || cacheType === CacheType.MEMORY) {
      let count = 0;
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          memoryCache.delete(key);
          count++;
        }
      }
      stats.invalidations.memory += count;
    }

    // Clear matching prefix from Redis
    if (cacheType === CacheType.ALL || cacheType === CacheType.REDIS) {
      try {
        const redis = getRedisClient();
        
        // Find all keys with the prefix and delete them
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
            await redis.del(...keys);
            deletedCount += keys.length;
          }
        } while (cursor !== '0');
        
        stats.invalidations.redis += deletedCount;
        stats.invalidations.prefixes++;
      } catch (error) {
        console.error(`Redis cache invalidate by prefix error for ${prefix}:`, error);
      }
    }
  },

  /**
   * Clear all caches - USE WITH CAUTION
   */
  async clearAll(cacheType: CacheType = CacheType.ALL): Promise<void> {
    // Clear memory cache
    if (cacheType === CacheType.ALL || cacheType === CacheType.MEMORY) {
      const count = memoryCache.size;
      memoryCache.clear();
      stats.invalidations.memory += count;
    }

    // Clear Redis cache
    if (cacheType === CacheType.ALL || cacheType === CacheType.REDIS) {
      try {
        const redis = getRedisClient();
        await redis.flushdb();
        stats.invalidations.redis++;
      } catch (error) {
        console.error('Redis cache clear all error:', error);
      }
    }
  },

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...stats,
      memorySize: memoryCache.size,
      hitRatio: {
        memory: stats.hits.memory / (stats.hits.memory + stats.misses.memory) || 0,
        redis: stats.hits.redis / (stats.hits.redis + stats.misses.redis) || 0,
        overall: (stats.hits.memory + stats.hits.redis) / 
                 (stats.hits.memory + stats.hits.redis + stats.misses.memory + stats.misses.redis) || 0
      }
    };
  },

  /**
   * Reset cache statistics
   */
  resetStats() {
    // Properly type the stats keys
    const statsCategories: (keyof CacheStats)[] = ['hits', 'misses', 'sets', 'invalidations'];
    
    for (const category of statsCategories) {
      const counters = stats[category] as Record<string, number>;
      
      // Reset all numerical properties
      Object.keys(counters).forEach(key => {
        counters[key] = 0;
      });
    }
  },

  /**
   * Helper to get from memory cache
   */
  getFromMemory<T>(key: string): T | null {
    const entry = memoryCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (entry.expiry < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    
    return entry.value as T;
  },

  /**
   * Helper to set in memory cache
   */
  setInMemory<T>(key: string, value: T, ttlSeconds: number): void {
    const expiry = Date.now() + ttlSeconds * 1000;
    memoryCache.set(key, { value, expiry });
    
    // Perform cleanup of expired items periodically
    this.scheduleMemoryCacheCleanup();
  },

  /**
   * Get default TTL based on prefix
   */
  getDefaultTTL(prefix: CachePrefix): number {
    switch (prefix) {
      case CachePrefix.PRICE:
        return DEFAULT_TTL.VOLATILE;
      case CachePrefix.TOKEN:
      case CachePrefix.PAIR:
        return DEFAULT_TTL.STANDARD;
      case CachePrefix.METRICS:
      case CachePrefix.VOLUME:
      case CachePrefix.TVL:
        return DEFAULT_TTL.STANDARD;
      case CachePrefix.CHART:
        return DEFAULT_TTL.EXTENDED;
      case CachePrefix.USER:
        return DEFAULT_TTL.EXTENDED;
      default:
        return DEFAULT_TTL.STANDARD;
    }
  },

  // Track last cleanup time
  lastCleanupTime: 0,

  /**
   * Schedule memory cache cleanup (throttled to run at most once per minute)
   */
  scheduleMemoryCacheCleanup() {
    const now = Date.now();
    const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
    
    if (now - this.lastCleanupTime > CLEANUP_INTERVAL) {
      this.lastCleanupTime = now;
      
      // Schedule cleanup on next tick to avoid blocking
      setTimeout(() => {
        this.cleanupExpiredMemoryCache();
      }, 0);
    }
  },

  /**
   * Clean up expired items from memory cache
   */
  cleanupExpiredMemoryCache() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiry < now) {
        memoryCache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Memory cache cleanup: removed ${removedCount} expired items. Current size: ${memoryCache.size}`);
    }
  }
}; 