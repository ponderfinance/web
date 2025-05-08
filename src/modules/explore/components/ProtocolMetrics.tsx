'use client'

import React, { useEffect, useState } from 'react'
import { View, Text, Card, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { ProtocolMetricsQuery } from '@/src/__generated__/ProtocolMetricsQuery.graphql'

// Define the GraphQL query
export const protocolMetricsQuery = graphql`
  query ProtocolMetricsQuery {
    protocolMetrics {
      dailyVolumeUSD
      totalValueLockedUSD
      volume24hChange
    }
  }
`

// Protocol metrics loading skeleton
export const ProtocolMetricsLoading = () => {
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

// Helper to format currency
const formatCurrency = (value: string | null | undefined) => {
  if (!value) return '$0'
  const num = parseFloat(value)
  
  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(2)}K`
  }
  
  return `$${num.toFixed(2)}`
}

// ProtocolMetrics component
const ProtocolMetrics = () => {
  // Add a refresh key state to force re-fetching
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Set up automatic refresh every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 30000) // 30 seconds
    
    return () => clearInterval(intervalId)
  }, [])
  
  const data = useLazyLoadQuery<ProtocolMetricsQuery>(
    protocolMetricsQuery,
    {},
    {
      fetchPolicy: 'network-only', // Always fetch from network
      fetchKey: refreshKey, // Use the refresh key to force new fetches
    }
  )
  
  // Access data directly from the response structure
  const dailyVolume = data.protocolMetrics?.dailyVolumeUSD || '0'
  const tvl = data.protocolMetrics?.totalValueLockedUSD || '0'
  const volumeChange = data.protocolMetrics?.volume24hChange || 0
  
  return (
    <View direction="row" align="center" gap={6} wrap className="justify-between">
      <View gap={2}>
        <Text variant="body-2" color="neutral-faded">
          24h Volume
        </Text>
        <View direction="row" align="baseline" gap={2}>
          <Text variant="featured-3">{formatCurrency(dailyVolume)}</Text>
          <View direction="row" align="center" gap={1}>
            {volumeChange > 0 ? (
              <Text variant="body-3" color="positive">+{Math.abs(volumeChange).toFixed(2)}%</Text>
            ) : volumeChange < 0 ? (
              <Text variant="body-3" color="critical">-{Math.abs(volumeChange).toFixed(2)}%</Text>
            ) : (
              <Text variant="body-3" color="neutral">0.00%</Text>
            )}
          </View>
        </View>
      </View>
      
      <View gap={2}>
        <Text variant="body-2" color="neutral-faded">
          Total TVL
        </Text>
        <View direction="row" align="baseline" gap={2}>
          <Text variant="featured-3">{formatCurrency(tvl)}</Text>
        </View>
      </View>
    </View>
  )
}

export default ProtocolMetrics 