'use client'

import React from 'react'
import { View, Text, Card, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql'

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

// Format currency values
const formatCurrency = (value: string): string => {
  const num = parseFloat(value)
  if (isNaN(num)) return '$0'

  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`

  return `$${num.toFixed(2)}`
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

// GlobalProtocolMetrics component
const GlobalProtocolMetrics = () => {
  const data = useLazyLoadQuery<GlobalProtocolMetricsQuery>(
    globalProtocolMetricsQuery,
    {},
    {
      fetchPolicy: 'store-or-network',
    }
  )

  const dailyVolume = data?.protocolMetrics?.dailyVolumeUSD || '0'
  const tvl = data?.protocolMetrics?.totalValueLockedUSD || '0'
  const volume1hChange = data?.protocolMetrics?.volume1hChange || 0
  const volume24hChange = data?.protocolMetrics?.volume24hChange || 0

  // Choose which change to display - prefer 24h change if available
  const displayChange = volume24hChange !== 0 ? volume24hChange : volume1hChange

  return (
    <View direction="row" gap={6} wrap className="justify-between" width="100%" divided={true}>
      <View gap={2}>
        <Text variant="body-2" color="neutral-faded">
          24h Volume
        </Text>
        <View direction="row" align="baseline" gap={2}>
          <Text variant="featured-3">{formatCurrency(dailyVolume)}</Text>
          <View direction="row" align="center" gap={1}>
            {displayChange > 0 ? (
              <>
                <ArrowUp size={16} color="var(--rs-color-positive)" weight="bold" />
                <Text variant="body-3" color="positive">
                  {Math.abs(displayChange).toFixed(2)}%
                </Text>
              </>
            ) : displayChange < 0 ? (
              <>
                <ArrowDown size={16} color="var(--rs-color-critical)" weight="bold" />
                <Text variant="body-3" color="critical">
                  {Math.abs(displayChange).toFixed(2)}%
                </Text>
              </>
            ) : (
              <Text variant="body-3" color="neutral">
                0.00%
              </Text>
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

export default GlobalProtocolMetrics
