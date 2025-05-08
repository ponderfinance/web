'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { initRedisSubscriber, onMetricsUpdated, onPairUpdated, onTokenUpdated } from '@/src/lib/redis/subscriber'

// Define the context type
type RedisSubscriberContextType = {
  metricsLastUpdated: number | null
  pairLastUpdated: Record<string, number>
  tokenLastUpdated: Record<string, number>
  refreshData: () => void
}

// Create context with default values
const RedisSubscriberContext = createContext<RedisSubscriberContextType>({
  metricsLastUpdated: null,
  pairLastUpdated: {},
  tokenLastUpdated: {},
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
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Force refresh counter
  const [refreshCounter, setRefreshCounter] = useState(0)
  const refreshData = () => setRefreshCounter(prev => prev + 1)
  
  // Initialize subscriber and set up event handlers
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return
    
    console.log('Initializing Redis subscriber...')
    try {
      // Initialize Redis subscriber
      initRedisSubscriber()
      
      // Set up event handlers
      onMetricsUpdated((data) => {
        console.log('RedisSubscriber: received metrics update', data)
        setMetricsLastUpdated(data.timestamp || Date.now())
      })
      
      onPairUpdated((data) => {
        console.log('RedisSubscriber: received pair update', data)
        if (data.entityId) {
          setPairLastUpdated(prev => ({
            ...prev,
            [data.entityId]: data.timestamp || Date.now()
          }))
        }
      })
      
      onTokenUpdated((data) => {
        console.log('RedisSubscriber: received token update', data)
        if (data.entityId) {
          setTokenLastUpdated(prev => ({
            ...prev,
            [data.entityId]: data.timestamp || Date.now()
          }))
        }
      })
      
      setIsInitialized(true)
    } catch (error) {
      console.error('Error initializing Redis subscriber:', error)
    }
  }, [isInitialized, refreshCounter])
  
  // Context value
  const value = {
    metricsLastUpdated,
    pairLastUpdated,
    tokenLastUpdated,
    refreshData
  }
  
  return (
    <RedisSubscriberContext.Provider value={value}>
      {children}
    </RedisSubscriberContext.Provider>
  )
} 