/**
 * Redis Connection Manager
 * 
 * Strictly controls Redis connections to prevent connection storms.
 * This enforces a true singleton pattern and adds mandatory delays between retries.
 */
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { ConnectionState, ConnectionEvent } from './singleton';

// The real single connection for the entire application
let globalRedisInstance: Redis | null = null;
const eventEmitter = new EventEmitter();

// Connection management
let connectionAttempts = 0;
let lastConnectionAttempt = 0;
let connectionState = ConnectionState.DISCONNECTED;

// Configuration options
const MAX_CONNECTIONS = 1; // Strict single connection
const RETRY_DELAY_MS = 5000; // 5 seconds between retries
const MAX_RETRIES = 5; // Maximum retry attempts before entering suspended state
const SUSPENSION_TIME_MS = 60000; // 1 minute suspension

// Management functions
let inProgressConnectionPromise: Promise<Redis | null> | null = null;

/**
 * Get the single Redis connection for the entire application.
 * This ensures only ONE Redis connection exists at any time.
 */
export async function getRedisConnection(): Promise<Redis | null> {
  // Prevent multiple calls from creating multiple connections
  if (inProgressConnectionPromise) {
    return inProgressConnectionPromise;
  }
  
  // Return existing connection if it's already established
  if (globalRedisInstance) {
    if (globalRedisInstance.status === 'ready') {
      return globalRedisInstance;
    }
    
    // If connection exists but isn't ready, close it to start fresh
    try {
      globalRedisInstance.disconnect();
    } catch (err) {
      console.error('[REDIS-STRICT] Error disconnecting stale connection:', err);
    }
    globalRedisInstance = null;
  }
  
  // Enforce retry delay to prevent connection storms
  const now = Date.now();
  const timeSinceLastAttempt = now - lastConnectionAttempt;
  
  if (timeSinceLastAttempt < RETRY_DELAY_MS) {
    console.log(`[REDIS-STRICT] Rate limiting connection attempt. Next attempt in ${Math.round((RETRY_DELAY_MS - timeSinceLastAttempt)/1000)}s`);
    
    // Return null if we're in the delay period
    return null;
  }
  
  // Check if we're in suspended state
  if (connectionState === ConnectionState.SUSPENDED) {
    if (now - lastConnectionAttempt < SUSPENSION_TIME_MS) {
      console.log(`[REDIS-STRICT] Connection is suspended. Resume in ${Math.round((SUSPENSION_TIME_MS - (now - lastConnectionAttempt))/1000)}s`);
      return null;
    } else {
      // Reset state after suspension period
      connectionState = ConnectionState.DISCONNECTED;
      connectionAttempts = 0;
    }
  }
  
  // Update attempt tracking
  lastConnectionAttempt = now;
  connectionAttempts++;
  
  // Update state
  if (connectionState !== ConnectionState.CONNECTING) {
    connectionState = ConnectionState.CONNECTING;
    eventEmitter.emit(ConnectionEvent.RECONNECTING, { timestamp: now, attempts: connectionAttempts });
  }
  
  // Check max retries
  if (connectionAttempts > MAX_RETRIES) {
    console.log(`[REDIS-STRICT] Maximum connection attempts (${MAX_RETRIES}) reached. Suspending for ${SUSPENSION_TIME_MS/1000}s`);
    connectionState = ConnectionState.SUSPENDED;
    eventEmitter.emit(ConnectionEvent.SUSPENDED, { timestamp: now, resumeAfter: SUSPENSION_TIME_MS });
    return null;
  }
  
  // Create a single promise for all concurrent requests
  inProgressConnectionPromise = createRedisConnection();
  
  try {
    const result = await inProgressConnectionPromise;
    inProgressConnectionPromise = null;
    return result;
  } catch (error) {
    inProgressConnectionPromise = null;
    return null;
  }
}

/**
 * Create a new Redis connection with strict error handling
 */
async function createRedisConnection(): Promise<Redis | null> {
  console.log(`[REDIS-STRICT] Creating new connection (attempt ${connectionAttempts}/${MAX_RETRIES})`);
  
  try {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.error('[REDIS-STRICT] No Redis URL provided in environment variable REDIS_URL');
      return null;
    }
    
    // Create new connection with minimal retry settings
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1, // Limit retries per operation
      retryStrategy: () => null, // Don't automatically retry, we manage this ourselves
      connectTimeout: 10000, // 10 second timeout
      enableOfflineQueue: false, // Don't queue commands when disconnected
      enableReadyCheck: true,
      lazyConnect: false, // Connect immediately
      
      // Identify connection for debugging
      connectionName: `ponder-dex-strict-${Date.now()}`
    });
    
    // Wait for connection to be ready or fail
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      
      // Successfully connected
      redis.once('ready', () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      });
      
      // Connection error
      redis.once('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
      
      // Connection timeout (as a backup)
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
    
    // Handle ongoing connection state
    redis.on('ready', () => {
      console.log('[REDIS-STRICT] Connection ready');
      connectionState = ConnectionState.CONNECTED;
      connectionAttempts = 0; // Reset counter on successful connection
      eventEmitter.emit(ConnectionEvent.CONNECTED, { timestamp: Date.now() });
    });
    
    redis.on('error', (err) => {
      console.error('[REDIS-STRICT] Connection error:', err.message);
      // We don't change state here, let the reconnection logic handle it
    });
    
    redis.on('close', async () => {
      console.log('[REDIS-STRICT] Connection closed');
      
      if (connectionState === ConnectionState.CONNECTED) {
        connectionState = ConnectionState.DISCONNECTED;
        eventEmitter.emit(ConnectionEvent.DISCONNECTED, { timestamp: Date.now() });
      }
      
      // Clear the global instance reference
      if (globalRedisInstance === redis) {
        globalRedisInstance = null;
      }
    });
    
    // Store globally
    globalRedisInstance = redis;
    
    // Update state and emit event
    connectionState = ConnectionState.CONNECTED;
    eventEmitter.emit(ConnectionEvent.CONNECTED, { timestamp: Date.now() });
    
    console.log('[REDIS-STRICT] Connection established successfully');
    return redis;
  } catch (error) {
    console.error('[REDIS-STRICT] Failed to create Redis connection:', error);
    
    // Update state and emit event
    connectionState = ConnectionState.DISCONNECTED;
    eventEmitter.emit(ConnectionEvent.DISCONNECTED, { timestamp: Date.now() });
    
    return null;
  }
}

/**
 * Get a Redis client for operations with strict connection control
 */
export async function getStrictRedisClient(): Promise<Redis | null> {
  if (typeof window !== 'undefined') {
    console.warn('[REDIS-STRICT] Redis client not available in browser');
    return null;
  }
  
  return getRedisConnection();
}

/**
 * Close any existing Redis connections
 */
export function closeAllRedisConnections(): void {
  if (globalRedisInstance) {
    console.log('[REDIS-STRICT] Closing global Redis connection');
    try {
      globalRedisInstance.disconnect();
    } catch (err) {
      console.error('[REDIS-STRICT] Error during disconnect:', err);
    }
    globalRedisInstance = null;
  }
  
  // Reset state
  connectionState = ConnectionState.DISCONNECTED;
  connectionAttempts = 0;
  eventEmitter.emit(ConnectionEvent.DISCONNECTED, { timestamp: Date.now() });
}

/**
 * Get the connection event emitter
 */
export function getConnectionEventEmitter(): EventEmitter {
  return eventEmitter;
}

/**
 * Get the current connection state
 */
export function getConnectionState(): {
  state: ConnectionState;
  attempts: number;
  lastAttempt: number;
} {
  return {
    state: connectionState,
    attempts: connectionAttempts,
    lastAttempt: lastConnectionAttempt
  };
} 