import { NextRequest } from 'next/server';

/**
 * GraphQL Subscription Endpoint - DISABLED
 *
 * Real-time subscriptions have been disabled as part of the Redis removal migration.
 * The frontend now uses regular GraphQL queries against Ponder's PostgreSQL database.
 *
 * If real-time updates are needed in the future, consider:
 * - Polling the GraphQL API at regular intervals
 * - Using Ponder's built-in GraphQL subscriptions (if available)
 * - Implementing a lightweight pub/sub system without Redis
 */

export async function GET(req: NextRequest) {
  console.log('[SSE] Subscription endpoint called (disabled)');

  // Return a simple message indicating subscriptions are disabled
  const stream = new ReadableStream({
    start(controller) {
      // Send initial message
      controller.enqueue(`data: ${JSON.stringify({
        type: 'info',
        status: 'disabled',
        message: 'Real-time subscriptions are currently disabled. Use GraphQL queries for data.',
        timestamp: Date.now()
      })}\n\n`);

      // Send periodic heartbeats to keep connection alive
      const heartbeatInterval = setInterval(() => {
        controller.enqueue(`data: heartbeat\n\n`);
      }, 30000);

      // Clean up on close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function POST(req: NextRequest) {
  return new Response(JSON.stringify({
    status: 'disabled',
    message: 'Real-time subscriptions are currently disabled',
    timestamp: Date.now()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    }
  });
}