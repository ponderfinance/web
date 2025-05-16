/**
 * Redis Connection Recovery Utilities
 * 
 * This module provides utilities for recovering from Redis connection failures
 * in the frontend application. It implements a more robust reconnection strategy
 * than the basic Redis client configuration.
 */

import { getRedisClient } from './client';
import Redis from 'ioredis';

// Track connection state
let isReconnecting = false;
let reconnectAttempts = 0;
let healthCheckInterval: NodeJS.Timeout | null = null;
const MAX_RECONNECT_ATTEMPTS = 5;

// Store original Redis client for reference
let originalRedisClient: Redis | null = null;

/**
 * Initialize Redis recovery monitor
 * This sets up periodic health checks and reconnection logic
 */
export function initRedisRecovery(intervalMs = 30000): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // Store reference to the original client
  try {
    originalRedisClient = getRedisClient();
  } catch (error) {
    console.error('[Redis Recovery] Failed to get initial Redis client:', error);
  }

  // Set up health check interval
  healthCheckInterval = setInterval(() => {
    checkRedisHealth();
  }, intervalMs);

  console.log(`[Redis Recovery] Initialized with ${intervalMs}ms interval`);
}

/**
 * Stop the recovery monitor
 */
export function stopRedisRecovery(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[Redis Recovery] Redis recovery monitoring stopped');
  }
}

/**
 * Check Redis health and attempt recovery if needed
 */
async function checkRedisHealth(): Promise<boolean> {
  // Don't run multiple reconnection attempts simultaneously
  if (isReconnecting) return false;

  try {
    const redis = getRedisClient();
    const pingResult = await redis.ping();
    
    if (pingResult === 'PONG') {
      // Connection is healthy, reset state
      reconnectAttempts = 0;
      return true;
    } else {
      console.warn(`[Redis Recovery] Unexpected ping response: ${pingResult}`);
      return await attemptReconnection();
    }
  } catch (error) {
    console.error('[Redis Recovery] Redis health check failed:', error);
    return await attemptReconnection();
  }
}

/**
 * Attempt to reconnect to Redis
 */
async function attemptReconnection(): Promise<boolean> {
  if (isReconnecting) return false;
  isReconnecting = true;

  try {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`[Redis Recovery] Attempting Redis reconnection (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

      // Get a reference to the redis module to access internal functions
      const redisModule = require('./client');
      
      // Clean up existing connections if possible
      try {
        if (originalRedisClient) {
          originalRedisClient.disconnect();
        }
        
        // Reset the client reference to force recreation on next getRedisClient() call
        if (typeof redisModule._resetRedisClient === 'function') {
          redisModule._resetRedisClient();
        } else {
          // Try to access the underlying client variable and reset it
          // Note: This is a fallback and might not work if the module structure changes
          (redisModule as any).redisClient = null;
        }
      } catch (cleanupError) {
        console.error('[Redis Recovery] Error cleaning up Redis connections:', cleanupError);
      }

      // Try to get a new client
      try {
        const newClient = getRedisClient();
        const pingResult = await newClient.ping();
        
        if (pingResult === 'PONG') {
          console.log('[Redis Recovery] Successfully reconnected to Redis');
          originalRedisClient = newClient;
          isReconnecting = false;
          return true;
        } else {
          throw new Error(`Unexpected ping response after reconnection: ${pingResult}`);
        }
      } catch (reconnectError) {
        console.error('[Redis Recovery] Reconnection attempt failed:', reconnectError);
        isReconnecting = false;
        return false;
      }
    } else {
      console.error(`[Redis Recovery] Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      isReconnecting = false;
      return false;
    }
  } catch (error) {
    console.error('[Redis Recovery] Unexpected error in reconnection flow:', error);
    isReconnecting = false;
    return false;
  }
}

/**
 * Safe Redis operation wrapper that handles connection failures
 * @param operation Function that performs Redis operations
 * @param fallback Value to return if the operation fails
 */
export async function withRedisRecovery<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    const redis = getRedisClient();
    return await operation(redis);
  } catch (error) {
    console.error('[Redis Recovery] Error executing Redis operation:', error);
    
    // Attempt reconnection in the background
    checkRedisHealth().catch(err => {
      console.error('[Redis Recovery] Error during health check after failed operation:', err);
    });
    
    return fallback;
  }
} 