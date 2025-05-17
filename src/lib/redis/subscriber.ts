import { EventEmitter } from 'events';
import Redis from 'ioredis';

// Define Redis channels
export const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated',
  TRANSACTION_UPDATED: 'transaction:updated'
};

// Connection state enum - properly typed state machine
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SUSPENDED = 'suspended'
}

// Connection events that can be emitted to subscribers
export enum ConnectionEvent {
  CONNECTED = 'connection:connected',
  DISCONNECTED = 'connection:disconnected',
  ERROR = 'connection:error',
  SUSPENDED = 'connection:suspended',
  RECONNECTING = 'connection:reconnecting'
}

// Create a global event emitter instance
const eventEmitter = new EventEmitter();

// Single Redis subscriber instance (server-side only)
let redisSubscriber: any = null;

// EventSource for browser
let eventSource: EventSource | null = null;

// Connection management
let connectionState = ConnectionState.DISCONNECTED;
let connectionStateTimestamp = 0;
let connectionRetryCount = 0;
const MAX_RETRY_ATTEMPTS = 3;
const CONNECTION_SUSPEND_DURATION = 60000; // 1 minute suspension
const CONNECTION_TIMEOUT = 10000; // 10 second connection timeout

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
 * Update and broadcast connection state changes
 * @param newState The new connection state
 * @param error Optional error associated with the state change
 */
function updateConnectionState(newState: ConnectionState, error?: Error): void {
  // Skip if state isn't changing
  if (newState === connectionState) return;
  
  const prevState = connectionState;
  connectionState = newState;
  connectionStateTimestamp = Date.now();
  
  // Log state transition
  logWithStyle(`Connection state: ${prevState} → ${newState}`, 
    newState === ConnectionState.CONNECTED ? 'success' : 
    newState === ConnectionState.SUSPENDED ? 'warning' : 
    newState === ConnectionState.DISCONNECTED ? 'error' : 'info'
  );
  
  // Emit appropriate events based on the state transition
  switch (newState) {
    case ConnectionState.CONNECTED:
      eventEmitter.emit(ConnectionEvent.CONNECTED, { timestamp: connectionStateTimestamp });
      break;
    case ConnectionState.DISCONNECTED:
      eventEmitter.emit(ConnectionEvent.DISCONNECTED, { timestamp: connectionStateTimestamp });
      break;
    case ConnectionState.CONNECTING:
      eventEmitter.emit(ConnectionEvent.RECONNECTING, { 
        timestamp: connectionStateTimestamp,
        attempt: connectionRetryCount
      });
      break;
    case ConnectionState.SUSPENDED:
      eventEmitter.emit(ConnectionEvent.SUSPENDED, { 
        timestamp: connectionStateTimestamp,
        error: error?.message,
        resumeAfter: CONNECTION_SUSPEND_DURATION
      });
      break;
  }
}

/**
 * Check if connection suspension period has elapsed
 */
function canAttemptReconnection(): boolean {
  // Can always reconnect if not suspended
  if (connectionState !== ConnectionState.SUSPENDED) {
    return true;
  }
  
  // Check if suspension period has elapsed
  const now = Date.now();
  const timeInSuspension = now - connectionStateTimestamp;
  if (timeInSuspension >= CONNECTION_SUSPEND_DURATION) {
    logWithStyle('Suspension period elapsed - connection attempts permitted', 'info');
    return true;
  }
  
  // Still in suspension period
  const remainingSeconds = Math.ceil((CONNECTION_SUSPEND_DURATION - timeInSuspension) / 1000);
  logWithStyle(`Connection suspended - ${remainingSeconds}s remaining before retry permitted`, 'warning');
  return false;
}

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
 * Get current connection state
 */
export function getConnectionState(): {
  state: ConnectionState;
  timestamp: number;
  retryCount: number;
} {
  return {
    state: connectionState,
    timestamp: connectionStateTimestamp,
    retryCount: connectionRetryCount
  };
}

/**
 * Initialize the subscriber that listens for updates
 * - On server: uses direct Redis connection
 * - On client: uses Server-Sent Events (SSE)
 */
export function initRedisSubscriber(): any {
  // Connection state check - don't attempt to connect if suspended
  if (!canAttemptReconnection()) {
    return eventEmitter; // Return event emitter, but don't attempt reconnection yet
  }
  
  // Debounce initialization to prevent rapid init/close cycles
  const now = Date.now();
  if (now - lastInitTime < DEBOUNCE_INIT_MS) {
    logWithStyle(`⏱️ Debouncing connection attempt (${Math.floor((now - lastInitTime) / 1000)}s since last attempt)`, 'warning');
    return eventEmitter;
  }
  
  // Reset the shutting down flag and update init timestamp
  isShuttingDown = false;
  lastInitTime = now;
  
  // Browser environment - use SSE
  if (typeof window !== 'undefined') {
    logWithStyle('🚀 Initializing real-time update system via SSE...', 'info');
    updateConnectionState(ConnectionState.CONNECTING);
    
    // If we already have an active connection, just return the emitter
    if (eventSource && eventSource.readyState === EventSource.OPEN) {
      logWithStyle('✅ Already connected', 'success');
      updateConnectionState(ConnectionState.CONNECTED);
      return eventEmitter;
    }
    
    // If we're already connecting, don't start another connection
    if (!eventSource && connectionState !== ConnectionState.CONNECTING) {
      try {
        // Create EventSource for SSE connection to our Next.js API route
        // Using the same origin for SSE to avoid CORS issues
        const sseUrl = new URL('/api/graphql-subscription', window.location.origin);
        
        // Add cache busting parameter to avoid caching issues
        sseUrl.searchParams.append('t', Date.now().toString());
        
        console.log(`[SSE] Connecting to ${sseUrl.toString()}`);
        
        // Add connection timeout guard
        const connectionTimeoutId = setTimeout(() => {
          logWithStyle('⏱️ Connection attempt timed out', 'warning');
          
          // If max retries reached, enter suspended state
          if (connectionRetryCount >= MAX_RETRY_ATTEMPTS) {
            updateConnectionState(ConnectionState.SUSPENDED, new Error('Connection timeout after multiple attempts'));
            connectionRetryCount = 0; // Reset for next time
          } else {
            updateConnectionState(ConnectionState.DISCONNECTED);
          }
          
          // Clean up the connection
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
        }, CONNECTION_TIMEOUT);
        
        // Create the EventSource
        eventSource = new EventSource(sseUrl.toString());
        
        // Set up connection handlers
        eventSource.onopen = () => {
          // Clear the timeout since we connected successfully
          clearTimeout(connectionTimeoutId);
          
          logWithStyle('✅ REAL-TIME UPDATES READY!', 'success');
          updateConnectionState(ConnectionState.CONNECTED);
          connectionRetryCount = 0; // Reset retry count on successful connection
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
          // Clear the timeout since we got a response (even if it's an error)
          clearTimeout(connectionTimeoutId);
          
          logWithStyle('❌ Real-time connection error', 'error');
          console.error('[SSE] Connection error details:', error);
          
          // Don't retry if we're intentionally shutting down
          if (isShuttingDown) {
            logWithStyle('🛑 Error during intentional shutdown - not retrying', 'warning');
            updateConnectionState(ConnectionState.DISCONNECTED);
            return;
          }
          
          // Close the current connection
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          
          // Implement retry logic with backoff
          connectionRetryCount++;
          if (connectionRetryCount < MAX_RETRY_ATTEMPTS) {
            const retryDelay = Math.min(1000 * Math.pow(2, connectionRetryCount), 10000);
            logWithStyle(`⏱️ Retrying connection in ${retryDelay/1000}s (attempt ${connectionRetryCount}/${MAX_RETRY_ATTEMPTS})`, 'warning');
            
            setTimeout(() => {
              // Only retry if we're not shutting down and have active subscribers
              if (!isShuttingDown && hasActiveSubscribers()) {
                initRedisSubscriber();
              } else {
                logWithStyle('⏹️ Skipping retry - system shutting down or no active subscribers', 'warning');
                updateConnectionState(ConnectionState.DISCONNECTED);
              }
            }, retryDelay);
          } else {
            logWithStyle('⚠️ Maximum retry attempts reached - entering suspended state', 'warning');
            updateConnectionState(ConnectionState.SUSPENDED, new Error('Max retry attempts reached'));
          }
        };
      } catch (error) {
        logWithStyle('❌ Failed to initialize connection', 'error');
        console.error('[SSE] Error details:', error);
        
        if (connectionRetryCount >= MAX_RETRY_ATTEMPTS) {
          updateConnectionState(ConnectionState.SUSPENDED, error instanceof Error ? error : new Error('Connection failed'));
        } else {
          updateConnectionState(ConnectionState.DISCONNECTED);
        }
      }
    }
    
    return eventEmitter; // Return event emitter instead of Redis client in browser
  } 
  // SERVER-SIDE ONLY - direct Redis connection
  // This code path should never execute in the browser
  else if (typeof window === 'undefined') {
    // Skip if connection is suspended
    if (connectionState === ConnectionState.SUSPENDED && !canAttemptReconnection()) {
      console.log('[SERVER] Connection currently suspended - skipping connection attempt');
      return eventEmitter;
    }
    
    console.log('[SERVER] Initializing server-side Redis subscriber');
    updateConnectionState(ConnectionState.CONNECTING);
    
    if (!redisSubscriber) {
      try {
        // IMPORTANT: Server-side environment only
        const redisUrl = process.env.REDIS_URL;
        
        if (!redisUrl) {
          console.error('[SERVER] No Redis URL provided in environment variable REDIS_URL');
          updateConnectionState(ConnectionState.SUSPENDED, new Error('No Redis URL configured'));
          return eventEmitter;
        }
        
        console.log(`[SERVER] Connecting to Redis subscriber at ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`);

        // Create a dedicated Redis client for subscriptions
        redisSubscriber = new Redis(redisUrl, {
          retryStrategy: (times: number) => {
            // After MAX_RETRY_ATTEMPTS, enter suspended state
            if (times > MAX_RETRY_ATTEMPTS) {
              console.log(`[SERVER] Redis retry count exceeded (${times}) - suspending connection attempts`);
              updateConnectionState(ConnectionState.SUSPENDED, new Error('Max connection attempts reached'));
              return null; // Stop retrying
            }
            
            // Update retry count
            connectionRetryCount = times;
            
            // Retry connection with exponential backoff
            return Math.min(times * 100, 3000);
          },
          maxRetriesPerRequest: 3,
          connectTimeout: CONNECTION_TIMEOUT,
        });

        redisSubscriber.on('error', (err: Error) => {
          console.error('[SERVER] Redis subscriber connection error:', err);
          
          // If we get ECONNRESET errors, treat specially
          if (err.message && err.message.includes('ECONNRESET')) {
            console.log('[SERVER] ECONNRESET error detected');
            connectionRetryCount++;
            
            // After multiple ECONNRESET errors, enter suspended state
            if (connectionRetryCount >= MAX_RETRY_ATTEMPTS) {
              updateConnectionState(ConnectionState.SUSPENDED, new Error('Multiple ECONNRESET errors'));
              
              // Clean up the connection
              if (redisSubscriber) {
                try {
                  redisSubscriber.disconnect();
                } catch (closeErr) {
                  console.error('[SERVER] Error closing Redis connection:', closeErr);
                }
                redisSubscriber = null;
              }
            } else {
              // Otherwise just record as disconnected
              updateConnectionState(ConnectionState.DISCONNECTED);
            }
          }
        });

        redisSubscriber.on('connect', () => {
          console.log('[SERVER] Redis subscriber connected');
          updateConnectionState(ConnectionState.CONNECTED);
          connectionRetryCount = 0; // Reset retry count on successful connection
          
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
                console.log(`[SERVER] Received message on channel ${channel}`);
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
        // Update connection state based on retry attempts
        if (connectionRetryCount >= MAX_RETRY_ATTEMPTS) {
          updateConnectionState(ConnectionState.SUSPENDED, error instanceof Error ? error : new Error('Redis initialization failed'));
        } else {
          updateConnectionState(ConnectionState.DISCONNECTED);
          connectionRetryCount++;
        }
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
    updateConnectionState(ConnectionState.DISCONNECTED);
  }
  
  // Close Redis connection on server
  if (typeof window === 'undefined' && redisSubscriber) {
    console.log('[SERVER] Closing Redis subscriber connection');
    redisSubscriber.quit().catch((err: Error) => {
      console.error('[SERVER] Error closing Redis connection:', err);
    });
    redisSubscriber = null;
    updateConnectionState(ConnectionState.DISCONNECTED);
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

/**
 * Subscribe to connection state events
 * @param event The connection event to listen for
 * @param listener The callback function
 */
export function onConnectionEvent(event: ConnectionEvent, listener: (data: any) => void): void {
  eventEmitter.on(event, listener);
}

/**
 * Remove a connection state event listener
 * @param event The connection event
 * @param listener The callback function to remove
 */
export function offConnectionEvent(event: ConnectionEvent, listener: (data: any) => void): void {
  eventEmitter.off(event, listener);
} 