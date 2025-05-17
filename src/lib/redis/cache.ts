/**
 * Redis Local Cache
 * 
 * A memory-based cache system that provides resilience against Redis
 * connection failures by caching previously fetched values locally.
 */

export class RedisLocalCache {
  private static instance: RedisLocalCache | null = null;
  private cache: Map<string, { value: string, expiry: number | null }> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private maxSize: number = 1000; // Maximum number of entries to prevent memory leaks
  
  private constructor() {
    console.log('[REDIS] Local cache initialized');
  }
  
  public static getInstance(): RedisLocalCache {
    if (!RedisLocalCache.instance) {
      RedisLocalCache.instance = new RedisLocalCache();
    }
    return RedisLocalCache.instance;
  }
  
  public set(key: string, value: string, ttlSeconds?: number): void {
    // Enforce cache size limit with LRU-like policy
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry
      const iterator = this.cache.keys();
      const oldestKey = iterator.next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.cache.set(key, { value, expiry });
  }
  
  public get(key: string): string | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Move the entry to the end of the map to simulate LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.hits++;
    return entry.value;
  }
  
  public delete(key: string): void {
    this.cache.delete(key);
  }
  
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  public prefetch(key: string, value: string, ttlSeconds?: number): void {
    // Store data in cache without checking size limits
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.cache.set(key, { value, expiry });
  }
  
  public getStats(): { size: number, hits: number, misses: number, hitRate: number } {
    const total = this.hits + this.misses;
    const hitRate = total === 0 ? 0 : this.hits / total;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate
    };
  }
  
  public configure(config: { maxSize?: number }): void {
    if (config.maxSize) this.maxSize = config.maxSize;
  }
}

// Export a singleton getter
export const getLocalCache = (): RedisLocalCache => RedisLocalCache.getInstance(); 