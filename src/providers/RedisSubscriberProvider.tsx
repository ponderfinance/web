'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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

// Define the context type
type RedisSubscriberContextType = {
  metricsLastUpdated: number | null
  pairLastUpdated: Record<string, number>
  tokenLastUpdated: Record<string, number>
  transactionLastUpdated: Record<string, number>
  refreshData: () => void
}

// Create context with default values
const RedisSubscriberContext = createContext<RedisSubscriberContextType>({
  metricsLastUpdated: null,
  pairLastUpdated: {},
  tokenLastUpdated: {},
  transactionLastUpdated: {},
  refreshData: () => {},
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
  
  // Force refresh counter
  const [refreshCounter, setRefreshCounter] = useState(0)
  const refreshData = () => setRefreshCounter(prev => prev + 1)
  
  // Initialize subscriber and set up event handlers
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return
    
    console.log('Initializing Redis subscriber and recovery system...')
    
    // Register store updaters for efficient updates
    registerTokenPriceUpdater()
    
    // Define our handler functions first so we can reference them in cleanup
    const metricsHandler = (data: any) => {
      console.log('RedisSubscriber: received metrics update', data)
      setMetricsLastUpdated(data.timestamp || Date.now())
    }
    
    const pairHandler = (data: any) => {
      console.log('RedisSubscriber: received pair update', data)
      if (data.entityId) {
        // Try to update the store directly
        const env = createRelayEnvironment()
        if (env && applyStoreUpdate(`pair-${data.entityId}`, data, env)) {
          console.log('Applied direct store update for pair')
        }
        
        // Always update the timestamp for components that need it
        setPairLastUpdated(prev => ({
          ...prev,
          [data.entityId]: data.timestamp || Date.now()
        }))
      }
    }
    
    const tokenHandler = (data: any) => {
      console.log('RedisSubscriber: received token update', data)
      if (data.entityId) {
        // Try to update the store directly
        const env = createRelayEnvironment()
        if (env && applyStoreUpdate(`token-price-${data.entityId}`, data, env)) {
          console.log('Applied direct store update for token price')
        }
        
        // Always update the timestamp for components that need it
        setTokenLastUpdated(prev => ({
          ...prev,
          [data.entityId]: data.timestamp || Date.now()
        }))
      }
    }
    
    const transactionHandler = (data: any) => {
      console.log('RedisSubscriber: received transaction update', data)
      if (data.entityId) {
        setTransactionLastUpdated(prev => ({
          ...prev,
          [data.entityId]: data.timestamp || Date.now()
        }))
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
    refreshData
  }
  
  return (
    <RedisSubscriberContext.Provider value={value}>
      {children}
    </RedisSubscriberContext.Provider>
  )
} 