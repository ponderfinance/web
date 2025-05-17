import { getRedisSingleton } from '@/src/lib/redis/singleton';

/**
 * REDIS CONNECTION MANAGEMENT - APPLICATION CONFIGURATION
 * ------------------------------------------------------
 * This module initializes the Redis singleton with optimal configuration
 * and acts as the central point for Redis connection configuration.
 * 
 * IMPORTANT:
 * - Import this module in app startup to ensure Redis is properly configured
 * - Never create direct Redis connections anywhere else in the code
 * - Always use the Redis API from 'src/lib/redis/index.ts'
 * - The singleton handles reconnection, backoff, and error recovery
 */

/**
 * Initialize Redis configuration with optimal settings for stability
 * This should be imported at app startup to ensure proper configuration
 */
export function initializeRedisConfig() {
  const redisSingleton = getRedisSingleton();
  
  // Configure with optimized settings for stability
  redisSingleton.configure({
    // Connection settings
    maxRetriesPerRequest: 3,       // Limit retries per operation
    connectTimeoutMs: 15000,       // 15 seconds connection timeout
    keepAliveMs: 45000,            // 45 second keepalive to prevent ECONNRESET
    
    // Recovery settings
    maxSuspensionTimeMs: 60000,    // 1 minute suspension after failures
    maxRetryAttempts: 5,           // Max 5 retry attempts before suspending
    retryTimeoutMs: 10000          // 10 second timeout for operations
  });
  
  console.log('[CONFIG] Redis singleton configured with optimal stability settings');
  
  return redisSingleton;
}

// Export configured instance for convenience
export const redisSingleton = initializeRedisConfig();

/**
 * USAGE GUIDE
 * -----------
 * To use Redis in your application:
 * 
 * 1. Import Redis functions from the main index:
 *    ```
 *    import { getKey, setKey, getMultipleKeys } from '@/src/lib/redis';
 *    ```
 * 
 * 2. Use these functions instead of direct Redis client access:
 *    ```
 *    // Good practice - uses the singleton
 *    const value = await getKey('cache:key');
 *    
 *    // Avoid this - creates potential connection problems
 *    const redis = new Redis(...); // DON'T DO THIS
 *    ```
 * 
 * 3. For subscription functionality, use the RedisSubscriberProvider
 *    This component handles real-time updates through SSE.
 */ 