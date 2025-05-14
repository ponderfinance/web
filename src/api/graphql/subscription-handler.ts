import { getEventEmitter, REDIS_CHANNELS } from '@/src/lib/subscriptions/subscription-server';
import Redis from 'ioredis';

// Redis subscriber instance
let redisSubscriber: Redis | null = null;

/**
 * Initialize subscription server on server side
 * This should be called once from API route
 */
export async function initServerSubscriptions() {
  if (redisSubscriber) return;
  
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`Server: Connecting subscription handler to Redis at ${redisUrl.split('@').pop()}`);
    
    // Create Redis client
    redisSubscriber = new Redis(redisUrl, {
      retryStrategy: (times) => {
        return Math.min(times * 50, 2000);
      },
      maxRetriesPerRequest: 3,
    });
    
    // Subscribe to Redis channels
    redisSubscriber.on('connect', () => {
      console.log('Server: Subscription handler connected to Redis');
      
      // Get channels to subscribe to
      const channels = Object.values(REDIS_CHANNELS);
      if (redisSubscriber) {
        redisSubscriber.subscribe(...channels);
        console.log('Server: Subscription handler subscribed to channels:', channels);
        
        // Set up message handler
        redisSubscriber.on('message', (channel, message) => {
          try {
            console.log(`Server: Subscription handler received message on ${channel}:`, message);
            const data = JSON.parse(message);
            
            // Emit events based on channel
            if (channel === REDIS_CHANNELS.METRICS_UPDATED) {
              getEventEmitter().emit('subscription:protocolMetricsUpdated', data);
            } else if (channel === REDIS_CHANNELS.PAIR_UPDATED) {
              getEventEmitter().emit(`subscription:pairUpdated:${data.entityId}`, data);
            } else if (channel === REDIS_CHANNELS.TOKEN_UPDATED) {
              getEventEmitter().emit(`subscription:tokenUpdated:${data.entityId}`, data);
            } else if (channel === REDIS_CHANNELS.TRANSACTION_UPDATED) {
              getEventEmitter().emit('subscription:transactionsUpdated', data);
            }
          } catch (error) {
            console.error('Server: Error processing Redis message:', error);
          }
        });
      }
    });
    
    // Handle errors
    redisSubscriber.on('error', (err) => {
      console.error('Server: Subscription handler Redis error:', err);
    });
    
    // Wait for connection to be established
    await new Promise<void>((resolve) => {
      if (redisSubscriber?.status === 'ready') {
        resolve();
      } else {
        redisSubscriber?.once('connect', () => resolve());
      }
    });
    
    console.log('Server: Subscription handler initialized successfully');
  } catch (error) {
    console.error('Server: Failed to initialize subscription handler:', error);
    throw error;
  }
}

/**
 * Close the subscription handler
 */
export function closeServerSubscriptions() {
  if (redisSubscriber) {
    redisSubscriber.disconnect();
    redisSubscriber = null;
  }
} 