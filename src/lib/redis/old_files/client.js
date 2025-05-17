/**
 * Redis Client - SERVER SIDE ONLY
 * This module should never be imported directly in client components.
 * Only use this in server-side API routes or server components.
 */

// Add more debug logs to track Redis connections
let redisClient = null;

export function getRedisClient() {
  // SAFETY CHECK: Never run this code on the client side
  if (typeof window !== 'undefined') {
    console.error('[CRITICAL] Attempted to create Redis client in browser environment');
    throw new Error('Redis connections are not supported in browser environments. Use the SSE API instead.');
  }
  
  if (!redisClient) {
    try {
      console.log('[SERVER] Creating new Redis client instance');
      const Redis = require('ioredis');
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        console.error('[SERVER] No Redis URL provided in environment variable REDIS_URL');
        throw new Error('Redis URL not configured');
      }
      
      console.log(`[SERVER] Connecting to Redis at: ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`); 
      redisClient = new Redis(redisUrl);
      
      // Add event listeners to debug connection issues
      redisClient.on('connect', () => {
        console.log('[SERVER] Successfully connected to Redis');
      });
      
      redisClient.on('error', (error) => {
        console.error('[SERVER] Redis connection error:', error);
      });
    } catch (error) {
      console.error('[SERVER] Error creating Redis client:', error);
      throw error;
    }
  }
  return redisClient;
}

/**
 * Reset the Redis client - used by recovery systems
 * This function is exported for testing and recovery purposes
 */
export function _resetRedisClient() {
  if (redisClient) {
    try {
      redisClient.disconnect();
    } catch (error) {
      console.error('[SERVER] Error disconnecting Redis client:', error);
    }
    redisClient = null;
  }
} 