/**
 * Redis Client Compatibility Layer
 * 
 * This file provides backward compatibility for older imports.
 * It simply re-exports functions from the centralized Redis configuration.
 */

import { getRedisClient as getRedisClientFromConfig } from '@/src/config/redis';

/**
 * Get the Redis client instance
 * @deprecated Import from '@/src/lib/redis' instead
 */
export function getRedisClient() {
  // Forward to the new implementation
  return getRedisClientFromConfig();
} 