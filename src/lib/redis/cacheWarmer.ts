/**
 * Redis Cache Warmer
 * 
 * Utility for prefetching important data into the local cache
 * to improve resilience against Redis connection issues.
 */

import { getLocalCache } from './cache';
import { CACHE_PREFIXES, CACHE_TTLS } from './index';

// Track which data has been warmed to avoid duplicates
const warmedKeys = new Set<string>();

/**
 * Warm the cache with critical token data
 */
export async function warmTokenCache(tokenId: string, tokenData: string): Promise<void> {
  const cacheKey = `${CACHE_PREFIXES.TOKEN}${tokenId}`;
  
  if (warmedKeys.has(cacheKey)) {
    return; // Already warmed
  }
  
  const localCache = getLocalCache();
  localCache.prefetch(cacheKey, tokenData, CACHE_TTLS.MEDIUM);
  warmedKeys.add(cacheKey);
  
  console.log(`[CACHE] Warmed cache for token ${tokenId.slice(0, 8)}...`);
}

/**
 * Warm the cache with critical pair data
 */
export async function warmPairCache(pairId: string, pairData: string): Promise<void> {
  const cacheKey = `${CACHE_PREFIXES.PAIR}${pairId}`;
  
  if (warmedKeys.has(cacheKey)) {
    return; // Already warmed
  }
  
  const localCache = getLocalCache();
  localCache.prefetch(cacheKey, pairData, CACHE_TTLS.MEDIUM);
  warmedKeys.add(cacheKey);
  
  console.log(`[CACHE] Warmed cache for pair ${pairId.slice(0, 8)}...`);
}

/**
 * Warm the cache with protocol metrics data
 */
export async function warmMetricsCache(metricsData: string): Promise<void> {
  const cacheKey = `${CACHE_PREFIXES.PROTOCOL}metrics`;
  
  const localCache = getLocalCache();
  localCache.prefetch(cacheKey, metricsData, CACHE_TTLS.SHORT);
  warmedKeys.add(cacheKey);
  
  console.log(`[CACHE] Warmed cache for protocol metrics`);
}

/**
 * Warm multiple items at once from a list
 */
export async function batchWarmCache(items: Array<{ type: string, id: string, data: string }>): Promise<void> {
  const localCache = getLocalCache();
  let warmedCount = 0;
  
  items.forEach(item => {
    const cacheKey = `${item.type}${item.id}`;
    
    if (!warmedKeys.has(cacheKey)) {
      localCache.prefetch(cacheKey, item.data, CACHE_TTLS.MEDIUM);
      warmedKeys.add(cacheKey);
      warmedCount++;
    }
  });
  
  console.log(`[CACHE] Batch warmed ${warmedCount} items`);
}

/**
 * Get the cache warming status
 */
export function getCacheWarmingStatus(): { 
  warmedItemCount: number,
  cacheStats: { size: number, hits: number, misses: number, hitRate: number }
} {
  const localCache = getLocalCache();
  return {
    warmedItemCount: warmedKeys.size,
    cacheStats: localCache.getStats()
  };
} 