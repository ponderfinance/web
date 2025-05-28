'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { applyStoreUpdate } from '@/src/relay/createRelayEnvironment'
import { initializeRelayUpdaters } from '@/src/relay/initRelayUpdaters'
import { getClientEnvironment } from '@/src/lib/relay/environment'

// Define types to avoid importing Redis modules at startup
type ConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SUSPENDED'

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
  connectionState: 'DISCONNECTED',
  refreshData: () => {},
  shouldEntityRefresh: () => false
})

// Custom hook to use the context
export const useRedisSubscriber = () => useContext(RedisSubscriberContext)

// Debug helper function that can be called from dev tools
export function enableRedisDebugMode() {
  if (typeof window !== 'undefined') {
    window.__REDIS_DEBUG = true;
    console.log('Redis debug mode enabled. Events will be logged to the console.');
    console.log('To disable, run: window.__REDIS_DEBUG = false');
  }
}

// Expose the debug helper on window for easy access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // @ts-ignore - Adding to window for debugging
  window.enableRedisDebugMode = enableRedisDebugMode;
}

// Provider component following Next.js best practices
export function RedisSubscriberProvider({ children }: { children: React.ReactNode }) {
  // State
  const [metricsLastUpdated, setMetricsLastUpdated] = useState<number | null>(null)
  const [pairLastUpdated, setPairLastUpdated] = useState<Record<string, number>>({})
  const [tokenLastUpdated, setTokenLastUpdated] = useState<Record<string, number>>({})
  const [transactionLastUpdated, setTransactionLastUpdated] = useState<Record<string, number>>({})
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED')
  const [isClient, setIsClient] = useState(false)
  
  // Refs
  const environmentRef = useRef<any>(null)
  const updatesRef = useRef<Record<string, number>>({})
  const cleanupRef = useRef<(() => void) | null>(null)
  
  // Mark as client-side after hydration  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // Get Relay environment on client-side
  useEffect(() => {
    if (!isClient) return
    
    try {
      environmentRef.current = getClientEnvironment()
    } catch (error) {
      console.error('Error accessing Relay environment:', error)
    }
  }, [isClient])
  
  // Function to check if an entity should be refreshed
  const shouldEntityRefresh = (entityType: string, entityId: string, minInterval = 5000) => {
    const key = `${entityType}-${entityId}`
    const lastUpdate = updatesRef.current[key]
    const now = Date.now()
    
    return !lastUpdate || (now - lastUpdate) > minInterval
  }
  
  // Force refresh all data
  const refreshData = () => {
    // Trigger a re-render and clear update cache
    updatesRef.current = {}
    setMetricsLastUpdated(Date.now())
  }
  
  // Initialize Redis functionality on client-side only
  useEffect(() => {
    if (!isClient) return
    
    // Dynamic import to avoid build-time issues
    const initRedis = async () => {
      try {
        const redisModule = await import('@/src/lib/redis/eventService')
        
        // Register as subscriber
        redisModule.registerSubscriber()
        initializeRelayUpdaters()
        
        // Connection state handler
        const handleConnectionEvent = () => {
          const currentState = redisModule.getConnectionState()
          
          if (currentState === redisModule.ConnectionState.CONNECTED) {
            setConnectionState('CONNECTED')
          } else if (currentState === redisModule.ConnectionState.DISCONNECTED) {
            setConnectionState('DISCONNECTED')
          } else if (currentState === redisModule.ConnectionState.SUSPENDED) {
            setConnectionState('SUSPENDED')
          } else {
            setConnectionState('ERROR')
          }
        }
        
        // Event handlers
        const handleMetricsUpdate = (data: any) => {
          if (environmentRef.current) {
            const updated = applyStoreUpdate('global-metrics', data, environmentRef.current)
            if (updated) {
              updatesRef.current['metrics-global'] = Date.now()
            }
          }
          setMetricsLastUpdated(Date.now())
        }
        
        const handlePairUpdate = (data: any) => {
          const entityId = data.entityId || data.pairId
          if (!entityId) return
          
          if (environmentRef.current) {
            const updated = applyStoreUpdate(`pair-${entityId}`, data, environmentRef.current)
            if (updated) {
              updatesRef.current[`pair-${entityId}`] = Date.now()
            }
          }
          
          setPairLastUpdated(prev => ({
            ...prev,
            [entityId]: Date.now()
          }))
        }
        
        const handleTokenUpdate = (data: any) => {
          const entityId = data.entityId || data.tokenId
          if (!entityId) return
          
          if (environmentRef.current) {
            const updated = applyStoreUpdate(`token-price-${entityId}`, data, environmentRef.current)
            if (updated) {
              updatesRef.current[`token-${entityId}`] = Date.now()
            }
          }
          
          setTokenLastUpdated(prev => ({
            ...prev,
            [entityId]: Date.now()
          }))
        }
        
        const handleTransactionUpdate = (data: any) => {
          const entityId = data.entityId || data.transactionId
          if (!entityId) return
          
          if (environmentRef.current) {
            const updated = applyStoreUpdate(`transaction-${entityId}`, data, environmentRef.current)
            if (updated) {
              updatesRef.current[`transaction-${entityId}`] = Date.now()
            }
          }
          
          setTransactionLastUpdated(prev => ({
            ...prev,
            [entityId]: Date.now()
          }))
        }
        
        // Set up event listeners
        const emitter = redisModule.getSubscriberEventEmitter()
        emitter.on(redisModule.ConnectionEvent.CONNECTED, handleConnectionEvent)
        emitter.on(redisModule.ConnectionEvent.DISCONNECTED, handleConnectionEvent)
        emitter.on(redisModule.ConnectionEvent.ERROR, handleConnectionEvent)
        emitter.on(redisModule.ConnectionEvent.SUSPENDED, handleConnectionEvent)
        emitter.on(redisModule.REDIS_CHANNELS.METRICS_UPDATED, handleMetricsUpdate)
        emitter.on(redisModule.REDIS_CHANNELS.PAIR_UPDATED, handlePairUpdate)
        emitter.on(redisModule.REDIS_CHANNELS.TOKEN_UPDATED, handleTokenUpdate)
        emitter.on(redisModule.REDIS_CHANNELS.TRANSACTION_UPDATED, handleTransactionUpdate)
        
        // Set initial state
        handleConnectionEvent()
        
        // Store cleanup function
        cleanupRef.current = () => {
          emitter.off(redisModule.ConnectionEvent.CONNECTED, handleConnectionEvent)
          emitter.off(redisModule.ConnectionEvent.DISCONNECTED, handleConnectionEvent)
          emitter.off(redisModule.ConnectionEvent.ERROR, handleConnectionEvent)
          emitter.off(redisModule.ConnectionEvent.SUSPENDED, handleConnectionEvent)
          emitter.off(redisModule.REDIS_CHANNELS.METRICS_UPDATED, handleMetricsUpdate)
          emitter.off(redisModule.REDIS_CHANNELS.PAIR_UPDATED, handlePairUpdate)
          emitter.off(redisModule.REDIS_CHANNELS.TOKEN_UPDATED, handleTokenUpdate)
          emitter.off(redisModule.REDIS_CHANNELS.TRANSACTION_UPDATED, handleTransactionUpdate)
          redisModule.unregisterSubscriber()
        }
        
      } catch (error) {
        console.error('Redis initialization failed:', error)
        // App continues without Redis functionality
      }
    }
    
    initRedis()
    
    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [isClient])
  
  // Context value
  const contextValue = {
    metricsLastUpdated,
    pairLastUpdated,
    tokenLastUpdated,
    transactionLastUpdated,
    connectionState,
    refreshData,
    shouldEntityRefresh
  }
  
  return (
    <RedisSubscriberContext.Provider value={contextValue}>
      {children}
    </RedisSubscriberContext.Provider>
  )
}