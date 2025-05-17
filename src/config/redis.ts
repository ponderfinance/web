/**
 * UNIVERSAL REDIS CONNECTION MANAGER
 * --------------------------------
 * This is the ONLY place Redis connections should be created in the entire application.
 * All other files should import from this module.
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { ConnectionState, ConnectionEvent } from '../lib/redis/singleton';

// ========================= GLOBAL SINGLETON STATE =============================
// These variables ensure that only one Redis client and subscriber exist globally
let __GLOBAL_REDIS_CLIENT: Redis | null = null;
let __GLOBAL_REDIS_SUBSCRIBER: Redis | null = null;
const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(100);

// Connection state tracking
let lastConnectionAttempt = 0;
let connectionRetryCount = 0;
let isShuttingDown = false;
let activeConnections = 0;

// ========================= CONFIGURATION ====================================
export const REDIS_CONFIG = {
  // Connection settings
  maxRetriesPerRequest: 10,       // Increased from 5 to handle more retries
  connectTimeoutMs: 30000,        // Increased to 30 seconds
  keepAliveMs: 120000,            // Increased to 120 seconds to prevent disconnections
  
  // Recovery settings
  maxSuspensionTimeMs: 120000,    // 2 minutes suspension after failures
  maxRetryAttempts: 15,           // Max retry attempts before suspending (increased from 10)
  retryTimeoutMs: 20000,          // 20 second timeout for operations (increased from 10)
  
  // Backoff settings
  initialRetryDelayMs: 2000,      // Start with 2 second delay (increased from 1)
  maxRetryDelayMs: 60000,         // Maximum 60 second delay (increased from 30)
  backoffFactor: 1.5,             // Exponential backoff factor (reduced from 2 for more gradual increase)
  minReconnectDelay: 5000,        // Minimum time between connection attempts (increased from 3000)
  
  // Heartbeat
  heartbeatIntervalMs: 30000,     // Increased to 30 seconds to reduce load on Redis
  
  // Debug options
  debugMode: true                // Enable detailed logging for Redis operations
};

/**
 * Get the Redis subscriber instance
 * Used for PubSub subscriptions
 */
export function getRedisSubscriber(): Redis | null {
  return getRedisClient(true);
}

/**
 * Get event emitter for connection status events
 */
export function getRedisEventEmitter(): EventEmitter {
  return eventEmitter;
}

/**
 * Register a component as using Redis connections
 */
export function registerRedisConnection(): void {
  activeConnections++;
  // console.log(`[REDIS] Connection registered (total: ${activeConnections})`);
}

/**
 * Unregister a component using Redis connections
 */
export function unregisterRedisConnection(): boolean {
  activeConnections = Math.max(0, activeConnections - 1);
  // console.log(`[REDIS] Connection unregistered (remaining: ${activeConnections})`);
  
  // Return whether this was the last connection
  return activeConnections === 0;
}

/**
 * Get or create a Redis client instance
 * ALWAYS use this function instead of creating new Redis instances!
 */
export function getRedisClient(forSubscriber = false): Redis | null {
  if (typeof window !== 'undefined') {
    console.warn('[REDIS] Direct Redis client not available in browser');
    return null;
  }
  
  // Return existing client if available and healthy
  if (!forSubscriber && __GLOBAL_REDIS_CLIENT?.status === 'ready') {
    if (REDIS_CONFIG.debugMode) {
      console.log('[REDIS] Using existing client connection');
    }
    return __GLOBAL_REDIS_CLIENT;
  }
  
  // Return existing subscriber if available and healthy
  if (forSubscriber && __GLOBAL_REDIS_SUBSCRIBER?.status === 'ready') {
    if (REDIS_CONFIG.debugMode) {
      console.log('[REDIS] Using existing subscriber connection');
    }
    return __GLOBAL_REDIS_SUBSCRIBER;
  }
  
  // Prevent connection storms by enforcing a minimum delay between attempts
  const now = Date.now();
  if (now - lastConnectionAttempt < REDIS_CONFIG.minReconnectDelay) {
    console.log(`[REDIS] Throttling connection attempt (${Math.round((now - lastConnectionAttempt)/1000)}s since last attempt)`);
    return forSubscriber ? __GLOBAL_REDIS_SUBSCRIBER : __GLOBAL_REDIS_CLIENT;
  }
  
  // Update attempt timestamp
  lastConnectionAttempt = now;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('[REDIS] No Redis URL provided in environment');
    return null;
  }
  
  try {
    console.log(`[REDIS] Creating new ${forSubscriber ? 'subscriber' : 'client'} instance`);
    
    // Close existing connection if it exists but is not in READY state
    if (forSubscriber && __GLOBAL_REDIS_SUBSCRIBER) {
      if (__GLOBAL_REDIS_SUBSCRIBER.status !== 'ready') {
        try {
          __GLOBAL_REDIS_SUBSCRIBER.disconnect();
          __GLOBAL_REDIS_SUBSCRIBER = null;
        } catch (err) {
          console.error('[REDIS] Error disconnecting existing subscriber:', err);
        }
      } else {
        // If it's ready, just return it
        return __GLOBAL_REDIS_SUBSCRIBER;
      }
    } else if (!forSubscriber && __GLOBAL_REDIS_CLIENT) {
      if (__GLOBAL_REDIS_CLIENT.status !== 'ready') {
        try {
          __GLOBAL_REDIS_CLIENT.disconnect();
          __GLOBAL_REDIS_CLIENT = null;
        } catch (err) {
          console.error('[REDIS] Error disconnecting existing client:', err);
        }
      } else {
        // If it's ready, just return it
        return __GLOBAL_REDIS_CLIENT;
      }
    }
    
    // Create new connection with improved settings to prevent ECONNRESET issues
    const redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        connectionRetryCount = times;
        
        if (times > REDIS_CONFIG.maxRetryAttempts || isShuttingDown) {
          console.log(`[REDIS] Max retries (${times}) exceeded`);
          eventEmitter.emit(ConnectionEvent.SUSPENDED, { timestamp: Date.now() });
          return null; // Stop retrying
        }
        
        const delay = Math.min(
          REDIS_CONFIG.initialRetryDelayMs * Math.pow(REDIS_CONFIG.backoffFactor, times),
          REDIS_CONFIG.maxRetryDelayMs
        );
        
        console.log(`[REDIS] Retry in ${Math.round(delay)}ms (attempt ${times}/${REDIS_CONFIG.maxRetryAttempts})`);
        return delay;
      },
      maxRetriesPerRequest: REDIS_CONFIG.maxRetriesPerRequest,
      connectTimeout: REDIS_CONFIG.connectTimeoutMs,
      keepAlive: REDIS_CONFIG.keepAliveMs,
      commandTimeout: REDIS_CONFIG.retryTimeoutMs,  // Add command timeout
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectionName: forSubscriber ? 'ponder-subscriber' : 'ponder-client',
      noDelay: true,
      reconnectOnError: (err) => {
        // Special handling for ECONNRESET to avoid connection storms
        if (err.message.includes('ECONNRESET')) {
          console.warn('[REDIS] ECONNRESET detected, controlled reconnect');
          
          // Add a delay to prevent connection storms
          setTimeout(() => {
            lastConnectionAttempt = 0; // Allow immediate retry after delay
          }, 2000 * (connectionRetryCount + 1));
          
          return true; // Allow reconnection for ECONNRESET errors
        }
        
        // Check if connection should be closed
        if (err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT')) {
          console.error(`[REDIS] Fatal connection error: ${err.message}`);
          return false; // Don't reconnect on fatal errors
        }
        
        // For other errors, allow automatic reconnection
        console.error('[REDIS] Connection error with auto-reconnect:', err.message);
        return true;
      }
    });
    
    // Set up event handlers
    redis.on('connect', () => {
      console.log(`[REDIS] ${forSubscriber ? 'Subscriber' : 'Client'} connected successfully`);
      connectionRetryCount = 0; // Reset retry count on successful connection
      eventEmitter.emit(ConnectionEvent.CONNECTED, { timestamp: Date.now() });
    });
    
    redis.on('error', (err) => {
      console.error(`[REDIS] ${forSubscriber ? 'Subscriber' : 'Client'} connection error:`, err);
      eventEmitter.emit(ConnectionEvent.ERROR, { error: err.message, timestamp: Date.now() });
    });
    
    redis.on('close', () => {
      console.log(`[REDIS] ${forSubscriber ? 'Subscriber' : 'Client'} connection closed`);
      eventEmitter.emit(ConnectionEvent.DISCONNECTED, { timestamp: Date.now() });
    });
    
    // Heartbeat to keep connection alive and detect issues early
    const heartbeatInterval = setInterval(() => {
      if (redis.status === 'ready') {
        redis.ping()
          .then(() => {
            if (REDIS_CONFIG.debugMode) {
              console.log('[REDIS] Heartbeat ping successful');
            }
          })
          .catch(err => {
            console.error('[REDIS] Heartbeat ping failed:', err);
            
            // If connection fails heartbeat, force reconnection
            if (forSubscriber && __GLOBAL_REDIS_SUBSCRIBER === redis) {
              __GLOBAL_REDIS_SUBSCRIBER = null;
            } else if (!forSubscriber && __GLOBAL_REDIS_CLIENT === redis) {
              __GLOBAL_REDIS_CLIENT = null;
            }
          });
      }
    }, REDIS_CONFIG.heartbeatIntervalMs);
    
    // Clean up heartbeat on close
    redis.on('end', () => {
      clearInterval(heartbeatInterval);
    });
    
    // Store in global reference to enforce singleton pattern
    if (forSubscriber) {
      __GLOBAL_REDIS_SUBSCRIBER = redis;
    } else {
      __GLOBAL_REDIS_CLIENT = redis;
    }
    
    return redis;
  } catch (error) {
    console.error(`[REDIS] Error creating ${forSubscriber ? 'subscriber' : 'client'}:`, error);
    return null;
  }
}

/**
 * Gracefully shut down all Redis connections
 */
export function shutdownRedisConnections(): Promise<void> {
  isShuttingDown = true;
  
  return new Promise((resolve) => {
    const cleanup = async () => {
      // Clean up subscriber
      if (__GLOBAL_REDIS_SUBSCRIBER) {
        try {
          await __GLOBAL_REDIS_SUBSCRIBER.quit();
        } catch (err) {
          console.error('[REDIS] Error closing subscriber:', err);
        }
        __GLOBAL_REDIS_SUBSCRIBER = null;
      }
      
      // Clean up client
      if (__GLOBAL_REDIS_CLIENT) {
        try {
          await __GLOBAL_REDIS_CLIENT.quit();
        } catch (err) {
          console.error('[REDIS] Error closing client:', err);
        }
        __GLOBAL_REDIS_CLIENT = null;
      }
      
      resolve();
    };
    
    // Clean up immediately or after delay if there are active connections
    if (activeConnections > 0) {
      console.log(`[REDIS] Waiting for ${activeConnections} connections to close`);
      setTimeout(cleanup, 3000);
    } else {
      cleanup();
    }
  });
}

// Handle process exit gracefully
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    console.log('[REDIS] SIGTERM received, cleaning up connections');
    shutdownRedisConnections();
  });
  
  process.on('SIGINT', () => {
    console.log('[REDIS] SIGINT received, cleaning up connections');
    shutdownRedisConnections();
  });
}

// Initialize Redis on first import
// console.log('[REDIS] Universal connection manager initialized');