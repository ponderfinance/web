import { EventEmitter } from 'events';

// Only import Redis in server environment
let Redis: any = null;
if (typeof window === 'undefined') {
  // This code only runs on the server
  import('ioredis').then(module => {
    Redis = module.default;
  });
}

// Constants for Redis channels and events
export const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated'
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

/**
 * Initialize the subscriber that listens for updates
 * - On server: uses direct Redis connection
 * - On client: uses Server-Sent Events (SSE)
 */
export function initRedisSubscriber(): any {
  // Browser environment - use SSE
  if (typeof window !== 'undefined') {
    console.log('Initializing browser-based subscriber using SSE');
    
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
          console.log('[SSE] Connection opened for real-time updates');
          sseConnecting = false;
          sseRetryCount = 0; // Reset retry count on successful connection
        };
        
        // Handle incoming messages
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[SSE] Received message:', data);
            
            // Route the message to the appropriate event based on type
            if (data.type === 'metrics:updated') {
              eventEmitter.emit('metrics:updated', data.payload);
            } else if (data.type === 'pair:updated') {
              eventEmitter.emit('pair:updated', data.payload);
            } else if (data.type === 'token:updated') {
              eventEmitter.emit('token:updated', data.payload);
            } else if (data.type === 'connected') {
              console.log('[SSE] Connected to server successfully');
            }
          } catch (error) {
            console.error('[SSE] Error processing message:', error);
          }
        };
        
        // Handle errors
        eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error);
          sseConnecting = false;
          
          // Close the current connection
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          
          // Implement retry logic with backoff
          if (sseRetryCount < MAX_SSE_RETRIES) {
            sseRetryCount++;
            const retryDelay = Math.min(1000 * Math.pow(2, sseRetryCount), 10000);
            console.log(`[SSE] Retrying connection in ${retryDelay}ms (attempt ${sseRetryCount}/${MAX_SSE_RETRIES})`);
            
            setTimeout(() => {
              initRedisSubscriber();
            }, retryDelay);
          } else {
            console.error('[SSE] Maximum retry attempts reached. Giving up.');
          }
        };
      } catch (error) {
        console.error('[SSE] Failed to initialize connection:', error);
        sseConnecting = false;
      }
      
      return eventEmitter; // Return event emitter instead of Redis client in browser
    }
  } 
  // Server environment - use direct Redis connection 
  else if (Redis) {
    if (!redisSubscriber) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      console.log(`Connecting to Redis subscriber at ${redisUrl.split('@').pop()}`);

      // Create a dedicated Redis client for subscriptions
      redisSubscriber = new Redis(redisUrl, {
        retryStrategy: (times: number) => {
          // Retry connection with exponential backoff
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: 3,
      });

      redisSubscriber.on('error', (err: Error) => {
        console.error('Redis subscriber connection error:', err);
      });

      redisSubscriber.on('connect', () => {
        console.log('Redis subscriber connected');
        
        // Subscribe to all update channels
        const channels = Object.values(REDIS_CHANNELS);
        if (redisSubscriber) {
          redisSubscriber.subscribe(...channels);
          console.log('Subscribed to channels:', channels);
        }
        
        // Set up message handler for all channels
        if (redisSubscriber) {
          redisSubscriber.on('message', (channel: string, message: string) => {
            try {
              console.log(`Received message on channel ${channel}:`, message);
              const data = JSON.parse(message);
              
              // Emit events based on the channel
              if (channel === REDIS_CHANNELS.METRICS_UPDATED) {
                eventEmitter.emit('metrics:updated', data);
              } else if (channel === REDIS_CHANNELS.PAIR_UPDATED) {
                eventEmitter.emit('pair:updated', data);
              } else if (channel === REDIS_CHANNELS.TOKEN_UPDATED) {
                eventEmitter.emit('token:updated', data);
              }
            } catch (error) {
              console.error('Error processing Redis message:', error);
            }
          });
        }
      });
    }

    // Return the Redis client on server
    return redisSubscriber;
  } else {
    console.error('Redis module not available in server environment');
    return eventEmitter;
  }
}

/**
 * Subscribe to metrics updates
 * @param event The event to subscribe to
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
 * Close the subscriber connection
 */
export function closeRedisSubscriber(): void {
  if (typeof window !== 'undefined' && eventSource) {
    eventSource.close();
    eventSource = null;
  } else if (redisSubscriber) {
    redisSubscriber.disconnect();
    redisSubscriber = null;
  }
}

/**
 * Access the event emitter directly if needed
 */
export function getEventEmitter(): EventEmitter {
  return eventEmitter;
} 