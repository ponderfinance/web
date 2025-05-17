'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { 
  getRedisSingleton,
  ConnectionState,
  ConnectionEvent,
  REDIS_CHANNELS
} from '@/src/lib/redis/singleton'
import { applyStoreUpdate } from '@/src/relay/createRelayEnvironment'
import { initializeRelayUpdaters } from '@/src/relay/initRelayUpdaters'
import { getClientEnvironment } from '@/src/lib/relay/environment'

// Define the context type
type RedisSubscriberContextType = {
  metricsLastUpdated: number | null
  pairLastUpdated: Record<string, number>
  tokenLastUpdated: Record<string, number>
  transactionLastUpdated: Record<string, number>
  connectionState: ConnectionState
  connectionStateTimestamp: number
  retryCount: number
  refreshData: () => void
  // Function to check if an entity should be refreshed
  shouldEntityRefresh: (entityType: string, entityId: string, minInterval?: number) => boolean
}

// Create the context with a default value
const RedisSubscriberContext = createContext<RedisSubscriberContextType>({
  metricsLastUpdated: null,
  pairLastUpdated: {},
  tokenLastUpdated: {},
  transactionLastUpdated: {},
  connectionState: ConnectionState.DISCONNECTED,
  connectionStateTimestamp: 0,
  retryCount: 0,
  refreshData: () => {},
  shouldEntityRefresh: () => false
})

// Helper to create styled console logs
const logWithStyle = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
  if (typeof window === 'undefined') return; // Only log in browser
  
  const styles = {
    success: 'color: #00c853; font-weight: bold; font-size: 14px;',
    info: 'color: #2196f3; font-weight: bold;',
    error: 'color: #f44336; font-weight: bold;',
    warning: 'color: #ff9800; font-weight: bold;'
  };
  
  console.log(`%c${message}`, styles[type]);
};

// Custom hook to use the Redis subscriber context
export const useRedisSubscriber = () => useContext(RedisSubscriberContext)

// Improved provider component following best practices
export function RedisSubscriberProvider({ children }: { children: React.ReactNode }) {
  // Get Redis singleton instance
  const redisSingleton = getRedisSingleton();
  const eventEmitter = redisSingleton.getEventEmitter();
  
  // State to track last update timestamps
  const [metricsLastUpdated, setMetricsLastUpdated] = useState<number | null>(null)
  const [pairLastUpdated, setPairLastUpdated] = useState<Record<string, number>>({})
  const [tokenLastUpdated, setTokenLastUpdated] = useState<Record<string, number>>({})
  const [transactionLastUpdated, setTransactionLastUpdated] = useState<Record<string, number>>({})
  const [refreshCounter, setRefreshCounter] = useState(0)
  
  // Connection state
  const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED)
  const [connectionStateTimestamp, setConnectionStateTimestamp] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  
  // Store environment reference to prevent direct hook calls
  const environmentRef = useRef<any>(null);
  
  // Track direct store updates to avoid duplicate refreshes
  const directUpdatesRef = useRef<Record<string, number>>({})
  
  // Track initialization state
  const isInitializedRef = useRef(false);
  
  // Function to check if an entity should be refreshed based on time threshold
  const shouldEntityRefresh = (entityType: string, entityId: string, minInterval = 5000) => {
    const key = `${entityType}-${entityId}`
    const lastDirectUpdate = directUpdatesRef.current[key]
    const now = Date.now()
    
    // If no direct update or enough time has passed, allow refresh
    return !lastDirectUpdate || (now - lastDirectUpdate) > minInterval
  }
  
  // Function to force refresh all data
  const refreshData = () => {
    setRefreshCounter(prev => prev + 1)
  }
  
  // Initialize the environment safely
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Get the environment directly without using hooks
      environmentRef.current = getClientEnvironment();
      
      if (environmentRef.current) {
        logWithStyle('✅ RedisSubscriber: Got Relay environment successfully', 'success');
      } else {
        logWithStyle('⚠️ RedisSubscriber: Relay environment not available', 'warning');
      }
    } catch (error) {
      console.error('Error accessing Relay environment:', error);
    }
  }, []);
  
  // Track connection state changes
  useEffect(() => {
    // Skip SSR
    if (typeof window === 'undefined') return;
    
    // Handler for connection events
    const handleConnectionChange = (eventData: any) => {
      // Get the current state
      const { state, timestamp, retryCount } = redisSingleton.getConnectionState();
      
      // Update our local state
      setConnectionState(state);
      setConnectionStateTimestamp(timestamp);
      setRetryCount(retryCount);
      
      // Log connection changes with an appropriate style
      switch (state) {
        case ConnectionState.CONNECTED:
          logWithStyle('✅ Connected to real-time update service', 'success');
          break;
        case ConnectionState.CONNECTING:
          logWithStyle(`🔄 Connecting to real-time service (attempt ${retryCount})`, 'info');
          break;
        case ConnectionState.DISCONNECTED:
          logWithStyle('⚠️ Disconnected from real-time update service', 'warning');
          break;
        case ConnectionState.SUSPENDED:
          logWithStyle('❌ Real-time connection suspended temporarily', 'error');
          break;
      }
    };
    
    // Listen to all connection events
    redisSingleton.onConnectionEvent(ConnectionEvent.CONNECTED, handleConnectionChange);
    redisSingleton.onConnectionEvent(ConnectionEvent.DISCONNECTED, handleConnectionChange);
    redisSingleton.onConnectionEvent(ConnectionEvent.RECONNECTING, handleConnectionChange);
    redisSingleton.onConnectionEvent(ConnectionEvent.SUSPENDED, handleConnectionChange);
    redisSingleton.onConnectionEvent(ConnectionEvent.ERROR, handleConnectionChange);
    
    // Set initial state
    const initialState = redisSingleton.getConnectionState();
    setConnectionState(initialState.state);
    setConnectionStateTimestamp(initialState.timestamp);
    setRetryCount(initialState.retryCount);
    
    // Cleanup event listeners
    return () => {
      eventEmitter.off(ConnectionEvent.CONNECTED, handleConnectionChange);
      eventEmitter.off(ConnectionEvent.DISCONNECTED, handleConnectionChange);
      eventEmitter.off(ConnectionEvent.RECONNECTING, handleConnectionChange);
      eventEmitter.off(ConnectionEvent.SUSPENDED, handleConnectionChange);
      eventEmitter.off(ConnectionEvent.ERROR, handleConnectionChange);
    };
  }, [redisSingleton, eventEmitter]);
  
  // Initialize subscriber, event handlers, and cleanup - only once
  useEffect(() => {
    // Skip SSR
    if (typeof window === 'undefined') return;
    
    logWithStyle('🚀 Initializing Real-Time Update System...', 'info');
    
    // Register as a subscriber - this tracks active subscriptions
    redisSingleton.registerSubscriber();
    
    // Register all store updaters to handle real-time updates
    initializeRelayUpdaters();
    
    // Mark as initialized to prevent re-initialization
    isInitializedRef.current = true;
    
    // Define handler functions
    const metricsHandler = (data: any) => {
      // Skip if connection is suspended
      if (connectionState === ConnectionState.SUSPENDED) return;
      
      logWithStyle('📈 Received protocol metrics update', 'info');
      
      let updated = false;
      
      if (environmentRef.current && data.metrics) {
        // Try to update protocol metrics directly in the store
        updated = applyStoreUpdate('global-metrics', data.metrics, environmentRef.current);
        if (updated) {
          logWithStyle('✅ Applied direct store update for global metrics', 'success');
          // Track this direct update
          directUpdatesRef.current['metrics-global'] = Date.now();
        }
      }
      
      // Only update timestamp if direct update failed or if it's been a while
      if (!updated || shouldEntityRefresh('metrics', 'global', 15000)) {
        setMetricsLastUpdated(data.timestamp || Date.now());
      }
    };
    
    const pairHandler = (data: any) => {
      // Skip if connection is suspended
      if (connectionState === ConnectionState.SUSPENDED) return;
      
      // Extract entity ID from the data
      const entityId = data.entityId || data.pairId;
      if (!entityId) {
        console.warn('Pair update missing entityId/pairId', data);
        return;
      }
      
      logWithStyle(`🔄 Received pair update for ${entityId.slice(0, 6)}...`, 'info');
      
      let updated = false;
      
      if (environmentRef.current) {
        updated = applyStoreUpdate(`pair-${entityId}`, data, environmentRef.current);
        if (updated) {
          logWithStyle(`✅ Applied direct store update for pair ${entityId.slice(0, 6)}...`, 'success');
          // Track this direct update
          directUpdatesRef.current[`pair-${entityId}`] = Date.now();
        }
      }
      
      // Only update timestamps if direct update failed or we need to refresh
      if (!updated || shouldEntityRefresh('pair', entityId, 10000)) {
        setPairLastUpdated(prev => ({
          ...prev,
          [entityId]: data.timestamp || Date.now()
        }));
      }
    };
    
    const tokenHandler = (data: any) => {
      // Skip if connection is suspended
      if (connectionState === ConnectionState.SUSPENDED) return;
      
      // Extract entity ID from the data
      const entityId = data.entityId || data.tokenId;
      if (!entityId) {
        console.warn('Token update missing entityId/tokenId', data);
        return;
      }
      
      logWithStyle(`💱 Received token update for ${entityId.slice(0, 6)}...`, 'info');
      
      let updated = false;
      
      if (environmentRef.current) {
        updated = applyStoreUpdate(`token-price-${entityId}`, data, environmentRef.current);
        if (updated) {
          logWithStyle(`✅ Applied direct store update for token ${entityId.slice(0, 6)}...`, 'success');
          // Track this direct update
          directUpdatesRef.current[`token-${entityId}`] = Date.now();
        }
      }
      
      // Only update token timestamps if direct update failed
      if (!updated || shouldEntityRefresh('token', entityId)) {
        setTokenLastUpdated(prev => ({
          ...prev,
          [entityId]: data.timestamp || Date.now()
        }));
      }
    };
    
    const transactionHandler = (data: any) => {
      // Skip if connection is suspended
      if (connectionState === ConnectionState.SUSPENDED) return;
      
      // Handle different transaction message formats
      const entityId = data.entityId || data.transactionId;
      const txHash = data.txHash || '';
      const timestamp = data.timestamp || Date.now();
      
      if (entityId) {
        logWithStyle(`💸 Transaction update: ${txHash ? txHash.slice(0, 8) : entityId.slice(0, 8)}...`, 'info');
        
        let updated = false;
        
        if (environmentRef.current) {
          // Normalize the data for store update
          const normalizedData = { 
            ...data,
            entityId: entityId
          };
          
          updated = applyStoreUpdate(`transaction-${entityId}`, normalizedData, environmentRef.current);
          if (updated) {
            logWithStyle(`✅ Applied direct update for transaction ${entityId.slice(0, 8)}...`, 'success');
            // Track this direct update
            directUpdatesRef.current[`transaction-${entityId}`] = timestamp;
          }
        }
        
        // Only update transaction timestamps if direct update failed or we need to
        if (!updated || shouldEntityRefresh('transaction', entityId, 2000)) { 
          setTransactionLastUpdated(prev => ({
            ...prev,
            [entityId]: timestamp
          }));
        }
      } else {
        console.warn('Transaction update missing entityId/transactionId', data);
      }
    };
    
    try {
      // Initialize Redis subscriber through the singleton
      redisSingleton.initRedisSubscriber(false); // Client mode
      
      // Set up event handlers
      redisSingleton.onMetricsUpdated(metricsHandler);
      redisSingleton.onPairUpdated(pairHandler);
      redisSingleton.onTokenUpdated(tokenHandler);
      redisSingleton.onTransactionUpdated(transactionHandler);
    } catch (error) {
      console.error('Error setting up real-time updates:', error);
    }
    
    // Cleanup function
    return () => {
      // Remove event handlers
      eventEmitter.removeListener('metrics:updated', metricsHandler);
      eventEmitter.removeListener('pair:updated', pairHandler);
      eventEmitter.removeListener('token:updated', tokenHandler);
      eventEmitter.removeListener('transaction:updated', transactionHandler);
      
      // Unregister subscriber
      if (redisSingleton.unregisterSubscriber()) {
        logWithStyle('👋 Closing real-time connection as all subscribers are gone', 'info');
        redisSingleton.closeRedisSubscriber();
      }
    };
  }, []); // Only run once on mount, don't recreate connections unnecessarily
  
  // Context value with connection state
  const value = {
    metricsLastUpdated,
    pairLastUpdated,
    tokenLastUpdated,
    transactionLastUpdated,
    connectionState,
    connectionStateTimestamp,
    retryCount,
    refreshData,
    shouldEntityRefresh
  };
  
  return (
    <RedisSubscriberContext.Provider value={value}>
      {children}
    </RedisSubscriberContext.Provider>
  );
}