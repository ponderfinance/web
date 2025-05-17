import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { REDIS_CHANNELS } from '@/src/constants/redis-channels';

// Re-export for compatibility
export { REDIS_CHANNELS };

// At the top of the file, add this global declaration
declare global {
  interface Window {
    __ponderEventSource?: EventSource;
  }
}

// Define Redis channels
export const REDIS_CHANNELS_LOCAL = {
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

// Configuration options for Redis
interface RedisConfig {
  maxRetriesPerRequest?: number;
  retryTimeoutMs?: number;
  connectTimeoutMs?: number;
  keepAliveMs?: number;
  maxSuspensionTimeMs?: number;
  maxRetryAttempts?: number;
  heartbeatIntervalMs?: number;
}

// Singleton pattern configuration
class RedisSingleton {
  // Main instance variables
  private static instance: RedisSingleton | null = null;
  
  // Connection instances
  private redisClient: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private eventEmitter = new EventEmitter();
  
  // Connection state tracking
  private connectionState = ConnectionState.DISCONNECTED;
  private connectionStateTimestamp = 0;
  private connectionRetryCount = 0;
  private isShuttingDown = false;
  private lastInitTime = 0;
  private activeSubscriptions = 0;
  private _heartbeatInterval: NodeJS.Timeout | null = null;

  // Configuration defaults
  private config: Required<RedisConfig> = {
    maxRetriesPerRequest: 3,
    retryTimeoutMs: 10000,
    connectTimeoutMs: 10000,
    keepAliveMs: 30000,
    maxSuspensionTimeMs: 60000, // 1 minute suspension
    maxRetryAttempts: 5,
    heartbeatIntervalMs: 30000, // 30 second heartbeat
  };

  // Private constructor for singleton pattern
  private constructor() {}

  // Singleton getter
  public static getInstance(): RedisSingleton {
    if (!RedisSingleton.instance) {
      RedisSingleton.instance = new RedisSingleton();
    }
    return RedisSingleton.instance;
  }

  // Configuration method
  public configure(config: RedisConfig): void {
    this.config = { ...this.config, ...config };
    console.log('[REDIS] Configured with settings:', this.config);
  }

  // Get the event emitter instance
  public getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  // Get current connection state
  public getConnectionState(): {
    state: ConnectionState;
    timestamp: number;
    retryCount: number;
  } {
    return {
      state: this.connectionState,
      timestamp: this.connectionStateTimestamp,
      retryCount: this.connectionRetryCount
    };
  }

  // Update and broadcast connection state changes
  private updateConnectionState(newState: ConnectionState, error?: Error): void {
    // Skip if state isn't changing
    if (newState === this.connectionState) return;
    
    const prevState = this.connectionState;
    this.connectionState = newState;
    this.connectionStateTimestamp = Date.now();
    
    // Log state transition
    console.log(`[REDIS] Connection state: ${prevState} → ${newState}`);
    
    // Emit appropriate events based on the state transition
    switch (newState) {
      case ConnectionState.CONNECTED:
        this.eventEmitter.emit(ConnectionEvent.CONNECTED, { timestamp: this.connectionStateTimestamp });
        break;
      case ConnectionState.DISCONNECTED:
        this.eventEmitter.emit(ConnectionEvent.DISCONNECTED, { timestamp: this.connectionStateTimestamp });
        break;
      case ConnectionState.CONNECTING:
        this.eventEmitter.emit(ConnectionEvent.RECONNECTING, { 
          timestamp: this.connectionStateTimestamp,
          attempt: this.connectionRetryCount
        });
        break;
      case ConnectionState.SUSPENDED:
        this.eventEmitter.emit(ConnectionEvent.SUSPENDED, { 
          timestamp: this.connectionStateTimestamp,
          error: error?.message,
          resumeAfter: this.config.maxSuspensionTimeMs
        });
        break;
    }
  }

  // Check if connection suspension period has elapsed
  private canAttemptReconnection(): boolean {
    // Can always reconnect if not suspended
    if (this.connectionState !== ConnectionState.SUSPENDED) {
      return true;
    }
    
    // Check if suspension period has elapsed
    const now = Date.now();
    const timeInSuspension = now - this.connectionStateTimestamp;
    if (timeInSuspension >= this.config.maxSuspensionTimeMs) {
      console.log('[REDIS] Suspension period elapsed - connection attempts permitted');
      return true;
    }
    
    // Still in suspension period
    const remainingSeconds = Math.ceil((this.config.maxSuspensionTimeMs - timeInSuspension) / 1000);
    console.log(`[REDIS] Connection suspended - ${remainingSeconds}s remaining before retry permitted`);
    return false;
  }

  // Register a new subscriber
  public registerSubscriber(): void {
    this.activeSubscriptions++;
    console.log(`[REDIS] Subscriber registered (total: ${this.activeSubscriptions})`);
  }

  // Unregister a subscriber
  public unregisterSubscriber(): boolean {
    this.activeSubscriptions = Math.max(0, this.activeSubscriptions - 1);
    console.log(`[REDIS] Subscriber unregistered (remaining: ${this.activeSubscriptions})`);
    return this.activeSubscriptions === 0;
  }

  // Has active subscribers
  public hasActiveSubscribers(): boolean {
    return this.activeSubscriptions > 0;
  }
  
  // Add heartbeat mechanism to verify connection health
  private startHeartbeat(): void {
    // Skip if we already have a heartbeat interval
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
    }
    
    // Create heartbeat interval
    this._heartbeatInterval = setInterval(async () => {
      // Skip if connection is suspended or shutting down
      if (this.connectionState === ConnectionState.SUSPENDED || this.isShuttingDown) return;
      
      try {
        // Skip if no client
        if (!this.redisClient) return;
        
        // Ping Redis server
        const result = await this.redisClient.ping();
        
        if (result === 'PONG') {
          // Connection is healthy
          if (this.connectionState !== ConnectionState.CONNECTED) {
            this.updateConnectionState(ConnectionState.CONNECTED);
          }
        } else {
          console.warn(`[REDIS] Unexpected ping response: ${result}`);
        }
      } catch (error) {
        console.error('[REDIS] Heartbeat failed:', error);
        if (this.connectionState === ConnectionState.CONNECTED) {
          this.updateConnectionState(ConnectionState.CONNECTING);
          this.connectionRetryCount++;
        }
      }
    }, this.config.heartbeatIntervalMs);
    
    console.log(`[REDIS] Heartbeat started with ${this.config.heartbeatIntervalMs}ms interval`);
  }
  
  // Stop the heartbeat mechanism
  private stopHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
      console.log('[REDIS] Heartbeat stopped');
    }
  }

  // Initialize Redis client for operations
  public getRedisClient(): Redis | null {
    if (typeof window !== 'undefined') {
      console.warn('[REDIS] Direct Redis client not available in browser');
      return null;
    }

    if (this.redisClient) {
      return this.redisClient;
    }

    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        console.error('[REDIS] No Redis URL provided in environment variable REDIS_URL');
        return null;
      }

      // Parse and validate the URL to ensure proper format
      const urlPattern = /^redis:\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;
      const match = redisUrl.match(urlPattern);
      
      if (!match) {
        console.error('[REDIS CRITICAL] Invalid Redis URL format. Expected: redis://[username:password@]host:port');
        return null;
      }
      
      const [, username, , host, port] = match;
      
      // Log connection info (without exposing full credentials)
      console.log(`[REDIS] Connecting to Redis at ${host}:${port} ${username ? 'with authentication' : 'without authentication'}`);

      console.log(`[REDIS] Creating new Redis client connection to ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`);
      
      this.redisClient = new Redis(redisUrl, {
        retryStrategy: (times) => {
          // Provide exponential backoff for reconnections
          if (times > this.config.maxRetryAttempts) {
            console.log(`[REDIS] Redis client retry count exceeded (${times}) - suspending retry attempts`);
            this.updateConnectionState(ConnectionState.SUSPENDED, new Error('Max connection attempts reached'));
            return null; // Stop retrying
          }
          
          const delay = Math.min(times * 500, 5000); // More aggressive backoff
          console.log(`[REDIS] Client retry in ${delay}ms (attempt ${times}/${this.config.maxRetryAttempts})`);
          return delay;
        },
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        connectTimeout: this.config.connectTimeoutMs,
        disconnectTimeout: 5000, // Add disconnect timeout
        keepAlive: this.config.keepAliveMs,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        noDelay: true, // Disable Nagle's algorithm
        connectionName: 'ponder-dex', // Identify connection in Redis server
        reconnectOnError: (err) => {
          // Special handling for ECONNRESET to avoid connection storms
          if (err.message.includes('ECONNRESET')) {
            console.log('[REDIS] ECONNRESET detected, controlled reconnect');
            // Add a small delay to prevent connection storms
            setTimeout(() => {
              if (!this.isShuttingDown) {
                console.log('[REDIS] Attempting controlled reconnection after ECONNRESET');
              }
            }, 2000);
            return false; // Don't immediately reconnect, let retryStrategy handle it
          }
          // For other errors, allow automatic reconnection
          return true;
        }
      });

      this.redisClient.on('connect', () => {
        console.log('[REDIS] Client connected successfully');
        this.updateConnectionState(ConnectionState.CONNECTED);
        this.connectionRetryCount = 0;
        this.startHeartbeat();
      });

      this.redisClient.on('error', (err) => {
        console.error('[REDIS] Client connection error:', err);
        if (this.connectionState === ConnectionState.CONNECTED) {
          this.updateConnectionState(ConnectionState.CONNECTING);
          this.connectionRetryCount++;
        }
      });
      
      this.redisClient.on('close', () => {
        console.log('[REDIS] Connection closed');
        if (this.connectionState === ConnectionState.CONNECTED) {
          this.updateConnectionState(ConnectionState.DISCONNECTED);
          this.stopHeartbeat();
        }
      });
      
      this.redisClient.on('end', () => {
        console.log('[REDIS] Connection ended');
        this.updateConnectionState(ConnectionState.DISCONNECTED);
        this.stopHeartbeat();
      });

      return this.redisClient;
    } catch (error) {
      console.error('[REDIS] Error creating Redis client:', error);
      return null;
    }
  }

  // Initialize Redis subscription client
  public initRedisSubscriber(isServer = typeof window === 'undefined'): EventEmitter {
    // Connection state check - don't attempt to connect if suspended
    if (!this.canAttemptReconnection()) {
      return this.eventEmitter; // Return event emitter, but don't attempt reconnection yet
    }
    
    // Debounce initialization to prevent rapid init/close cycles
    const now = Date.now();
    if (now - this.lastInitTime < 2000) { // 2 second debounce
      console.log(`[REDIS] Debouncing connection attempt (${Math.floor((now - this.lastInitTime) / 1000)}s since last attempt)`);
      return this.eventEmitter;
    }
    
    // Reset the shutting down flag and update init timestamp
    this.isShuttingDown = false;
    this.lastInitTime = now;

    // Browser environment - set up SSE connection
    if (!isServer && typeof window !== 'undefined') {
      console.log('[REDIS] Initializing client-side SSE connection');
      this.updateConnectionState(ConnectionState.CONNECTING);
      
      // Static reference to EventSource
      if (typeof window !== 'undefined' && !window.__ponderEventSource) {
        try {
          // Create EventSource for SSE connection to our Next.js API route
          // Using the same origin for SSE to avoid CORS issues
          const sseUrl = new URL('/api/graphql-subscription', window.location.origin);
          
          // Add cache busting parameter to avoid caching issues
          sseUrl.searchParams.append('t', Date.now().toString());
          
          console.log(`[REDIS] Connecting to SSE endpoint: ${sseUrl.toString()}`);
          
          // Add connection timeout guard
          const connectionTimeoutId = setTimeout(() => {
            console.log('[REDIS] SSE connection attempt timed out');
            
            // If max retries reached, enter suspended state
            if (this.connectionRetryCount >= this.config.maxRetryAttempts) {
              this.updateConnectionState(ConnectionState.SUSPENDED, new Error('Connection timeout after multiple attempts'));
              this.connectionRetryCount = 0; // Reset for next time
            } else {
              this.updateConnectionState(ConnectionState.DISCONNECTED);
            }
            
            // Clean up the connection
            if (window.__ponderEventSource) {
              window.__ponderEventSource.close();
              delete window.__ponderEventSource;
            }
          }, this.config.connectTimeoutMs);
          
          // Create the EventSource and store reference globally
          window.__ponderEventSource = new EventSource(sseUrl.toString());
          
          // Set up connection handlers
          window.__ponderEventSource.onopen = () => {
            // Clear the timeout since we connected successfully
            clearTimeout(connectionTimeoutId);
            
            console.log('[REDIS] SSE connection established successfully');
            this.updateConnectionState(ConnectionState.CONNECTED);
            this.connectionRetryCount = 0; // Reset retry count on successful connection
          };
          
          // Handle incoming messages
          window.__ponderEventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              
              // First message indicates connection success
              if (data.type === 'connected') {
                console.log('[REDIS] Real-time update system initialized successfully');
                return;
              }
              
              // Skip if we're shutting down
              if (this.isShuttingDown) {
                console.log('[REDIS] Skipping update message during shutdown');
                return;
              }
              
              // Route the message to the appropriate event based on type
              if (data.type === REDIS_CHANNELS_LOCAL.METRICS_UPDATED && data.payload) {
                this.eventEmitter.emit('metrics:updated', data.payload);
              } else if (data.type === REDIS_CHANNELS_LOCAL.PAIR_UPDATED && data.payload) {
                this.eventEmitter.emit('pair:updated', data.payload);
              } else if (data.type === REDIS_CHANNELS_LOCAL.TOKEN_UPDATED && data.payload) {
                this.eventEmitter.emit('token:updated', data.payload);
              } else if (data.type === REDIS_CHANNELS_LOCAL.TRANSACTION_UPDATED && data.payload) {
                this.eventEmitter.emit('transaction:updated', data.payload);
              } else {
                console.log(`[REDIS] Received unknown message type: ${data.type}`, data);
              }
            } catch (error) {
              console.error('[REDIS] Error processing SSE message:', error);
            }
          };
          
          // Handle errors
          window.__ponderEventSource.onerror = (error) => {
            // Clear the timeout since we got a response (even if it's an error)
            clearTimeout(connectionTimeoutId);
            
            console.error('[REDIS] SSE connection error', error);
            
            // Don't retry if we're intentionally shutting down
            if (this.isShuttingDown) {
              console.log('[REDIS] Error during intentional shutdown - not retrying');
              this.updateConnectionState(ConnectionState.DISCONNECTED);
              return;
            }
            
            // Close the current connection
            if (window.__ponderEventSource) {
              window.__ponderEventSource.close();
              delete window.__ponderEventSource;
            }
            
            // Implement retry logic with backoff
            this.connectionRetryCount++;
            if (this.connectionRetryCount < this.config.maxRetryAttempts) {
              const retryDelay = Math.min(1000 * Math.pow(2, this.connectionRetryCount), 10000);
              console.log(`[REDIS] Retrying SSE connection in ${retryDelay/1000}s (attempt ${this.connectionRetryCount}/${this.config.maxRetryAttempts})`);
              
              setTimeout(() => {
                // Only retry if we're not shutting down and have active subscribers
                if (!this.isShuttingDown && this.hasActiveSubscribers()) {
                  this.initRedisSubscriber(false);
                } else {
                  console.log('[REDIS] Skipping retry - system shutting down or no active subscribers');
                  this.updateConnectionState(ConnectionState.DISCONNECTED);
                }
              }, retryDelay);
            } else {
              console.log('[REDIS] Maximum retry attempts reached - entering suspended state');
              this.updateConnectionState(ConnectionState.SUSPENDED, new Error('Max retry attempts reached'));
            }
          };
        } catch (error) {
          console.error('[REDIS] Failed to initialize SSE connection', error);
          
          if (this.connectionRetryCount >= this.config.maxRetryAttempts) {
            this.updateConnectionState(ConnectionState.SUSPENDED, error instanceof Error ? error : new Error('Connection failed'));
          } else {
            this.updateConnectionState(ConnectionState.DISCONNECTED);
          }
        }
      } else if (window.__ponderEventSource && window.__ponderEventSource.readyState === EventSource.OPEN) {
        // Already have an active connection
        console.log('[REDIS] Using existing SSE connection');
        this.updateConnectionState(ConnectionState.CONNECTED);
      }
      
      return this.eventEmitter;
    }
    
    // SERVER-SIDE ONLY - direct Redis connection
    if (isServer) {
      console.log('[REDIS] Initializing server-side Redis subscriber');
      this.updateConnectionState(ConnectionState.CONNECTING);
      
      if (!this.redisSubscriber) {
        try {
          const redisUrl = process.env.REDIS_URL;
          
          if (!redisUrl) {
            console.error('[REDIS] No Redis URL provided in environment variable REDIS_URL');
            this.updateConnectionState(ConnectionState.SUSPENDED, new Error('No Redis URL configured'));
            return this.eventEmitter;
          }
          
          console.log(`[REDIS] Connecting to Redis subscriber at ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`);

          // Create a dedicated Redis client for subscriptions with improved settings
          this.redisSubscriber = new Redis(redisUrl, {
            retryStrategy: (times: number) => {
              // After maxRetryAttempts, enter suspended state
              if (times > this.config.maxRetryAttempts) {
                console.log(`[REDIS] Redis subscriber retry count exceeded (${times}) - suspending connection attempts`);
                this.updateConnectionState(ConnectionState.SUSPENDED, new Error('Max connection attempts reached'));
                return null; // Stop retrying
              }
              
              // Update retry count
              this.connectionRetryCount = times;
              
              // Retry connection with exponential backoff
              const delay = Math.min(times * 500, 5000);
              console.log(`[REDIS] Subscriber retry in ${delay}ms (attempt ${times}/${this.config.maxRetryAttempts})`);
              return delay;
            },
            maxRetriesPerRequest: this.config.maxRetriesPerRequest,
            connectTimeout: this.config.connectTimeoutMs,
            disconnectTimeout: 5000, // Add disconnect timeout
            keepAlive: this.config.keepAliveMs,
            // Enable TCP keepalive to prevent ECONNRESET errors
            enableTLSForSentinelMode: false, // Disable TLS for sentinel
            enableOfflineQueue: true, // Enable queue for when disconnected
            enableReadyCheck: true, // Ensure connection readiness
            reconnectOnError: (err) => {
              // Special handling for ECONNRESET to avoid connection storms
              if (err.message.includes('ECONNRESET')) {
                console.log('[REDIS] ECONNRESET detected on subscriber, controlled reconnect');
                this.connectionRetryCount++;
                return false;
              }
              return true;
            }
          });

          this.redisSubscriber.on('error', (err: Error) => {
            console.error('[REDIS] Redis subscriber connection error:', err);
            
            // If we get ECONNRESET errors, treat specially
            if (err.message && err.message.includes('ECONNRESET')) {
              console.log('[REDIS] ECONNRESET error detected');
              this.connectionRetryCount++;
              
              // After multiple ECONNRESET errors, enter suspended state
              if (this.connectionRetryCount >= this.config.maxRetryAttempts) {
                this.updateConnectionState(ConnectionState.SUSPENDED, new Error('Multiple ECONNRESET errors'));
                
                // Don't close the connection here, let it retry
              } else {
                // Otherwise just record as disconnected
                this.updateConnectionState(ConnectionState.DISCONNECTED);
              }
            }
          });

          this.redisSubscriber.on('connect', () => {
            console.log('[REDIS] Redis subscriber connected');
            this.updateConnectionState(ConnectionState.CONNECTED);
            this.connectionRetryCount = 0; // Reset retry count on successful connection
            
            // Subscribe to all update channels
            const channels = Object.values(REDIS_CHANNELS_LOCAL);
            if (this.redisSubscriber) {
              this.redisSubscriber.subscribe(...channels);
              console.log('[REDIS] Subscribed to channels:', channels);
            }
            
            // Set up message handler for all channels
            if (this.redisSubscriber) {
              this.redisSubscriber.on('message', (channel: string, message: string) => {
                try {
                  console.log(`[REDIS] Received message on channel ${channel}`);
                  const data = JSON.parse(message);
                  
                  // Emit events based on the channel
                  if (channel === REDIS_CHANNELS_LOCAL.METRICS_UPDATED) {
                    this.eventEmitter.emit('metrics:updated', data);
                  } else if (channel === REDIS_CHANNELS_LOCAL.PAIR_UPDATED) {
                    this.eventEmitter.emit('pair:updated', data);
                  } else if (channel === REDIS_CHANNELS_LOCAL.TOKEN_UPDATED) {
                    this.eventEmitter.emit('token:updated', data);
                  } else if (channel === REDIS_CHANNELS_LOCAL.TRANSACTION_UPDATED) {
                    this.eventEmitter.emit('transaction:updated', data);
                  }
                } catch (error) {
                  console.error('[REDIS] Error processing Redis message:', error);
                }
              });
            }
          });
        } catch (error) {
          console.error('[REDIS] Error initializing Redis subscriber:', error);
          // Update connection state based on retry attempts
          if (this.connectionRetryCount >= this.config.maxRetryAttempts) {
            this.updateConnectionState(ConnectionState.SUSPENDED, error instanceof Error ? error : new Error('Redis initialization failed'));
          } else {
            this.updateConnectionState(ConnectionState.DISCONNECTED);
            this.connectionRetryCount++;
          }
          return this.eventEmitter;
        }
      }
    }

    // Return the event emitter to maintain consistent API
    return this.eventEmitter;
  }

  // Close Redis connections
  public closeRedisSubscriber(): void {
    // Set the shutting down flag to prevent reconnection attempts
    this.isShuttingDown = true;
    
    // Only close if there are no active subscribers left
    if (this.activeSubscriptions > 0) {
      console.log(`[REDIS] Not closing real-time system - ${this.activeSubscriptions} active subscribers remain`);
      return;
    }
    
    // Close SSE connection in browser
    if (typeof window !== 'undefined' && window.__ponderEventSource) {
      console.log('[REDIS] Closing client-side SSE connection');
      window.__ponderEventSource.close();
      delete window.__ponderEventSource;
      this.updateConnectionState(ConnectionState.DISCONNECTED);
    }
    
    // Close Redis subscriber connection
    if (this.redisSubscriber) {
      console.log('[REDIS] Closing Redis subscriber connection');
      this.redisSubscriber.quit().catch((err: Error) => {
        console.error('[REDIS] Error closing Redis subscriber connection:', err);
      });
      this.redisSubscriber = null;
      this.updateConnectionState(ConnectionState.DISCONNECTED);
    }
    
    // Close Redis client connection
    if (this.redisClient) {
      console.log('[REDIS] Closing Redis client connection');
      this.redisClient.quit().catch((err: Error) => {
        console.error('[REDIS] Error closing Redis client connection:', err);
      });
      this.redisClient = null;
    }
  }

  // Event subscription methods
  public onMetricsUpdated(listener: (data: any) => void): void {
    this.eventEmitter.on('metrics:updated', listener);
  }

  public onPairUpdated(listener: (data: any) => void): void {
    this.eventEmitter.on('pair:updated', listener);
  }

  public onTokenUpdated(listener: (data: any) => void): void {
    this.eventEmitter.on('token:updated', listener);
  }

  public onTransactionUpdated(listener: (data: any) => void): void {
    this.eventEmitter.on('transaction:updated', listener);
  }

  public onConnectionEvent(event: ConnectionEvent, listener: (data: any) => void): void {
    this.eventEmitter.on(event, listener);
  }

  public offConnectionEvent(event: ConnectionEvent, listener: (data: any) => void): void {
    this.eventEmitter.off(event, listener);
  }
}

// Export singleton instance getter
export function getRedisSingleton(): RedisSingleton {
  return RedisSingleton.getInstance();
}

// Export event emitter for convenience
export function getRedisEventEmitter(): EventEmitter {
  return getRedisSingleton().getEventEmitter();
} 