/**
 * Redis Connection Recovery Utilities - SERVER SIDE ONLY
 * 
 * This module provides utilities for recovering from Redis connection failures.
 * It should ONLY be used in server environments, never in the browser.
 */

import { getRedisClient, _resetRedisClient } from './client';
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
 * 
 * IMPORTANT: This should only be called in server environments
 */
export function initRedisRecovery(intervalMs = 30000): void {
  // Safety check: never run in browser
  if (typeof window !== 'undefined') {
    console.error('[CRITICAL] Attempted to initialize Redis recovery in browser environment');
    console.warn('This is a server-side utility and should never be imported in client components');
    return;
  }
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // Store reference to the original client
  try {
    originalRedisClient = getRedisClient();
    console.log('[SERVER] Redis recovery system initialized with existing client');
  } catch (error) {
    console.error('[SERVER] Failed to get initial Redis client:', error);
    return; // Don't continue if we can't get the initial client
  }

  // Set up health check interval
  healthCheckInterval = setInterval(() => {
    checkRedisHealth();
  }, intervalMs);

  console.log(`[SERVER] Redis recovery initialized with ${intervalMs}ms interval`);
}

/**
 * Stop the recovery monitor
 */
export function stopRedisRecovery(): void {
  // Safety check: never run in browser
  if (typeof window !== 'undefined') {
    return;
  }
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[SERVER] Redis recovery monitoring stopped');
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
      console.warn(`[SERVER] Unexpected ping response: ${pingResult}`);
      return await attemptReconnection();
    }
  } catch (error) {
    console.error('[SERVER] Redis health check failed:', error);
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
      console.log(`[SERVER] Attempting Redis reconnection (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

      // Clean up existing connections if possible
      try {
        if (originalRedisClient) {
          originalRedisClient.disconnect();
        }
        
        // Reset the client reference to force recreation on next getRedisClient() call
        _resetRedisClient();
      } catch (cleanupError) {
        console.error('[SERVER] Error cleaning up Redis connections:', cleanupError);
      }

      // Try to get a new client
      try {
        const newClient = getRedisClient();
        const pingResult = await newClient.ping();
        
        if (pingResult === 'PONG') {
          console.log('[SERVER] Successfully reconnected to Redis');
          originalRedisClient = newClient;
          isReconnecting = false;
          return true;
        } else {
          throw new Error(`Unexpected ping response after reconnection: ${pingResult}`);
        }
      } catch (reconnectError) {
        console.error('[SERVER] Reconnection attempt failed:', reconnectError);
        isReconnecting = false;
        return false;
      }
    } else {
      console.error(`[SERVER] Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      isReconnecting = false;
      return false;
    }
  } catch (error) {
    console.error('[SERVER] Unexpected error in reconnection flow:', error);
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
  // Safety check: never run in browser
  if (typeof window !== 'undefined') {
    console.error('[CRITICAL] Attempted to use Redis recovery in browser environment');
    return fallback;
  }
  
  try {
    const redis = getRedisClient();
    return await operation(redis);
  } catch (error) {
    console.error('[SERVER] Error executing Redis operation:', error);
    
    // Attempt reconnection in the background
    checkRedisHealth().catch(err => {
      console.error('[SERVER] Error during health check after failed operation:', err);
    });
    
    return fallback;
  }
} 