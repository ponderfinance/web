/**
 * Redis Connection Recovery Utilities - SERVER SIDE ONLY
 * 
 * This module provides utilities for recovering from Redis connection failures.
 * It should ONLY be used in server environments, never in the browser.
 *
 * @deprecated This module is maintained for backward compatibility
 * The singleton pattern handles connection recovery automatically
 */

import { getRedisSingleton } from './singleton';
import type Redis from 'ioredis';

// Track monitoring state
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Initialize Redis recovery monitor
 * @deprecated The singleton handles connection recovery automatically
 */
export function initRedisRecovery(intervalMs = 30000): void {
  // Safety check: never run in browser
  if (typeof window !== 'undefined') {
    console.error('[CRITICAL] Attempted to initialize Redis recovery in browser environment');
    console.warn('This is a server-side utility and should never be imported in client components');
    return;
  }
  
  console.warn('[REDIS] initRedisRecovery is deprecated - the singleton handles recovery');
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // Set up health check interval that just calls the singleton to ensure it's initialized
  healthCheckInterval = setInterval(() => {
    try {
      getRedisSingleton().getRedisClient();
    } catch (error) {
      console.error('[REDIS] Health check error:', error);
    }
  }, intervalMs);

  console.log(`[REDIS] Legacy Redis recovery initialized with ${intervalMs}ms interval`);
}

/**
 * Stop the recovery monitor
 * @deprecated The singleton handles connection recovery automatically
 */
export function stopRedisRecovery(): void {
  // Safety check: never run in browser
  if (typeof window !== 'undefined') {
    return;
  }
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[REDIS] Legacy Redis recovery monitoring stopped');
  }
}

/**
 * Safe Redis operation wrapper that handles connection failures
 */
export async function withRedisRecovery<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  // Safety check: never run in browser
  if (typeof window !== 'undefined') {
    console.error('[CRITICAL] Attempted to use Redis recovery in browser environment');
    return fallback;
  }
  
  try {
    // Get Redis client from the singleton
    const redis = getRedisSingleton().getRedisClient();
    if (!redis) return fallback;
    
    return await operation(redis);
  } catch (error) {
    console.error('[SERVER] Error executing Redis operation:', error);
    return fallback;
  }
} 