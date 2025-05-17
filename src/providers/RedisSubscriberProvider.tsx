'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { 
  initRedisSubscriber, 
  onMetricsUpdated, 
  onTokenUpdated, 
  onPairUpdated,
  onTransactionUpdated,
  closeRedisSubscriber,
  getEventEmitter,
  registerSubscriber,
  unregisterSubscriber
} from '@/src/lib/redis/subscriber'
import { applyStoreUpdate } from '@/src/relay/createRelayEnvironment'
import { initializeRelayUpdaters } from '@/src/relay/initRelayUpdaters'
import { useRelayEnvironment } from 'react-relay'

// Define the context type
type RedisSubscriberContextType = {
  metricsLastUpdated: number | null
  pairLastUpdated: Record<string, number>
  tokenLastUpdated: Record<string, number>
  transactionLastUpdated: Record<string, number>
  refreshData: () => void
  // Function to check if an entity should be refreshed
  shouldEntityRefresh: (entityType: string, entityId: string, minInterval?: number) => boolean
  // Indicate if real-time updates are enabled
  isRealtimeEnabled: boolean
}

// Create the context with a default value
const RedisSubscriberContext = createContext<RedisSubscriberContextType>({
  metricsLastUpdated: null,
  pairLastUpdated: {},
  tokenLastUpdated: {},
  transactionLastUpdated: {},
  refreshData: () => {},
  shouldEntityRefresh: () => false,
  isRealtimeEnabled: false
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

// Provider component - modified to handle the case when Relay environment isn't available yet
export function RedisSubscriberProvider({ children }: { children: React.ReactNode }) {
  // Try to get the Relay environment, but don't throw if it's not available
  let environment;
  try {
    environment = useRelayEnvironment();
  } catch (error) {
    // Environment not available yet, we'll render without real-time updates
    logWithStyle('⏳ Relay environment not ready yet, rendering without real-time updates', 'warning');
  }
  
  // State to track last update timestamps
  const [metricsLastUpdated, setMetricsLastUpdated] = useState<number | null>(null)
  const [pairLastUpdated, setPairLastUpdated] = useState<Record<string, number>>({})
  const [tokenLastUpdated, setTokenLastUpdated] = useState<Record<string, number>>({})
  const [transactionLastUpdated, setTransactionLastUpdated] = useState<Record<string, number>>({})
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Track direct store updates to avoid duplicate refreshes
  const directUpdatesRef = useRef<Record<string, number>>({})
  
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
  
  // If environment is not available, render children with a context that indicates
  // real-time updates are not enabled
  if (!environment) {
    return (
      <RedisSubscriberContext.Provider value={{
        metricsLastUpdated: null,
        pairLastUpdated: {},
        tokenLastUpdated: {},
        transactionLastUpdated: {},
        refreshData: () => {},
        shouldEntityRefresh: () => false,
        isRealtimeEnabled: false
      }}>
        {children}
      </RedisSubscriberContext.Provider>
    );
  }
  
  // Register subscriber when provider mounts
  useEffect(() => {
    if (typeof window !== 'undefined' && environment) {
      // Log that we have access to the Relay environment
      logWithStyle('✅ RedisSubscriber has valid Relay environment', 'success');
      
      // Register a subscriber - this tracks how many components use real-time updates
      registerSubscriber();
      
      // Unregister when unmounted
      return () => {
        unregisterSubscriber();
      };
    }
  }, [environment]);
  
  // Initialize subscriber and set up event handlers
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized || !environment) return
    
    logWithStyle('🚀 Initializing Real-Time Update System...', 'info')
    
    // Register all store updaters
    initializeRelayUpdaters()
    
    // Define our handler functions first so we can reference them in cleanup
    const metricsHandler = (data: any) => {
      logWithStyle('📈 Received protocol metrics update', 'info')
      
      let updated = false;
      
      if (environment && data.metrics) {
        // Try to update protocol metrics directly in the store
        updated = applyStoreUpdate('global-metrics', data.metrics, environment);
        if (updated) {
          logWithStyle('✅ Applied direct store update for global metrics', 'success');
          // Track this direct update
          directUpdatesRef.current['metrics-global'] = Date.now();
        }
      }
      
      // Only update timestamp if direct update failed or if it's been a while
      if (!updated || shouldEntityRefresh('metrics', 'global', 15000)) {
        setMetricsLastUpdated(data.timestamp || Date.now())
      }
    }
    
    const pairHandler = (data: any) => {
      // Extract entity ID from the data
      const entityId = data.entityId || data.pairId;
      if (!entityId) {
        console.warn('Pair update missing entityId/pairId', data);
        return;
      }
      
      logWithStyle(`🔄 Received pair update for ${entityId.slice(0, 6)}...`, 'info');
      
      let updated = false;
      
      if (environment) {
        updated = applyStoreUpdate(`pair-${entityId}`, data, environment);
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
    }
    
    const tokenHandler = (data: any) => {
      // Extract entity ID from the data
      const entityId = data.entityId || data.tokenId;
      if (!entityId) {
        console.warn('Token update missing entityId/tokenId', data);
        return;
      }
      
      logWithStyle(`💱 Received token update for ${entityId.slice(0, 6)}...`, 'info');
      
      let updated = false;
      
      if (environment) {
        updated = applyStoreUpdate(`token-price-${entityId}`, data, environment);
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
    }
    
    const transactionHandler = (data: any) => {
      // Handle different transaction message formats
      // The entityId might be in data.entityId or data.transactionId
      const entityId = data.entityId || data.transactionId;
      const txHash = data.txHash || '';
      const timestamp = data.timestamp || Date.now();
      
      if (entityId) {
        logWithStyle(`💸 Transaction update: ${txHash ? txHash.slice(0, 8) : entityId.slice(0, 8)}...`, 'info');
        
        let updated = false;
        
        if (environment) {
          // Normalize the data for store update - make sure it has entityId property
          const normalizedData = { 
            ...data,
            entityId: entityId
          };
          
          updated = applyStoreUpdate(`transaction-${entityId}`, normalizedData, environment);
          if (updated) {
            logWithStyle(`✅ Applied direct update for transaction ${entityId.slice(0, 8)}...`, 'success');
            // Track this direct update
            directUpdatesRef.current[`transaction-${entityId}`] = timestamp;
          }
        }
        
        // Only update transaction timestamps if direct update failed or we need to
        if (!updated || shouldEntityRefresh('transaction', entityId, 2000)) { // More aggressive 2s threshold
          setTransactionLastUpdated(prev => ({
            ...prev,
            [entityId]: timestamp
          }))
        }
      } else {
        console.warn('Transaction update missing entityId/transactionId', data);
      }
    }
    
    try {
      // Initialize Redis subscriber (SSE connection only, no direct Redis)
      initRedisSubscriber()
      
      // Set up event handlers
      onMetricsUpdated(metricsHandler)
      onPairUpdated(pairHandler)
      onTokenUpdated(tokenHandler)
      onTransactionUpdated(transactionHandler)
      
      logWithStyle('✅ Real-time update handlers registered successfully', 'success');
      setIsInitialized(true)
    } catch (error) {
      logWithStyle('❌ Error initializing real-time updates', 'error')
      console.error('Error details:', error)
    }
    
    // Return cleanup function to properly remove listeners when component unmounts
    return () => {
      logWithStyle('🛑 Shutting down real-time update system...', 'warning')
      const emitter = getEventEmitter()
      
      // Remove our specific event listeners
      emitter.removeListener('metrics:updated', metricsHandler)
      emitter.removeListener('pair:updated', pairHandler)
      emitter.removeListener('token:updated', tokenHandler)
      emitter.removeListener('transaction:updated', transactionHandler)
      
      // Close if no other subscribers need the connection
      closeRedisSubscriber()
    }
  }, [isInitialized, refreshCounter, environment])
  
  // Context value
  const value = {
    metricsLastUpdated,
    pairLastUpdated,
    tokenLastUpdated,
    transactionLastUpdated,
    refreshData,
    shouldEntityRefresh,
    isRealtimeEnabled: true
  }
  
  return (
    <RedisSubscriberContext.Provider value={value}>
      {children}
    </RedisSubscriberContext.Provider>
  )
} 