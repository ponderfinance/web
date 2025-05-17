/**
 * Standardized DataLoader Implementation
 * 
 * Provides factory functions for consistent DataLoader creation with optimized batching,
 * caching, and error handling. Integrates with the CacheManager for cache-through behavior.
 */

import DataLoader from 'dataloader';
import { PrismaClient, Token, Pair, UserStat } from '@prisma/client';
import { getCachedPairReserveUSDBulk } from '@/src/lib/redis/pairCache';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CacheManager, CachePrefix } from '@/src/lib/services/cacheManager';

// Constants for DataLoader configuration
const BATCH_SIZES = {
  DEFAULT: 100,
  TOKENS: 100,
  PAIRS: 50,
  PRICES: 200,
  USERS: 50,
};

interface DataLoaderOptions<K, V> {
  /** Maximum number of keys to batch together */
  maxBatchSize?: number;
  /** Enable in-memory DataLoader caching */
  cache?: boolean;
  /** Function to generate cache key from the input key */
  cacheKeyFn?: (key: K) => string;
  /** Cache keys in CacheManager when fetched */
  useCacheManager?: boolean;
  /** Cache prefix to use with CacheManager */
  cachePrefix?: CachePrefix;
  /** TTL for CacheManager entries */
  cacheTTL?: number;
}

/**
 * Create a batch function with standardized error handling
 */
function createBatchFn<K, V>(
  batchFn: (keys: readonly K[]) => Promise<(V | Error)[]>,
  options: {
    onError?: (error: any, keys: readonly K[]) => void;
    errorMapper?: (error: any, key: K) => Error;
  } = {}
): (keys: readonly K[]) => Promise<(V | Error)[]> {
  return async (keys: readonly K[]) => {
    try {
      return await batchFn(keys);
    } catch (error) {
      // Call the provided error handler if any
      if (options.onError) {
        options.onError(error, keys);
      }
      
      // Default error logging
      console.error('DataLoader batch function error:', error);
      
      // Map the error to individual errors for each key
      return keys.map(key => 
        options.errorMapper 
          ? options.errorMapper(error, key) 
          : new Error(`Failed to load: ${String(key)}`)
      );
    }
  };
}

/**
 * Create a DataLoader factory with consistent options and error handling
 */
export function createDataLoader<K, V>(
  batchFn: (keys: readonly K[]) => Promise<(V | Error | null)[]>,
  options: DataLoaderOptions<K, V> = {}
): DataLoader<K, V | null> {
  const {
    maxBatchSize = BATCH_SIZES.DEFAULT,
    cache = true,
    cacheKeyFn,
    useCacheManager = false,
    cachePrefix,
    cacheTTL,
  } = options;

  // If using CacheManager integration, wrap the batch function
  let wrappedBatchFn = batchFn;
  
  if (useCacheManager && cachePrefix) {
    wrappedBatchFn = async (keys: readonly K[]) => {
      // Convert all keys to strings for caching
      const keyStrings = keys.map(k => String(k));
      
      // Try to get from CacheManager first
      const cachedResults = await CacheManager.getBulk<V>(
        cachePrefix,
        keyStrings
      );
      
      // Determine which keys we need to fetch from the database
      const missingKeys: K[] = [];
      const missingIndices: number[] = [];
      const results: (V | Error | null)[] = Array(keys.length).fill(null);
      
      keys.forEach((key, idx) => {
        const keyString = String(key);
        if (cachedResults[keyString]) {
          results[idx] = cachedResults[keyString];
        } else {
          missingKeys.push(key);
          missingIndices.push(idx);
        }
      });
      
      // If all items were in cache, return immediately
      if (missingKeys.length === 0) {
        return results;
      }
      
      // Fetch the missing keys from the database
      const fetchedResults = await batchFn(missingKeys);
      
      // Combine cached and fetched results, and cache the fetched results
      const itemsToCache: Array<{ id: string; value: V }> = [];
      
      missingIndices.forEach((originalIdx, fetchIdx) => {
        const fetchedResult = fetchedResults[fetchIdx];
        results[originalIdx] = fetchedResult;
        
        // Cache the valid results
        if (fetchedResult && !(fetchedResult instanceof Error)) {
          const key = String(missingKeys[fetchIdx]);
          itemsToCache.push({ id: key, value: fetchedResult });
        }
      });
      
      // Store fetched results in CacheManager
      if (itemsToCache.length > 0) {
        CacheManager.setBulk(cachePrefix, itemsToCache, undefined, { ttl: cacheTTL });
      }
      
      return results;
    };
  }
  
  // Create the DataLoader with wrapped batch function
  return new DataLoader(
    createBatchFn(wrappedBatchFn, {
      onError: (error, keys) => {
        console.error(`DataLoader error for ${keys.length} keys:`, error);
      },
      errorMapper: (error, key) => {
        if (error instanceof PrismaClientKnownRequestError) {
          return new Error(`Database error (${error.code}) for key: ${String(key)}`);
        }
        return new Error(`Failed to load key: ${String(key)}`);
      },
    }),
    {
      maxBatchSize,
      cache,
      cacheKeyFn,
    }
  );
}

/**
 * Create the full set of DataLoaders for our application
 */
export function createLoaders(prisma: PrismaClient) {
  return {
    // Loader for tokens by ID
    tokenLoader: createDataLoader<string, Token | null>(
      async (ids: readonly string[]) => {
        console.log(`Batch loading ${ids.length} tokens by ID`);
        const tokens = await prisma.token.findMany({
          where: { id: { in: [...ids] } },
        });

        // Map the results back to the requested order
        return ids.map(id => tokens.find(token => token.id === id) || null);
      },
      {
        maxBatchSize: BATCH_SIZES.TOKENS,
        useCacheManager: true,
        cachePrefix: CachePrefix.TOKEN,
      }
    ),

    // Loader for tokens by address (lowercase for consistency)
    tokenByAddressLoader: createDataLoader<string, Token | null>(
      async (addresses: readonly string[]) => {
        console.log(`Batch loading ${addresses.length} tokens by address`);
        const lowerCaseAddresses = addresses.map(a => a?.toLowerCase() || '');
        const tokens = await prisma.token.findMany({
          where: { address: { in: lowerCaseAddresses } },
        });

        // Map the results back to the requested order
        return addresses.map(address => 
          tokens.find(token => token.address === (address?.toLowerCase() || '')) || null
        );
      },
      {
        maxBatchSize: BATCH_SIZES.TOKENS,
        cacheKeyFn: (addr: string) => addr?.toLowerCase() || '',
      }
    ),

    // Loader for token prices by ID
    tokenPriceLoader: createDataLoader<string, string>(
      async (tokenIds: readonly string[]) => {
        console.log(`Batch loading ${tokenIds.length} token prices`);
        
        // Import and use the TokenPriceService
        const { TokenPriceService } = require('@/src/lib/services/tokenPriceService');
        const pricesResult = await TokenPriceService.getTokenPricesUSDBulk([...tokenIds]);
        
        // Map the results back to the requested order
        return tokenIds.map(id => pricesResult[id] || '0');
      },
      {
        maxBatchSize: BATCH_SIZES.PRICES,
        useCacheManager: true,
        cachePrefix: CachePrefix.PRICE,
        cacheTTL: 10, // Short TTL for prices
      }
    ),

    // Loader for pairs by ID
    pairLoader: createDataLoader<string, Pair | null>(
      async (ids: readonly string[]) => {
        console.log(`Batch loading ${ids.length} pairs by ID`);
        const pairs = await prisma.pair.findMany({
          where: { id: { in: [...ids] } },
        });

        // Map the results back to the requested order
        return ids.map(id => pairs.find(pair => pair.id === id) || null);
      },
      {
        maxBatchSize: BATCH_SIZES.PAIRS,
        useCacheManager: true,
        cachePrefix: CachePrefix.PAIR,
      }
    ),

    // Loader for pairs by address (lowercase for consistency)
    pairByAddressLoader: createDataLoader<string, Pair | null>(
      async (addresses: readonly string[]) => {
        console.log(`Batch loading ${addresses.length} pairs by address`);
        const lowerCaseAddresses = addresses.map(a => a?.toLowerCase() || '');
        const pairs = await prisma.pair.findMany({
          where: { address: { in: lowerCaseAddresses } },
        });

        // Map the results back to the requested order
        return addresses.map(address => 
          pairs.find(pair => pair.address === (address?.toLowerCase() || '')) || null
        );
      },
      {
        maxBatchSize: BATCH_SIZES.PAIRS,
        cacheKeyFn: (addr: string) => addr?.toLowerCase() || '',
      }
    ),

    // Loader for reserveUSD by pair ID
    reserveUSDLoader: createDataLoader<string, string>(
      async (pairIds: readonly string[]) => {
        console.log(`Batch loading ${pairIds.length} reserveUSD values`);
        
        // First try to get from cache in batch
        const cachedValues = await getCachedPairReserveUSDBulk([...pairIds]);

        // Identify which IDs need to be fetched from DB
        const missingIds = pairIds.filter(id => !cachedValues[id]);

        if (missingIds.length === 0) {
          // All values were in cache
          return pairIds.map(id => cachedValues[id] || '0');
        }

        // Get snapshots for missing IDs in one query
        const snapshots = await prisma.pairReserveSnapshot.findMany({
          where: { pairId: { in: [...missingIds] } },
          orderBy: { timestamp: 'desc' },
          distinct: ['pairId'],
        });

        // Create a map of snapshotted values
        const snapshotValues = snapshots.reduce(
          (acc, snapshot) => {
            acc[snapshot.pairId] = snapshot.reserveUSD;
            return acc;
          },
          {} as Record<string, string>
        );

        // Return results in correct order
        return pairIds.map(id => cachedValues[id] || snapshotValues[id] || '0');
      },
      {
        maxBatchSize: BATCH_SIZES.PAIRS,
        useCacheManager: true,
        cachePrefix: CachePrefix.PAIR,
        cacheTTL: 300, // 5 minutes
      }
    ),

    // Loader for user statistics by address
    userStatsLoader: createDataLoader<string, UserStat | null>(
      async (addresses: readonly string[]) => {
        console.log(`Batch loading ${addresses.length} user stats`);
        const lowerCaseAddresses = addresses.map(a => a?.toLowerCase() || '');
        
        const userStats = await prisma.userStat.findMany({
          where: { userAddress: { in: lowerCaseAddresses } },
        });

        // Map the results back to the requested order
        return addresses.map(address => 
          userStats.find(stat => stat.userAddress === (address?.toLowerCase() || '')) || null
        );
      },
      {
        maxBatchSize: BATCH_SIZES.USERS,
        cacheKeyFn: (addr: string) => addr?.toLowerCase() || '',
        useCacheManager: true,
        cachePrefix: CachePrefix.USER,
        cacheTTL: 60 * 30, // 30 minutes
      }
    ),
  };
}

// Define the type for our loaders
export type Loaders = ReturnType<typeof createLoaders>; 