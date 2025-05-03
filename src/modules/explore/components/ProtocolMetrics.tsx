'use client'

import React from 'react'
import { View, Text, Card, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
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
export const ProtocolMetricsSkeleton = () => {
  return (
    <View direction="row" gap={6} justify="start">
      <Card className="w-[200px] sm:w-full">
        <View padding={6} gap={2}>
          <Text variant="body-2" color="neutral-faded">1D volume</Text>
          <View direction="row" align="baseline" gap={2}>
            <Skeleton width="120px" height="30px" />
            <Skeleton width="60px" height="20px" />
          </View>
        </View>
      </Card>
      
      <Card className="w-[200px] sm:w-full">
        <View padding={6} gap={2}>
          <Text variant="body-2" color="neutral-faded">Total Ponder TVL</Text>
          <View direction="row" align="baseline" gap={2}>
            <Skeleton width="120px" height="30px" />
            <Skeleton width="60px" height="20px" />
          </View>
        </View>
      </Card>
    </View>
  )
}

// ProtocolMetrics component
const ProtocolMetrics = () => {
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
    <View direction="row" gap={6} justify="start">
      <Card className="w-[200px] sm:w-full">
        <View padding={6} gap={2}>
          <Text variant="body-2" color="neutral-faded">1D volume</Text>
          <View direction="row" align="baseline" gap={2}>
            <Text variant="featured-3">{formatCurrency(dailyVolume)}</Text>
            <View direction="row" align="center" gap={1}>
              {volumeChange > 0 ? (
                <>
                  <ArrowUp size={16} color="var(--rs-color-positive)" weight="bold" />
                  <Text variant="body-3" color="positive">{Math.abs(volumeChange).toFixed(2)}%</Text>
                </>
              ) : volumeChange < 0 ? (
                <>
                  <ArrowDown size={16} color="var(--rs-color-critical)" weight="bold" />
                  <Text variant="body-3" color="critical">{Math.abs(volumeChange).toFixed(2)}%</Text>
                </>
              ) : (
                <Text variant="body-3" color="neutral">0.00%</Text>
              )}
            </View>
          </View>
        </View>
      </Card>
      
      <Card className="w-[200px] sm:w-full">
        <View padding={6} gap={2}>
          <Text variant="body-2" color="neutral-faded">Total Ponder TVL</Text>
          <View direction="row" align="baseline" gap={2}>
            <Text variant="featured-3">{formatCurrency(tvl)}</Text>
            {/* We could add TVL change here if available in the future */}
          </View>
        </View>
      </Card>
    </View>
  )
}

export default ProtocolMetrics 