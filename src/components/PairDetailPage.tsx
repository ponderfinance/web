'use client'

import React, { useState } from 'react'
import { View, Text, Card, Grid, Skeleton, Tabs, Divider } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import PriceChartContainer from './PriceChartContainer'
import { PairDetailPageQuery } from '@/src/__generated__/PairDetailPageQuery.graphql'

// Define the query for the pair detail page - including chart data
const PairDetailQuery = graphql`
  query PairDetailPageQuery($pairAddress: String!, $timeframe: String!, $limit: Int!) {
    pairByAddress(address: $pairAddress) {
      id
      address
      reserve0
      reserve1
      reserveUsd
      tvl
      volume24h
      volumeChange24h
      poolApr
      rewardApr
      token0 {
        id
        symbol
        address
        priceUsd
      }
      token1 {
        id
        symbol
        address
        priceUsd
      }
      ...PriceChartContainer_pair
    }
    pairPriceChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {
      ...PriceChartContainer_priceData
    }
    pairVolumeChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {
      ...PriceChartContainer_volumeData
    }
  }
`

// Helper functions for formatting
function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  
  return num.toFixed(2);
}

function formatPercentage(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00%';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00%';
  
  return num.toFixed(2) + '%';
}

function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  
  // For very small numbers, use more decimal places
  if (num < 0.001) return num.toExponential(4);
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  
  return num.toFixed(2);
}

export default function PairDetailPage({ params }: { params: { address: string } }) {
  const pairAddress = params.address

  // Only render client-side data after component is mounted
  const [isMounted, setIsMounted] = React.useState(false)
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Show loading skeleton during SSR or before mounting
  if (!isMounted) {
    return <PairDetailPageSkeleton />
  }

  return <PairDetailContent pairAddress={pairAddress} />
}

function PairDetailContent({ pairAddress }: { pairAddress: string }) {
  // State for timeframe selection - default to 1d
  const [timeframe, setTimeframe] = useState('1d')

  // Fetch pair data and chart data
  const data = useLazyLoadQuery<PairDetailPageQuery>(
      PairDetailQuery,
      { 
        pairAddress,
        timeframe,
        limit: 100
      },
      { fetchPolicy: 'store-or-network' }
  )

  // Use pairByAddress instead of pair
  const pair = data.pairByAddress
  const priceData = data.pairPriceChart
  const volumeData = data.pairVolumeChart

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe)
  }

  // Show error if pair not found
  if (!pair) {
    return (
        <View padding={24}>
          <Card>
            <Text variant="title-3" align="center">
              Pair not found
            </Text>
          </Card>
        </View>
    )
  }

  return (
      <View direction="column" gap={24} padding={24}>
        {/* Pair header */}
        <Card>
          <View padding={16}>
            <Text variant="title-2">
              {pair.token0.symbol}/{pair.token1.symbol} Pool
            </Text>
          </View>
        </Card>

        {/* Chart section */}
        <Card>
          <View padding={16} direction="column" gap={16}>
            <PriceChartContainer 
              pairRef={pair} 
              priceDataRef={priceData}
              volumeDataRef={volumeData}
              initialTimeframe={timeframe}
              onTimeframeChange={handleTimeframeChange}
            />
          </View>
        </Card>

        {/* Pool stats */}
        <Card>
          <View padding={16} direction="column" gap={16}>
            <Text variant="title-3">Pool Stats</Text>

            <Grid columns={{ s: 1, m: 3 }} gap={16}>
              <View direction="column" gap={4}>
                <Text color="neutral">Reserve {pair.token0.symbol}</Text>
                <Text variant="title-4">{parseFloat(pair.reserve0).toLocaleString()}</Text>
              </View>

              <View direction="column" gap={4}>
                <Text color="neutral">Reserve {pair.token1.symbol}</Text>
                <Text variant="title-4">{parseFloat(pair.reserve1).toLocaleString()}</Text>
              </View>

              <View direction="column" gap={4}>
                <Text color="neutral">TVL</Text>
                <Text variant="title-4">
                  ${formatValue((pair as any)?.tvl || (pair as any)?.reserveUsd)}
                </Text>
              </View>
            </Grid>
            
            <Divider />
            
            <Grid columns={{ s: 1, m: 3 }} gap={16}>
              <View direction="column" gap={4}>
                <Text color="neutral">Volume (24h)</Text>
                <Text variant="title-4">
                  ${formatValue((pair as any)?.volume24h)}
                </Text>
              </View>

              <View direction="column" gap={4}>
                <Text color="neutral">Pool APR</Text>
                <Text variant="title-4" color={(pair as any)?.poolApr > 0 ? "positive" : "neutral"}>
                  {formatPercentage((pair as any)?.poolApr)}
                </Text>
              </View>

              <View direction="column" gap={4}>
                <Text color="neutral">Reward APR</Text>
                <Text variant="title-4" color={(pair as any)?.rewardApr > 0 ? "positive" : "neutral"}>
                  {formatPercentage((pair as any)?.rewardApr)}
                </Text>
              </View>
            </Grid>
            
            <Divider />
            
            <Grid columns={{ s: 1, m: 2 }} gap={16}>
              <View direction="column" gap={4}>
                <Text color="neutral">Price {pair.token0.symbol} in {pair.token1.symbol}</Text>
                <Text variant="title-4">
                  {formatNumber((pair as any)?.token0?.priceUsd / (pair as any)?.token1?.priceUsd)} {pair.token1.symbol}
                </Text>
              </View>

              <View direction="column" gap={4}>
                <Text color="neutral">Price {pair.token1.symbol} in {pair.token0.symbol}</Text>
                <Text variant="title-4">
                  {formatNumber((pair as any)?.token1?.priceUsd / (pair as any)?.token0?.priceUsd)} {pair.token0.symbol}
                </Text>
              </View>
            </Grid>
          </View>
        </Card>
      </View>
  )
}

// Skeleton loading state
function PairDetailPageSkeleton() {
  return (
      <View direction="column" gap={24} padding={24}>
        <Card>
          <View padding={16}>
            <Skeleton height={32} width="50%" borderRadius="large" />
          </View>
        </Card>

        <Card>
          <View padding={16} direction="column" gap={16}>
            <Skeleton height={400} width="100%" borderRadius="large" />
          </View>
        </Card>

        <Card>
          <View padding={16} direction="column" gap={16}>
            <Skeleton height={24} width="30%" borderRadius="large" />

            <Grid columns={{ s: 1, m: 3 }} gap={16}>
              <View direction="column" gap={4}>
                <Skeleton height={16} width="80%" borderRadius="large" />
                <Skeleton height={24} width="60%" borderRadius="large" />
              </View>

              <View direction="column" gap={4}>
                <Skeleton height={16} width="80%" borderRadius="large" />
                <Skeleton height={24} width="60%" borderRadius="large" />
              </View>

              <View direction="column" gap={4}>
                <Skeleton height={16} width="80%" borderRadius="large" />
                <Skeleton height={24} width="60%" borderRadius="large" />
              </View>
            </Grid>
          </View>
        </Card>
      </View>
  )
}
