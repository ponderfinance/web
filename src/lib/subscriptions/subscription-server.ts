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
  // Only run on client side with EventSource, not direct Redis connection
  if (typeof window === 'undefined') return;
  
  if (!eventEmitter) {
    eventEmitter = new EventEmitter();
    // Set higher limit to avoid memory leaks warnings
    eventEmitter.setMaxListeners(100);
  }
  
  // For client-side, we'll use SSE instead of direct Redis connection
  try {
    console.log('Setting up client-side subscription system via SSE');
      
    // EventSource will connect to our API route that handles Redis subscriptions
    const eventSource = new EventSource('/api/graphql-subscription');
      
    eventSource.onopen = () => {
      console.log('SSE connection opened for real-time updates');
    };
      
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received SSE update:', data);
          
        // Process message based on type
        if (data.type === REDIS_CHANNELS.METRICS_UPDATED && data.payload) {
          getEventEmitter().emit('subscription:protocolMetricsUpdated', data.payload);
        } else if (data.type === REDIS_CHANNELS.PAIR_UPDATED && data.payload) {
          getEventEmitter().emit(`subscription:pairUpdated:${data.payload.entityId}`, data.payload);
        } else if (data.type === REDIS_CHANNELS.TOKEN_UPDATED && data.payload) {
          getEventEmitter().emit(`subscription:tokenUpdated:${data.payload.entityId}`, data.payload);
        } else if (data.type === REDIS_CHANNELS.TRANSACTION_UPDATED && data.payload) {
          getEventEmitter().emit('subscription:transactionsUpdated', data.payload);
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };
      
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };
    
  } catch (error) {
    console.error('Failed to initialize subscription system:', error);
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
 * Subscribe to transaction updates
 */
export function subscribeToTransactionUpdates(callback: () => void): () => void {
  const emitter = getEventEmitter();
  const eventName = 'subscription:transactionsUpdated';
  
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