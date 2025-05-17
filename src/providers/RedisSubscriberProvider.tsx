'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { 
  registerSubscriber,
  unregisterSubscriber,
  getSubscriberEventEmitter,
  REDIS_CHANNELS,
  ConnectionState,
  ConnectionEvent,
  getConnectionState
} from '@/src/lib/redis/eventService';
import { applyStoreUpdate } from '@/src/relay/createRelayEnvironment'
import { initializeRelayUpdaters } from '@/src/relay/initRelayUpdaters'
import { getClientEnvironment } from '@/src/lib/relay/environment'

// Context type definition
type RedisSubscriberContextType = {
  metricsLastUpdated: number | null
  pairLastUpdated: Record<string, number>
  tokenLastUpdated: Record<string, number>
  transactionLastUpdated: Record<string, number>
  connectionState: ConnectionState
  refreshData: () => void
  shouldEntityRefresh: (entityType: string, entityId: string, minInterval?: number) => boolean
}

// Create context with default values
const RedisSubscriberContext = createContext<RedisSubscriberContextType>({
  metricsLastUpdated: null,
  pairLastUpdated: {},
  tokenLastUpdated: {},
  transactionLastUpdated: {},
  connectionState: ConnectionState.DISCONNECTED,
  refreshData: () => {},
  shouldEntityRefresh: () => false
})

// Custom hook to use the context
export const useRedisSubscriber = () => useContext(RedisSubscriberContext)

// Provider component
export function RedisSubscriberProvider({ children }: { children: React.ReactNode }) {
  // Update timestamps
  const [metricsLastUpdated, setMetricsLastUpdated] = useState<number | null>(null)
  const [pairLastUpdated, setPairLastUpdated] = useState<Record<string, number>>({})
  const [tokenLastUpdated, setTokenLastUpdated] = useState<Record<string, number>>({})
  const [transactionLastUpdated, setTransactionLastUpdated] = useState<Record<string, number>>({})
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // References
  const environmentRef = useRef<any>(null);
  const updatesRef = useRef<Record<string, number>>({});
  const initialized = useRef(false);
  const pollingTimerRef = useRef<any>(null);
  
  // Get Relay environment
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      environmentRef.current = getClientEnvironment();
      console.log('✅ Got Relay environment');
    } catch (error) {
      console.error('Error accessing Relay environment:', error);
    }
  }, []);
  
  // Function to check if an entity should be refreshed
  const shouldEntityRefresh = (entityType: string, entityId: string, minInterval = 5000) => {
    const key = `${entityType}-${entityId}`;
    const lastUpdate = updatesRef.current[key];
    const now = Date.now();
    
    return !lastUpdate || (now - lastUpdate) > minInterval;
  };
  
  // Force refresh all data
  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Setup polling fallback when connection is suspended or disconnected for too long
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Clear any existing polling timer
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    
    // Start polling if suspended or disconnected
    if (connectionState === ConnectionState.SUSPENDED) {
      console.log('🔄 Connection suspended, using polling fallback');
      
      // Set up metrics polling
      pollingTimerRef.current = setInterval(async () => {
        try {
          // Get metrics via GraphQL
          const result = await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `query ProtocolMetrics {
                protocol {
                  totalValueLockedUSD
                  dailyVolumeUSD
                  weeklyVolumeUSD
                }
              }`
            })
          }).then(r => r.json());
          
          if (result?.data?.protocol) {
            console.log('📊 Polling: got metrics data');
            setMetricsLastUpdated(Date.now());
            
            // Update store if possible
            if (environmentRef.current) {
              applyStoreUpdate('global-metrics', { 
                metrics: result.data.protocol 
              }, environmentRef.current);
            }
          }
        } catch (error) {
          console.error('Error polling metrics:', error);
        }
      }, 30000); // Poll every 30 seconds
      
      // Clean up on unmount
      return () => {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
        }
      };
    }
  }, [connectionState]);
  
  // Handle connection state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleConnectionEvent = () => {
      const currentState = getConnectionState();
      setConnectionState(currentState);
    };
    
    // Listen to connection events
    const emitter = getSubscriberEventEmitter();
    emitter.on(ConnectionEvent.CONNECTED, handleConnectionEvent);
    emitter.on(ConnectionEvent.DISCONNECTED, handleConnectionEvent);
    emitter.on(ConnectionEvent.ERROR, handleConnectionEvent);
    emitter.on(ConnectionEvent.SUSPENDED, handleConnectionEvent);
    
    // Set initial state
    setConnectionState(getConnectionState());
    
    return () => {
      emitter.off(ConnectionEvent.CONNECTED, handleConnectionEvent);
      emitter.off(ConnectionEvent.DISCONNECTED, handleConnectionEvent);
      emitter.off(ConnectionEvent.ERROR, handleConnectionEvent);
      emitter.off(ConnectionEvent.SUSPENDED, handleConnectionEvent);
    };
  }, []);
  
  // Set up event handlers for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined' || initialized.current) return;
    
    console.log('🚀 Initializing real-time update handlers');
    initialized.current = true;
    
    // Register as a subscriber
    registerSubscriber();
    
    // Initialize Relay updaters
    initializeRelayUpdaters();
    
    // Metrics update handler
    const handleMetricsUpdate = (data: any) => {
      console.log('📈 Metrics update received');
      
      // Try direct store update
      let updated = false;
      if (environmentRef.current) {
        updated = applyStoreUpdate('global-metrics', data, environmentRef.current);
        if (updated) {
          updatesRef.current['metrics-global'] = Date.now();
        }
      }
      
      // Update timestamp
      setMetricsLastUpdated(Date.now());
    };
    
    // Pair update handler
    const handlePairUpdate = (data: any) => {
      const entityId = data.entityId || data.pairId;
      if (!entityId) return;
      
      // Try direct store update
      let updated = false;
      if (environmentRef.current) {
        updated = applyStoreUpdate(`pair-${entityId}`, data, environmentRef.current);
        if (updated) {
          updatesRef.current[`pair-${entityId}`] = Date.now();
        }
      }
      
      // Update timestamp
      setPairLastUpdated(prev => ({
        ...prev,
        [entityId]: Date.now()
      }));
    };
    
    // Token update handler
    const handleTokenUpdate = (data: any) => {
      const entityId = data.entityId || data.tokenId;
      if (!entityId) return;
      
      // Try direct store update
      let updated = false;
      if (environmentRef.current) {
        updated = applyStoreUpdate(`token-price-${entityId}`, data, environmentRef.current);
        if (updated) {
          updatesRef.current[`token-${entityId}`] = Date.now();
        }
      }
      
      // Update timestamp
      setTokenLastUpdated(prev => ({
        ...prev,
        [entityId]: Date.now()
      }));
    };
    
    // Transaction update handler
    const handleTransactionUpdate = (data: any) => {
      const entityId = data.entityId || data.transactionId;
      if (!entityId) return;
      
      // Try direct store update
      let updated = false;
      if (environmentRef.current) {
        updated = applyStoreUpdate(`transaction-${entityId}`, data, environmentRef.current);
        if (updated) {
          updatesRef.current[`transaction-${entityId}`] = Date.now();
        }
      }
      
      // Update timestamp
      setTransactionLastUpdated(prev => ({
        ...prev,
        [entityId]: Date.now()
      }));
    };
    
    // Set up event listeners
    const emitter = getSubscriberEventEmitter();
    emitter.on(REDIS_CHANNELS.METRICS_UPDATED, handleMetricsUpdate);
    emitter.on(REDIS_CHANNELS.PAIR_UPDATED, handlePairUpdate);
    emitter.on(REDIS_CHANNELS.TOKEN_UPDATED, handleTokenUpdate);
    emitter.on(REDIS_CHANNELS.TRANSACTION_UPDATED, handleTransactionUpdate);
    
    // Clean up
    return () => {
      emitter.off(REDIS_CHANNELS.METRICS_UPDATED, handleMetricsUpdate);
      emitter.off(REDIS_CHANNELS.PAIR_UPDATED, handlePairUpdate);
      emitter.off(REDIS_CHANNELS.TOKEN_UPDATED, handleTokenUpdate);
      emitter.off(REDIS_CHANNELS.TRANSACTION_UPDATED, handleTransactionUpdate);
      
      unregisterSubscriber();
    };
  }, []);
  
  // Context value
  const contextValue = {
    metricsLastUpdated,
    pairLastUpdated,
    tokenLastUpdated,
    transactionLastUpdated,
    connectionState,
    refreshData,
    shouldEntityRefresh
  };
  
  return (
    <RedisSubscriberContext.Provider value={contextValue}>
      {children}
    </RedisSubscriberContext.Provider>
  );
}