'use client'

import React, { useEffect, useState } from 'react'
import { View, Text, Card, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery, useQueryLoader, PreloadedQuery, usePreloadedQuery } from 'react-relay'
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'

// Define the GraphQL query
export const globalProtocolMetricsQuery = graphql`
  query GlobalProtocolMetricsQuery {
    protocolMetrics {
      dailyVolumeUsd
      totalValueLockedUsd
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
  queryRef: PreloadedQuery<GlobalProtocolMetricsQuery>
}

// Component that accepts a queryRef
export default function GlobalProtocolMetrics({ queryRef }: GlobalProtocolMetricsProps) {
  // Initialize metrics state
  const [metrics, setMetrics] = useState<{
    dailyVolumeUsd: string;
    totalValueLockedUsd: string;
    volume1hChange: number | null;
    volume24hChange: number | null;
  } | null>(null)
  
  // Use preloaded query data
  const data = usePreloadedQuery<GlobalProtocolMetricsQuery>(
    globalProtocolMetricsQuery, 
    queryRef
  );
  
  // Update metrics state when data changes
  useEffect(() => {
    if (data?.protocolMetrics) {
      setMetrics(data.protocolMetrics)
    }
  }, [data])
  
  // If metrics aren't loaded yet, show skeleton
  if (!metrics) {
    return <GlobalProtocolMetricsSkeleton />
  }
  
  // Render metrics with clean styling
  return (
    <View direction="row" align="center" gap={6} wrap className="justify-between" position="relative">
      <View gap={2}>
        <Text variant="body-2" color="neutral-faded">
          24h Volume
        </Text>
        <View direction="row" align="baseline" gap={2}>
          <Text variant="featured-3">{formatCurrency(metrics.dailyVolumeUsd)}</Text>
          <View direction="row" align="center" gap={1}>
            {(metrics.volume24hChange || 0) > 0 ? (
              <Text variant="body-3" color="positive">+{Math.abs(metrics.volume24hChange || 0).toFixed(2)}%</Text>
            ) : (metrics.volume24hChange || 0) < 0 ? (
              <Text variant="body-3" color="critical">-{Math.abs(metrics.volume24hChange || 0).toFixed(2)}%</Text>
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
          <Text variant="featured-3">{formatCurrency(metrics.totalValueLockedUsd)}</Text>
        </View>
      </View>
    </View>
  )
}
