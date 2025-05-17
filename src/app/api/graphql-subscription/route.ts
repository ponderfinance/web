import { NextRequest } from 'next/server';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { REDIS_CHANNELS } from '@/src/constants/redis-channels';
import { REDIS_CONFIG } from '@/src/config/redis';

// Redis server side setup
let redisSubscriber: Redis | null = null;
const eventEmitter = new EventEmitter();
let connectionAttemptTimestamp = 0;
const RECONNECT_DELAY_MS = 5000; // 5 seconds between connection attempts
let isShuttingDown = false;
let activeConnections = 0;
let connectionRetryCount = 0;

// Initialize the server-side Redis connection
async function initServerRedis() {
  // If we already have a subscriber, return the event emitter
  if (redisSubscriber?.status === 'ready') {
    console.log('[REDIS] Using existing Redis connection');
    return eventEmitter;
  }
  
  // If a connection attempt was made recently, don't retry yet
  const now = Date.now();
  if (now - connectionAttemptTimestamp < RECONNECT_DELAY_MS) {
    console.log(`[REDIS] Connection attempt throttled (${Math.round((now - connectionAttemptTimestamp) / 1000)}s since last attempt)`);
    return eventEmitter;
  }
  
  // Update connection attempt timestamp
  connectionAttemptTimestamp = now;
  
  try {
    console.log('[REDIS] Initializing server-side Redis subscriber');
    
    // Clean up any existing connection
    if (redisSubscriber) {
      try {
        await redisSubscriber.quit();
      } catch (error) {
        console.error('[REDIS] Error closing previous connection:', error);
      }
      redisSubscriber = null;
    }
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.error('[REDIS] No Redis URL provided in environment variable REDIS_URL');
      throw new Error('Redis URL not configured');
    }
    
    console.log(`[REDIS] Connecting to Redis subscriber at ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`);
    
    // Create Redis client with better settings from config
    redisSubscriber = new Redis(redisUrl, {
      retryStrategy: (times) => {
        connectionRetryCount = times;
        
        // Progressive backoff with max retry limit
        if (times > REDIS_CONFIG.maxRetryAttempts || isShuttingDown) {
          console.log(`[REDIS] Subscriber retry count exceeded (${times}/${REDIS_CONFIG.maxRetryAttempts}) - suspending connection attempts`);
          // Emit a suspended event so clients can fall back to polling
          eventEmitter.emit('connection:suspended', { 
            timestamp: Date.now(),
            retryAfter: REDIS_CONFIG.maxSuspensionTimeMs 
          });
          return null; // Stop retrying
        }
        
        const delay = Math.min(
          REDIS_CONFIG.initialRetryDelayMs * Math.pow(REDIS_CONFIG.backoffFactor, times),
          REDIS_CONFIG.maxRetryDelayMs
        );
        console.log(`[REDIS] Subscriber retry in ${Math.round(delay)}ms (attempt ${times}/${REDIS_CONFIG.maxRetryAttempts})`);
        return delay;
      },
      maxRetriesPerRequest: REDIS_CONFIG.maxRetriesPerRequest,
      connectTimeout: REDIS_CONFIG.connectTimeoutMs,
      keepAlive: REDIS_CONFIG.keepAliveMs,
      enableReadyCheck: true,
      lazyConnect: false,
      reconnectOnError: (err) => {
        // Prevent connection storms - use controlled reconnection approach
        if (err.message.includes('ECONNRESET')) {
          console.log('[REDIS] ECONNRESET error detected in SSE route');
          
          // Emit an error event to clients
          eventEmitter.emit('connection:error', {
            error: 'Connection reset by server',
            timestamp: Date.now()
          });
          
          // If we've already failed too many times, signal a suspension
          if (connectionRetryCount >= REDIS_CONFIG.maxRetryAttempts) {
            console.log('[REDIS] Too many connection failures, suspending reconnection attempts');
            eventEmitter.emit('connection:suspended', {
              timestamp: Date.now(),
              retryAfter: REDIS_CONFIG.maxSuspensionTimeMs
            });
            return false; // Don't automatically reconnect
          }
          
          // Use controlled reconnection with backoff
          setTimeout(() => {
            if (!isShuttingDown && activeConnections > 0) {
              console.log('[REDIS] Attempting controlled reconnection after ECONNRESET');
              // Reset timestamp to allow immediate retry
              connectionAttemptTimestamp = 0; 
              initServerRedis();
            }
          }, 2000 * (connectionRetryCount + 1)); // Increase delay with retry count
          
          return false; // Don't immediately retry
        }
        
        // For other errors, let the default reconnect handle it
        console.error('[REDIS] Connection error:', err.message);
        return true;
      }
    });
    
    // Set up connection handlers
    redisSubscriber.on('connect', () => {
      console.log('[REDIS] Redis subscriber connected');
      connectionRetryCount = 0; // Reset retry count on successful connection
      
      // Emit connected event
      eventEmitter.emit('connection:connected', { 
        timestamp: Date.now()
      });
      
      // Subscribe to all channels
      const channels = Object.values(REDIS_CHANNELS);
      redisSubscriber?.subscribe(...channels);
      console.log('[REDIS] Subscribed to channels:', channels);
    });
    
    // Set up message handler
    redisSubscriber.on('message', (channel, message) => {
      try {
        // Skip detailed logging except for key events to reduce noise
        if (channel === REDIS_CHANNELS.TRANSACTION_UPDATED) {
          console.log(`[REDIS] Transaction update received on ${channel}`);
        }
        
        const data = JSON.parse(message);
        eventEmitter.emit(channel, data);
      } catch (error) {
        console.error('[REDIS] Error processing message:', error);
      }
    });
    
    // Set up error handler
    redisSubscriber.on('error', (error) => {
      console.error('[REDIS] Redis subscriber connection error:', error);
      
      // Emit error for clients
      eventEmitter.emit('connection:error', {
        error: error.message,
        timestamp: Date.now()
      });
    });
    
    // Set up disconnection handler
    redisSubscriber.on('end', () => {
      console.log('[REDIS] Redis connection ended');
      
      eventEmitter.emit('connection:disconnected', {
        timestamp: Date.now()
      });
    });
    
    // Return the event emitter
    return eventEmitter;
  } catch (error) {
    console.error('[REDIS] Error initializing Redis subscriber:', error);
    
    // Emit error event to notify clients
    eventEmitter.emit('connection:error', {
      error: error instanceof Error ? error.message : 'Unknown Redis initialization error',
      timestamp: Date.now()
    });
    
    return eventEmitter; // Return emitter even on error to avoid breaking SSE
  }
}

// Shutdown handler
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

function cleanup() {
  console.log('[REDIS] Process terminating, cleaning up connections');
  isShuttingDown = true;
  
  if (redisSubscriber) {
    redisSubscriber.quit().catch(err => {
      console.error('[REDIS] Error closing Redis connection:', err);
    });
    redisSubscriber = null;
  }
}

export async function GET(req: NextRequest) {
  console.log('[SSE] Received connection request');
  activeConnections++;
  
  // Create readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initialize Redis subscriber
        const emitter = await initServerRedis();
        
        // For each Redis channel, create a handler
        Object.values(REDIS_CHANNELS).forEach(channel => {
          // Add a listener for this channel/event
          emitter.on(channel, (data) => {
            try {
              // Skip verbose logging for everything except transactions
              if (channel === REDIS_CHANNELS.TRANSACTION_UPDATED) {
                console.log(`[SSE] Forwarding transaction update to client`);
              }
              
              // Normalize the format based on channel
              let normalizedPayload = { ...data };
              
              // For transaction updates, ensure we have a consistent format
              if (channel === REDIS_CHANNELS.TRANSACTION_UPDATED) {
                normalizedPayload = {
                  entityType: 'transaction',
                  entityId: data.transactionId || data.entityId,
                  txHash: data.txHash,
                  timestamp: data.timestamp || Date.now(),
                  ...data // Keep all other properties
                };
              }
              // For token updates, ensure consistent format
              else if (channel === REDIS_CHANNELS.TOKEN_UPDATED) {
                normalizedPayload = {
                  entityType: 'token',
                  entityId: data.entityId || data.tokenId,
                  timestamp: data.timestamp || Date.now(),
                  ...data
                };
              }
              // For pair updates, ensure consistent format
              else if (channel === REDIS_CHANNELS.PAIR_UPDATED) {
                normalizedPayload = {
                  entityType: 'pair',
                  entityId: data.entityId || data.pairId,
                  timestamp: data.timestamp || Date.now(),
                  ...data
                };
              }
              // For metrics updates, ensure consistent format
              else if (channel === REDIS_CHANNELS.METRICS_UPDATED) {
                normalizedPayload = {
                  entityType: 'metrics',
                  entityId: data.entityId || 'global',
                  metricType: data.metricType || 'unknown',
                  timestamp: data.timestamp || Date.now(),
                  ...data
                };
              }
              
              // Format the SSE message with normalized payload
              const eventData = {
                type: channel,
                payload: normalizedPayload
              };
              
              // Send the message through the stream
              controller.enqueue(`data: ${JSON.stringify(eventData)}\n\n`);
            } catch (error) {
              console.error('[SSE] Error processing message:', error);
            }
          });
        });
        
        // Set up connection status event listeners
        const connectionEvents = [
          'connection:connected',
          'connection:disconnected',
          'connection:error',
          'connection:suspended'
        ];
        
        connectionEvents.forEach(eventName => {
          emitter.on(eventName, (data) => {
            try {
              console.log(`[SSE] Sending ${eventName} event to client`);
              
              // Format based on event name
              const type = eventName.split(':')[1]; // Extract 'connected', 'error', etc.
              const payload = {
                ...data,
                event: eventName
              };
              
              controller.enqueue(`data: ${JSON.stringify({ 
                type, 
                payload 
              })}\n\n`);
            } catch (error) {
              console.error(`[SSE] Error sending ${eventName} event:`, error);
            }
          });
        });
        
        // Handle connection close
        req.signal.addEventListener('abort', () => {
          console.log('[SSE] Connection closed by client');
          activeConnections--;
          
          // Clean up event listeners to prevent memory leaks
          [...Object.values(REDIS_CHANNELS), ...connectionEvents].forEach(event => {
            emitter.removeAllListeners(event);
          });
          
          // If no more active connections, consider cleaning up Redis
          if (activeConnections <= 0 && redisSubscriber) {
            console.log('[SSE] No more active connections, scheduling Redis cleanup');
            setTimeout(() => {
              if (activeConnections <= 0 && !isShuttingDown) {
                console.log('[SSE] Cleaning up unused Redis connection');
                if (redisSubscriber) {
                  redisSubscriber.quit().catch(err => {
                    console.error('[REDIS] Error closing Redis connection:', err);
                  });
                  redisSubscriber = null;
                }
              }
            }, 30000); // Wait 30 seconds before cleanup to avoid rapid connect/disconnect cycles
          }
        });
        
        // Send initial connection message with status and channel information
        controller.enqueue(`data: ${JSON.stringify({ 
          type: 'connected',
          status: 'ready',
          message: 'Real-time update system ready',
          channels: Object.values(REDIS_CHANNELS),
          timestamp: Date.now()
        })}\n\n`);
        
        // Keep the connection alive with a heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          controller.enqueue(`data: heartbeat\n\n`);
        }, 30000);
        
        // Clear heartbeat on connection close
        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
        });
      } catch (error) {
        console.error('[SSE] Error setting up SSE stream:', error);
        
        // Send error message to client
        controller.enqueue(`data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error setting up SSE stream',
          timestamp: Date.now()
        })}\n\n`);
        
        // We don't want to close the stream - instead we'll let the client retry
      }
    }
  });

  // Return the stream response with appropriate headers for SSE
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in Nginx
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// POST fallback for clients that can't use SSE
export async function POST(req: NextRequest) {
  try {
    // Check if client is asking for connection status
    const data = await req.json();
    
    // Simple status endpoint - useful when SSE isn't working
    if (data.action === 'status') {
      return new Response(JSON.stringify({
        status: redisSubscriber?.status || 'disconnected',
        activeConnections,
        retryCount: connectionRetryCount,
        channels: Object.values(REDIS_CHANNELS),
        timestamp: Date.now()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Invalid action',
      validActions: ['status']
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error',
      timestamp: Date.now()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}