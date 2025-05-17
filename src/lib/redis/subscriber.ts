import { EventEmitter } from 'events';
import Redis from 'ioredis';

// Define Redis channels
export const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated',
  TRANSACTION_UPDATED: 'transaction:updated'
};

// Create a global event emitter instance
const eventEmitter = new EventEmitter();

// Single Redis subscriber instance (server-side only)
let redisSubscriber: any = null;

// EventSource for browser
let eventSource: EventSource | null = null;

// Track SSE connection state
let sseConnecting = false;
let sseRetryCount = 0;
const MAX_SSE_RETRIES = 3;

// Track active subscriptions and prevent unnecessary init/close cycles
let activeSubscriptions = 0;
let isShuttingDown = false;
let lastInitTime = 0;
const DEBOUNCE_INIT_MS = 2000; // Prevent rapid init/close cycles

// Helper to create bold colored console logs
const logWithStyle = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
  const styles = {
    success: 'color: #00c853; font-weight: bold; font-size: 14px;',
    info: 'color: #2196f3; font-weight: bold;',
    error: 'color: #f44336; font-weight: bold;',
    warning: 'color: #ff9800; font-weight: bold;'
  };
  
  console.log(`%c${message}`, styles[type]);
};

/**
 * Register a new subscriber - useful for tracking how many components use real-time updates
 */
export function registerSubscriber(): void {
  activeSubscriptions++;
  logWithStyle(`👥 Real-time subscriber registered (total: ${activeSubscriptions})`, 'info');
}

/**
 * Unregister a subscriber - when count reaches 0, the connection can be closed
 */
export function unregisterSubscriber(): boolean {
  activeSubscriptions = Math.max(0, activeSubscriptions - 1);
  logWithStyle(`👋 Real-time subscriber unregistered (remaining: ${activeSubscriptions})`, 'info');
  return activeSubscriptions === 0;
}

/**
 * Check if there are active subscribers
 */
export function hasActiveSubscribers(): boolean {
  return activeSubscriptions > 0;
}

/**
 * Initialize the subscriber that listens for updates
 * - On server: uses direct Redis connection
 * - On client: uses Server-Sent Events (SSE)
 */
export function initRedisSubscriber(): any {
  // Debounce initialization to prevent rapid init/close cycles
  const now = Date.now();
  if (now - lastInitTime < DEBOUNCE_INIT_MS) {
    logWithStyle(`⏱️ Debouncing real-time system initialization (last init: ${now - lastInitTime}ms ago)`, 'warning');
    return eventEmitter;
  }
  
  // Reset the shutting down flag and update init timestamp
  isShuttingDown = false;
  lastInitTime = now;
  
  // Browser environment - use SSE
  if (typeof window !== 'undefined') {
    logWithStyle('🚀 Initializing real-time update system via SSE...', 'info');
    
    // If we already have an active connection, just return the emitter
    if (eventSource && eventSource.readyState === EventSource.OPEN) {
      logWithStyle('✅ Real-time connection already active', 'success');
      return eventEmitter;
    }
    
    // If we're already connecting, don't start another connection
    if (!eventSource && !sseConnecting) {
      sseConnecting = true;
      
      try {
        // Create EventSource for SSE connection to our Next.js API route
        // Using the same origin for SSE to avoid CORS issues
        const sseUrl = new URL('/api/graphql-subscription', window.location.origin);
        
        // Add cache busting parameter to avoid caching issues
        sseUrl.searchParams.append('t', Date.now().toString());
        
        console.log(`[SSE] Connecting to ${sseUrl.toString()}`);
        eventSource = new EventSource(sseUrl.toString());
        
        // Set up connection handlers
        eventSource.onopen = () => {
          logWithStyle('✅ REAL-TIME UPDATES READY! Connected to server via SSE', 'success');
          sseConnecting = false;
          sseRetryCount = 0; // Reset retry count on successful connection
        };
        
        // Handle incoming messages
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // First message indicates connection success
            if (data.type === 'connected') {
              logWithStyle('🟢 Real-time update system initialized successfully', 'success');
              return;
            }
            
            // Skip if we're shutting down
            if (isShuttingDown) {
              logWithStyle('⏭️ Skipping update message during shutdown', 'warning');
              return;
            }
            
            // Route the message to the appropriate event based on type
            if (data.type === REDIS_CHANNELS.METRICS_UPDATED && data.payload) {
              eventEmitter.emit('metrics:updated', data.payload);
            } else if (data.type === REDIS_CHANNELS.PAIR_UPDATED && data.payload) {
              eventEmitter.emit('pair:updated', data.payload);
            } else if (data.type === REDIS_CHANNELS.TOKEN_UPDATED && data.payload) {
              eventEmitter.emit('token:updated', data.payload);
            } else if (data.type === REDIS_CHANNELS.TRANSACTION_UPDATED && data.payload) {
              logWithStyle(`📊 Received transaction update: ${data.payload.txHash?.slice(0, 8) || 'unknown'}...`, 'info');
              eventEmitter.emit('transaction:updated', data.payload);
            } else {
              console.log(`[SSE] Received unknown message type: ${data.type}`, data);
            }
          } catch (error) {
            console.error('[SSE] Error processing message:', error);
          }
        };
        
        // Handle errors
        eventSource.onerror = (error) => {
          logWithStyle('❌ Real-time connection error', 'error');
          console.error('[SSE] Connection error details:', error);
          sseConnecting = false;
          
          // Don't retry if we're intentionally shutting down
          if (isShuttingDown) {
            logWithStyle('🛑 Error during intentional shutdown - not retrying', 'warning');
            return;
          }
          
          // Close the current connection
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          
          // Implement retry logic with backoff
          if (sseRetryCount < MAX_SSE_RETRIES) {
            sseRetryCount++;
            const retryDelay = Math.min(1000 * Math.pow(2, sseRetryCount), 10000);
            logWithStyle(`⏱️ Retrying real-time connection in ${retryDelay}ms (${sseRetryCount}/${MAX_SSE_RETRIES})`, 'warning');
            
            setTimeout(() => {
              // Only retry if we're not shutting down and have active subscribers
              if (!isShuttingDown && hasActiveSubscribers()) {
                initRedisSubscriber();
              } else {
                logWithStyle('⏹️ Skipping retry - system shutting down or no active subscribers', 'warning');
              }
            }, retryDelay);
          } else {
            logWithStyle('❌ Maximum retry attempts reached. Real-time updates unavailable.', 'error');
          }
        };
      } catch (error) {
        logWithStyle('❌ Failed to initialize real-time connection', 'error');
        console.error('[SSE] Error details:', error);
        sseConnecting = false;
      }
      
      return eventEmitter; // Return event emitter instead of Redis client in browser
    }
  } 
  // SERVER-SIDE ONLY - direct Redis connection
  // This code path should never execute in the browser
  else if (typeof window === 'undefined') {
    console.log('[SERVER] Initializing server-side Redis subscriber');
    
    if (!redisSubscriber) {
      try {
        // IMPORTANT: Server-side environment only
        const redisUrl = process.env.REDIS_URL;
        
        if (!redisUrl) {
          console.error('[SERVER] No Redis URL provided in environment variable REDIS_URL')
          return eventEmitter; // Return the event emitter if no URL is provided
        }
        
        console.log(`[SERVER] Connecting to Redis subscriber at ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`);

        // Create a dedicated Redis client for subscriptions
        redisSubscriber = new Redis(redisUrl, {
          retryStrategy: (times: number) => {
            // Retry connection with exponential backoff
            return Math.min(times * 50, 2000);
          },
          maxRetriesPerRequest: 3,
        });

        redisSubscriber.on('error', (err: Error) => {
          console.error('[SERVER] Redis subscriber connection error:', err);
        });

        redisSubscriber.on('connect', () => {
          console.log('[SERVER] Redis subscriber connected');
          
          // Subscribe to all update channels
          const channels = Object.values(REDIS_CHANNELS);
          if (redisSubscriber) {
            redisSubscriber.subscribe(...channels);
            console.log('[SERVER] Subscribed to channels:', channels);
          }
          
          // Set up message handler for all channels
          if (redisSubscriber) {
            redisSubscriber.on('message', (channel: string, message: string) => {
              try {
                console.log(`[SERVER] Received message on channel ${channel}:`, message);
                const data = JSON.parse(message);
                
                // Emit events based on the channel
                if (channel === REDIS_CHANNELS.METRICS_UPDATED) {
                  eventEmitter.emit('metrics:updated', data);
                } else if (channel === REDIS_CHANNELS.PAIR_UPDATED) {
                  eventEmitter.emit('pair:updated', data);
                } else if (channel === REDIS_CHANNELS.TOKEN_UPDATED) {
                  eventEmitter.emit('token:updated', data);
                } else if (channel === REDIS_CHANNELS.TRANSACTION_UPDATED) {
                  eventEmitter.emit('transaction:updated', data);
                }
              } catch (error) {
                console.error('[SERVER] Error processing Redis message:', error);
              }
            });
          }
        });
      } catch (error) {
        console.error('[SERVER] Error initializing Redis subscriber:', error);
        return eventEmitter;
      }
    }

    // Return the event emitter on server to maintain consistent API
    return eventEmitter;
  }
  
  // Fallback case - should never reach here
  console.warn('Unexpected environment in initRedisSubscriber');
  return eventEmitter;
}

/**
 * Close all subscriber connections
 */
export function closeRedisSubscriber(): void {
  // Set the shutting down flag to prevent reconnection attempts
  isShuttingDown = true;
  
  // Only close if there are no active subscribers left
  if (activeSubscriptions > 0) {
    logWithStyle(`⚠️ Not closing real-time system - ${activeSubscriptions} active subscribers remain`, 'warning');
    return;
  }
  
  // Close SSE connection in browser
  if (typeof window !== 'undefined' && eventSource) {
    logWithStyle('🔌 Closing real-time update connection', 'warning');
    eventSource.close();
    eventSource = null;
    sseConnecting = false;
    sseRetryCount = 0;
  }
  
  // Close Redis connection on server
  if (typeof window === 'undefined' && redisSubscriber) {
    console.log('[SERVER] Closing Redis subscriber connection');
    redisSubscriber.quit().catch((err: Error) => {
      console.error('[SERVER] Error closing Redis connection:', err);
    });
    redisSubscriber = null;
  }
}

/**
 * Get the event emitter instance
 */
export function getEventEmitter(): EventEmitter {
  return eventEmitter;
}

// Event subscription methods

/**
 * Subscribe to metrics updates
 * @param listener The callback function
 */
export function onMetricsUpdated(listener: (data: any) => void): void {
  eventEmitter.on('metrics:updated', listener);
}

/**
 * Subscribe to pair updates
 * @param listener The callback function
 */
export function onPairUpdated(listener: (data: any) => void): void {
  eventEmitter.on('pair:updated', listener);
}

/**
 * Subscribe to token updates
 * @param listener The callback function
 */
export function onTokenUpdated(listener: (data: any) => void): void {
  eventEmitter.on('token:updated', listener);
}

/**
 * Subscribe to transaction updates
 * @param listener The callback function
 */
export function onTransactionUpdated(listener: (data: any) => void): void {
  eventEmitter.on('transaction:updated', listener);
} 