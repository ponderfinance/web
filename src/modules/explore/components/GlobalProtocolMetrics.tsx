'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, Card, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery, useQueryLoader, PreloadedQuery, usePreloadedQuery } from 'react-relay'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'

// Define the GraphQL query
export const globalProtocolMetricsQuery = graphql`
  query GlobalProtocolMetricsQuery {
    protocolMetrics {
      dailyVolumeUSD
      totalValueLockedUSD
      volume1hChange
      volume24hChange
    }
  }
`

// Helper function to format currency values
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '$0'
  
  if (numValue >= 1e9) {
    return `$${(numValue / 1e9).toFixed(2)}B`
  } else if (numValue >= 1e6) {
    return `$${(numValue / 1e6).toFixed(2)}M`
  } else if (numValue >= 1e3) {
    return `$${(numValue / 1e3).toFixed(2)}K`
  } else {
    return `$${numValue.toFixed(2)}`
  }
}

// Helper function to format percentage changes
const formatPercentage = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '0%'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

// Loading skeleton for metrics
export const GlobalProtocolMetricsSkeleton = () => {
  return (
    <View direction="row" align="center" gap={6} wrap className="justify-between">
      <View gap={2}>
        <Text variant="body-2" color="neutral-faded">
          24h Volume
        </Text>
        <View direction="row" align="baseline" gap={2}>
          <Skeleton width="120px" height="30px" />
        </View>
      </View>
      <View gap={2}>
        <Text variant="body-2" color="neutral-faded">
          Total TVL
        </Text>
        <View direction="row" align="baseline" gap={2}>
          <Skeleton width="120px" height="30px" />
        </View>
      </View>
    </View>
  )
}

// Component props type
type GlobalProtocolMetricsProps = {
  queryRef?: PreloadedQuery<GlobalProtocolMetricsQuery>
}

// Component that accepts an optional queryRef
export default function GlobalProtocolMetrics({ queryRef }: GlobalProtocolMetricsProps) {
  // Get the Redis subscriber context
  const { metricsLastUpdated } = useRedisSubscriber()
  
  // State to track the refresh key
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Get query reference for Relay if not provided
  const [localQueryRef, loadQuery] = useQueryLoader<GlobalProtocolMetricsQuery>(globalProtocolMetricsQuery)
  
  // Initialize metrics state
  const [metrics, setMetrics] = useState<{
    dailyVolumeUSD: string;
    totalValueLockedUSD: string;
    volume1hChange: number | null;
    volume24hChange: number | null;
  } | null>(null)
  
  // If queryRef is provided, use usePreloadedQuery, otherwise use useLazyLoadQuery
  let data: any;
  if (queryRef) {
    data = usePreloadedQuery<GlobalProtocolMetricsQuery>(globalProtocolMetricsQuery, queryRef);
  } else {
    data = useLazyLoadQuery<GlobalProtocolMetricsQuery>(
      globalProtocolMetricsQuery,
      {},
      {
        fetchPolicy: 'network-only', // Always fetch from network
        fetchKey: refreshKey, // Use the refresh key to force new fetches
      }
    );
  }
  
  // Update metrics state when data changes
  useEffect(() => {
    if (data?.protocolMetrics) {
      setMetrics(data.protocolMetrics)
    }
  }, [data])
  
  // Update when Redis metrics are updated (if not using queryRef)
  useEffect(() => {
    if (!queryRef && metricsLastUpdated) {
      console.log('Metrics were updated at:', new Date(metricsLastUpdated).toISOString())
      loadQuery({}, { fetchPolicy: 'network-only' })
      setRefreshKey(prev => prev + 1)
    }
  }, [metricsLastUpdated, loadQuery, queryRef])
  
  // Set up periodic refresh as fallback (if not using queryRef)
  useEffect(() => {
    if (queryRef) return; // Don't set up interval if using queryRef
    
    // Set up automatic refresh every 10 seconds as fallback
    const intervalId = setInterval(() => {
      loadQuery({}, { fetchPolicy: 'network-only' })
      setRefreshKey(prev => prev + 1)
      console.log('Automatic metrics refresh, key:', refreshKey + 1)
    }, 10000) // 10 seconds
    
    return () => {
      // Clean up interval on component unmount
      clearInterval(intervalId)
    }
  }, [loadQuery, refreshKey, queryRef])
  
  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    if (!queryRef) {
      loadQuery({}, { fetchPolicy: 'network-only' })
      setRefreshKey(prev => prev + 1)
      console.log('Manual refresh triggered')
    }
  }, [loadQuery, queryRef])
  
  // If metrics aren't loaded yet, show skeleton
  if (!metrics) {
    return <GlobalProtocolMetricsSkeleton />
  }
  
  // Render metrics with clean styling
  return (
    <View direction="row" gap={6} justify="start">
      {/* Volume Card */}
      <Card className="w-[200px] sm:w-full">
        <View padding={6} gap={2}>
          <Text variant="body-2" color="neutral-faded">1D volume</Text>
          <View direction="row" align="baseline" gap={2}>
            <Text variant="featured-3">{formatCurrency(metrics.dailyVolumeUSD)}</Text>
            <View direction="row" align="center" gap={1}>
              {(metrics.volume24hChange || 0) > 0 ? (
                <>
                  <ArrowUp size={16} color="var(--rs-color-positive)" weight="bold" />
                  <Text variant="body-3" color="positive">{Math.abs(metrics.volume24hChange || 0).toFixed(2)}%</Text>
                </>
              ) : (metrics.volume24hChange || 0) < 0 ? (
                <>
                  <ArrowDown size={16} color="var(--rs-color-critical)" weight="bold" />
                  <Text variant="body-3" color="critical">{Math.abs(metrics.volume24hChange || 0).toFixed(2)}%</Text>
                </>
              ) : (
                <Text variant="body-3" color="neutral">0.00%</Text>
              )}
            </View>
          </View>
        </View>
      </Card>
      
      {/* TVL Card */}
      <Card className="w-[200px] sm:w-full">
        <View padding={6} gap={2}>
          <Text variant="body-2" color="neutral-faded">Total TVL</Text>
          <View direction="row" align="baseline" gap={2}>
            <Text variant="featured-3">{formatCurrency(metrics.totalValueLockedUSD)}</Text>
          </View>
        </View>
      </Card>
    </View>
  )
}
