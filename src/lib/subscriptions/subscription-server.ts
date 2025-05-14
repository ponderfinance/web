import { EventEmitter } from 'events';
import Redis from 'ioredis';

// Define Redis constants - matching the ones in the indexer
export const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated',
  TRANSACTION_UPDATED: 'transaction:updated'
};

// Global event emitter and Redis subscriber
let eventEmitter: EventEmitter | null = null;
let redisSubscriber: Redis | null = null;

/**
 * Get or create the event emitter instance
 */
export function getEventEmitter(): EventEmitter {
  if (!eventEmitter) {
    eventEmitter = new EventEmitter();
    // Set higher limit to avoid memory leaks warnings
    eventEmitter.setMaxListeners(100);
  }
  return eventEmitter;
}

/**
 * Initialize the Redis subscriber for GraphQL subscriptions
 */
export function initSubscriptionServer(): void {
  // Only run on client
  if (typeof window === 'undefined') return;
  
  if (!redisSubscriber) {
    try {
      const redisUrl = process.env.NEXT_PUBLIC_REDIS_URL || 'redis://localhost:6379';
      console.log(`Connecting subscription server to Redis at ${redisUrl.split('@').pop()}`);
      
      // Create Redis client
      redisSubscriber = new Redis(redisUrl, {
        retryStrategy: (times) => {
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: 3,
      });
      
      // Subscribe to Redis channels
      redisSubscriber.on('connect', () => {
        console.log('Subscription server connected to Redis');
        
        // Get channels to subscribe to
        const channels = Object.values(REDIS_CHANNELS);
        if (redisSubscriber) {
          redisSubscriber.subscribe(...channels);
          console.log('Subscription server subscribed to channels:', channels);
          
          // Set up message handler
          redisSubscriber.on('message', (channel, message) => {
            try {
              console.log(`Subscription server received message on ${channel}:`, message);
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
              console.error('Error processing Redis message:', error);
            }
          });
        }
      });
      
      // Handle errors
      redisSubscriber.on('error', (err) => {
        console.error('Subscription server Redis error:', err);
      });
    } catch (error) {
      console.error('Failed to initialize subscription server:', error);
    }
  }
}

/**
 * Subscribe to protocol metrics updates
 */
export function subscribeToProtocolMetrics(callback: () => void): () => void {
  const emitter = getEventEmitter();
  const eventName = 'subscription:protocolMetricsUpdated';
  
  emitter.on(eventName, callback);
  
  // Return unsubscribe function
  return () => {
    emitter.off(eventName, callback);
  };
}

/**
 * Subscribe to pair updates
 */
export function subscribeToPairUpdates(pairId: string, callback: () => void): () => void {
  const emitter = getEventEmitter();
  const eventName = `subscription:pairUpdated:${pairId}`;
  
  emitter.on(eventName, callback);
  
  // Return unsubscribe function
  return () => {
    emitter.off(eventName, callback);
  };
}

/**
 * Subscribe to token updates
 */
export function subscribeToTokenUpdates(tokenId: string, callback: () => void): () => void {
  const emitter = getEventEmitter();
  const eventName = `subscription:tokenUpdated:${tokenId}`;
  
  emitter.on(eventName, callback);
  
  // Return unsubscribe function
  return () => {
    emitter.off(eventName, callback);
  };
}

/**
 * Close the subscription server
 */
export function closeSubscriptionServer(): void {
  if (redisSubscriber) {
    redisSubscriber.disconnect();
    redisSubscriber = null;
  }
  
  if (eventEmitter) {
    eventEmitter.removeAllListeners();
    eventEmitter = null;
  }
} 