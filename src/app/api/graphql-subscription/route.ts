import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

// Constants for Redis channels
const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated',
  TRANSACTION_UPDATED: 'transaction:updated'
};

// Redis client for subscriptions
let redisClient: Redis | null = null;

// Initialize Redis connection
function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.error('[SSE] No Redis URL provided in environment variables (REDIS_URL)');
      throw new Error('Redis URL not configured');
    }
    
    console.log(`[SSE] Connecting to Redis at ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`);
    
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
    
    redisClient.on('error', (err) => {
      console.error('[SSE] Redis subscription error:', err);
    });
    
    redisClient.on('connect', () => {
      console.log('[SSE] Redis subscription connected');
    });
  }
  
  return redisClient;
}

export async function GET(req: NextRequest) {
  // Create readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const redis = getRedisClient();
        
        // Subscribe to all update channels
        const channels = Object.values(REDIS_CHANNELS);
        await redis.subscribe(...channels);
        console.log('[SSE] Subscribed to channels:', channels);
        
        // Set up message handler
        redis.on('message', (channel, message) => {
          try {
            console.log(`[SSE] Received message on channel ${channel}`);
            const data = JSON.parse(message);
            
            // Normalize the format based on channel and message structure
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
              
              console.log(`[SSE] Normalized transaction message:`, normalizedPayload);
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
            console.error('[SSE] Error processing Redis message:', error);
          }
        });
        
        // Handle connection close
        req.signal.addEventListener('abort', () => {
          console.log('[SSE] Connection closed by client');
          cleanup();
        });
        
        // Helper function to clean up subscriptions
        function cleanup() {
          if (redis) {
            redis.unsubscribe(...channels).catch(err => {
              console.error('[SSE] Error unsubscribing from channels:', err);
            });
          }
        }
        
        // Send initial connection message
        controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
        
        // Keep the connection alive with a heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          controller.enqueue(`: heartbeat\n\n`);
        }, 30000);
        
        // Clear heartbeat on connection close
        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
        });
      } catch (error) {
        console.error('[SSE] Error setting up SSE stream:', error);
        controller.error(error);
      }
    }
  });
  
  // Return the stream with appropriate headers for SSE
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Add POST method handler to avoid 405 errors when POST requests are made to this endpoint
export async function POST(req: NextRequest) {
  // For POST requests, redirect to use the GET endpoint instead
  return NextResponse.json(
    { 
      message: "This endpoint supports GET requests for SSE. Please use EventSource for real-time updates."
    },
    { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    }
  );
} 