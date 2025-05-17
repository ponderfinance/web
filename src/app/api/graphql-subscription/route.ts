import { NextRequest, NextResponse } from 'next/server';
import { 
  getRedisSingleton, 
  REDIS_CHANNELS, 
  ConnectionState 
} from '@/src/lib/redis/singleton';

export async function GET(req: NextRequest) {
  console.log('[SSE] Received connection request');
  
  // Get the Redis singleton instance instead of creating a new connection
  const redisSingleton = getRedisSingleton();
  
  // Create readable stream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initialize Redis subscriber through the singleton
        const eventEmitter = redisSingleton.initRedisSubscriber(true); // Force server mode
        
        // Check if connection is available
        const { state } = redisSingleton.getConnectionState();
        if (state === ConnectionState.SUSPENDED) {
          console.error('[SSE] Redis connection is currently suspended');
          controller.enqueue(`data: ${JSON.stringify({ 
            type: 'error', 
            message: 'Redis service temporarily unavailable',
            retryAfter: 30000 // Tell client to retry in 30 seconds
          })}\n\n`);
          return;
        }
        
        // For each Redis channel, create a handler
        Object.values(REDIS_CHANNELS).forEach(channel => {
          const eventName = channel.replace(':', '_'); // Convert channel name to event name format
          
          // Add a listener for this channel/event
          eventEmitter.on(eventName, (data) => {
            try {
              console.log(`[SSE] Forwarding ${channel} message to client`);
              
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
        
        // Handle connection close
        req.signal.addEventListener('abort', () => {
          console.log('[SSE] Connection closed by client');
          cleanup();
        });
        
        // Helper function to clean up subscriptions
        function cleanup() {
          // No need to manually unsubscribe - the singleton handles this
          // Just unregister this subscriber
          redisSingleton.unregisterSubscriber();
        }
        
        // Register as a subscriber
        redisSingleton.registerSubscriber();
        
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

  // Return the stream response
  return new Response(stream, {
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