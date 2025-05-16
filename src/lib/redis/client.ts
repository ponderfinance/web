import Redis from 'ioredis'

// Single Redis client instance
let redisClient: Redis | null = null
let connectionAttempts = 0
const MAX_CONNECTION_ATTEMPTS = 3

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
 * Get or create a Redis client - ensures a singleton pattern
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || process.env.NEXT_PUBLIC_REDIS_URL || 'redis://localhost:6379'
    console.log(`Connecting to Redis at ${redisUrl.split('@').pop()}`) // Safe logging without credentials

    connectionAttempts++
    
    try {
      redisClient = new Redis(redisUrl, {
        retryStrategy: (times) => {
          // Retry connection with exponential backoff
          return Math.min(times * 50, 2000)
        },
        maxRetriesPerRequest: 3,
        connectTimeout: 10000, // 10 seconds
        enableOfflineQueue: true,
        enableReadyCheck: true,
      })

      redisClient.on('error', (err) => {
        console.error('Redis connection error:', err)
        
        // Reset client on critical errors to force reconnection on next access
        if (err.message.includes('ECONNREFUSED') || 
            err.message.includes('Connection timed out') ||
            err.message.includes('Redis connection lost')) {
          _resetRedisClient()
        }
      })

      redisClient.on('connect', () => {
        console.log('Successfully connected to Redis')
        // Reset connection attempts on successful connection
        connectionAttempts = 0
      })
      
      redisClient.on('reconnecting', () => {
        console.log('Reconnecting to Redis...')
      })

      // Verify connection with a ping
      redisClient
        .ping()
        .then((response) => {
          console.log(`Redis ping response: ${response}`)
        })
        .catch((err) => {
          console.error('Redis ping failed:', err)
        })
    } catch (error) {
      console.error('Error creating Redis client:', error)
      // Return a dummy Redis client that gracefully fails for all operations
      if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        console.error(`Failed to connect to Redis after ${connectionAttempts} attempts. Using fallback client.`)
        return createFallbackClient()
      }
      throw error
    }
  }

  return redisClient
}

/**
 * Reset the Redis client - forces reconnection on next getRedisClient call
 * This function is used by the recovery module
 */
export function _resetRedisClient(): void {
  if (redisClient) {
    try {
      redisClient.disconnect()
    } catch (error) {
      console.error('Error disconnecting Redis client:', error)
    }
    redisClient = null
  }
}

/**
 * Create a fallback Redis client for use when Redis is unavailable
 * This implements a minimal subset of the Redis interface to prevent application crashes
 */
function createFallbackClient(): Redis {
  // Create a mock object that implements the Redis interface
  const fallback = {
    get: async () => null,
    set: async () => 'OK',
    mget: async () => [],
    ping: async () => 'DUMMY',
    on: () => fallback,
    disconnect: () => {},
  } as unknown as Redis
  
  console.warn('Using Redis fallback client - data will not be cached!')
  return fallback
}

/**
 * Read protocol metrics from Redis in a consistent way
 * This handles the fetching and type conversion for all metrics
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

// For testing and development - close the connection
export function closeRedisConnection() {
  if (redisClient) {
    redisClient.disconnect()
    redisClient = null
  }
}

/**
 * Clear all protocol metrics from Redis cache
 * This can be used to fix stale data issues 
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
