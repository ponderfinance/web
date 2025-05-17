'use client'

import React from 'react'
import { View, Text, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { ProtocolMetricsQuery } from '@/src/__generated__/ProtocolMetricsQuery.graphql'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary'

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
const ProtocolMetricsContent = () => {
  // Use our custom hook for real-time updates
  const { refresh, lastUpdated } = useRefreshOnUpdate({
    entityType: 'metrics',
    minRefreshInterval: 30000, // 30 seconds minimum between updates
    shouldRefetch: true // Force a refetch when metrics are updated
  })
  
  // Query metrics data with store-or-network approach for better caching
  const data = useLazyLoadQuery<ProtocolMetricsQuery>(
    protocolMetricsQuery,
    {},
    {
      fetchPolicy: 'store-or-network',
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

// Export the component wrapped with Relay boundary
const ProtocolMetrics = withRelayBoundary(ProtocolMetricsContent, ProtocolMetricsLoading);
export default ProtocolMetrics; 