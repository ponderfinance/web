'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { 
  initRedisSubscriber, 
  onMetricsUpdated, 
  onTokenUpdated, 
  onPairUpdated,
  onTransactionUpdated,
  closeRedisSubscriber,
  getEventEmitter
} from '@/src/lib/redis/subscriber'
import { initRedisRecovery, stopRedisRecovery } from '@/src/lib/redis/recovery'
import { registerTokenPriceUpdater, applyStoreUpdate, createRelayEnvironment } from '@/src/relay/createRelayEnvironment'
import { initializeRelayUpdaters } from '@/src/relay/initRelayUpdaters'

// Define the context type
type RedisSubscriberContextType = {
  metricsLastUpdated: number | null
  pairLastUpdated: Record<string, number>
  tokenLastUpdated: Record<string, number>
  transactionLastUpdated: Record<string, number>
  refreshData: () => void
  // New function to check if an entity should be refreshed
  shouldEntityRefresh: (entityType: string, entityId: string, minInterval?: number) => boolean
}

// Create context with default values
const RedisSubscriberContext = createContext<RedisSubscriberContextType>({
  metricsLastUpdated: null,
  pairLastUpdated: {},
  tokenLastUpdated: {},
  transactionLastUpdated: {},
  refreshData: () => {},
  shouldEntityRefresh: () => false,
})

// Hook to use the redis subscriber context
export const useRedisSubscriber = () => useContext(RedisSubscriberContext)

// Provider component
export function RedisSubscriberProvider({ children }: { children: React.ReactNode }) {
  // State to track last update timestamps
  const [metricsLastUpdated, setMetricsLastUpdated] = useState<number | null>(null)
  const [pairLastUpdated, setPairLastUpdated] = useState<Record<string, number>>({})
  const [tokenLastUpdated, setTokenLastUpdated] = useState<Record<string, number>>({})
  const [transactionLastUpdated, setTransactionLastUpdated] = useState<Record<string, number>>({})
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Track direct store updates
  const directUpdatesRef = useRef<Record<string, number>>({})
  
  // Force refresh counter
  const [refreshCounter, setRefreshCounter] = useState(0)
  const refreshData = () => setRefreshCounter(prev => prev + 1)
  
  // Function to check if an entity should refresh based on last update
  const shouldEntityRefresh = (entityType: string, entityId: string, minInterval = 5000): boolean => {
    const key = `${entityType}-${entityId}`;
    const now = Date.now();
    const lastUpdate = directUpdatesRef.current[key] || 0;
    
    // Don't refresh if updated recently
    if (now - lastUpdate < minInterval) {
      return false;
    }
    
    // Mark as updated
    directUpdatesRef.current[key] = now;
    return true;
  }
  
  // Initialize subscriber and set up event handlers
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return
    
    console.log('Initializing Redis subscriber and recovery system...')
    
    // Register all store updaters for efficient updates using the new registry pattern
    initializeRelayUpdaters()
    
    // Define our handler functions first so we can reference them in cleanup
    const metricsHandler = (data: any) => {
      console.log('RedisSubscriber: received metrics update', data)
      
      // Always attempt direct store update first
      const env = createRelayEnvironment()
      let updated = false;
      
      if (env && data.metrics) {
        // Try to update protocol metrics directly in the store
        updated = applyStoreUpdate('global-metrics', data.metrics, env);
        if (updated) {
          console.log('Applied direct store update for global metrics');
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
      console.log('RedisSubscriber: received pair update', data)
      if (data.entityId) {
        // Always attempt direct store update first
        const env = createRelayEnvironment()
        let updated = false;
        
        if (env) {
          updated = applyStoreUpdate(`pair-${data.entityId}`, data, env);
          if (updated) {
            console.log('Applied direct store update for pair');
            // Track this direct update
            directUpdatesRef.current[`pair-${data.entityId}`] = Date.now();
          }
        }
        
        // Only update timestamp if direct update failed or if it's been a while
        if (!updated || shouldEntityRefresh('pair', data.entityId, 10000)) {
        setPairLastUpdated(prev => ({
          ...prev,
          [data.entityId]: data.timestamp || Date.now()
        }))
        }
      }
    }
    
    const tokenHandler = (data: any) => {
      console.log('RedisSubscriber: received token update', data)
      if (data.entityId) {
        // Always attempt direct store update first
        const env = createRelayEnvironment()
        let updated = false;
        
        if (env) {
          // Try both token-price and generic token updates
          updated = applyStoreUpdate(`token-price-${data.entityId}`, data, env);
          if (updated) {
            console.log('Applied direct store update for token price');
            // Track this direct update
            directUpdatesRef.current[`token-${data.entityId}`] = Date.now();
          }
        }
        
        // Only update timestamp if direct update failed or if it's been a while
        if (!updated || shouldEntityRefresh('token', data.entityId, 10000)) {
        setTokenLastUpdated(prev => ({
          ...prev,
          [data.entityId]: data.timestamp || Date.now()
        }))
        }
      }
    }
    
    const transactionHandler = (data: any) => {
      console.log('RedisSubscriber: received transaction update', data);
      
      // Handle different transaction message formats
      // The entityId might be in data.entityId or data.transactionId
      const entityId = data.entityId || data.transactionId;
      const timestamp = data.timestamp || Date.now();
      
      if (entityId) {
        // Always attempt direct store update first
        const env = createRelayEnvironment()
        let updated = false;
        
        if (env) {
          // Normalize the data for store update - make sure it has entityId property
          const normalizedData = { 
            ...data,
            entityId: entityId
          };
          
          updated = applyStoreUpdate(`transaction-${entityId}`, normalizedData, env);
          if (updated) {
            console.log(`Applied direct store update for transaction ${entityId}`);
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
      // Initialize Redis subscriber
      initRedisSubscriber()
      
      // Set up event handlers
      onMetricsUpdated(metricsHandler)
      onPairUpdated(pairHandler)
      onTokenUpdated(tokenHandler)
      onTransactionUpdated(transactionHandler)
      
      // Initialize Redis recovery system
      initRedisRecovery(30000) // Check every 30 seconds
      
      setIsInitialized(true)
    } catch (error) {
      console.error('Error initializing Redis subscriber:', error)
    }
    
    // Return cleanup function to properly remove listeners when component unmounts
    return () => {
      console.log('Cleaning up Redis subscriber event listeners and recovery system')
      const emitter = getEventEmitter()
      
      // Remove our specific event listeners
      emitter.removeListener('metrics:updated', metricsHandler)
      emitter.removeListener('pair:updated', pairHandler)
      emitter.removeListener('token:updated', tokenHandler)
      emitter.removeListener('transaction:updated', transactionHandler)
      
      // Stop the Redis recovery system
      stopRedisRecovery()
      
      // If this is the only component using the subscriber, we can close the connection
      // Consider using a ref counter pattern if multiple components might use this
      closeRedisSubscriber()
    }
  }, [isInitialized, refreshCounter])
  
  // Context value
  const value = {
    metricsLastUpdated,
    pairLastUpdated,
    tokenLastUpdated,
    transactionLastUpdated,
    refreshData,
    shouldEntityRefresh
  }
  
  return (
    <RedisSubscriberContext.Provider value={value}>
      {children}
    </RedisSubscriberContext.Provider>
  )
} 