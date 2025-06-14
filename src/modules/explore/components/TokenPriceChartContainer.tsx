'use client'

import React, { useState, useEffect } from 'react'
import { Text, View, Select, Skeleton } from 'reshaped'
import { graphql, useFragment, usePreloadedQuery, useQueryLoader } from 'react-relay'
import PriceChart from './PriceChart'
import { TokenPriceChartContainer_token$key } from '@/src/__generated__/TokenPriceChartContainer_token.graphql'
import { TokenPriceChartContainer_priceChart$key } from '@/src/__generated__/TokenPriceChartContainer_priceChart.graphql'
import { formatUnits } from 'viem'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import { ConnectionState } from '@/src/lib/redis/eventService'

// Define the fragment for token chart data
const TokenChartFragment = graphql`
  fragment TokenPriceChartContainer_token on Token {
    id
    address
    symbol
    name
    decimals
  }
`

// Define the fragment for price chart data
const PriceChartDataFragment = graphql`
  fragment TokenPriceChartContainer_priceChart on ChartDataPoint @relay(plural: true) {
    time
    value
  }
`

// Define the timeframe options
const TIMEFRAME_OPTIONS = [
  { value: '1h', label: '1 Hour' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
]

// Define the chart display type options
const DISPLAY_TYPE_OPTIONS = [
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'candle', label: 'Candle' },
]

interface TokenPriceChartContainerProps {
  tokenRef: TokenPriceChartContainer_token$key
  priceChartRef: TokenPriceChartContainer_priceChart$key
  initialTimeframe?: string
  initialDisplayType?: string
  onTimeframeChange?: (timeframe: string) => void
}

export default function TokenPriceChartContainer({
  tokenRef,
  priceChartRef,
  initialTimeframe = '1d',
  initialDisplayType = 'area',
  onTimeframeChange,
}: TokenPriceChartContainerProps) {
  // Store timeframe in state to avoid remounting the component
  const [timeframe, setTimeframe] = useState(() => initialTimeframe);
  const [displayType, setDisplayType] = useState(() => initialDisplayType);
  
  // Update timeframe when prop changes
  React.useEffect(() => {
    if (timeframe !== initialTimeframe) {
      setTimeframe(initialTimeframe);
    }
  }, [initialTimeframe, timeframe]);
  
  // Extract data from the fragments
  const token = useFragment(TokenChartFragment, tokenRef)
  const priceData = useFragment(PriceChartDataFragment, priceChartRef)
  
  // Set up real-time updates for this specific token chart
  const { connectionState, lastUpdated } = useRefreshOnUpdate({
    entityType: 'token',
    entityId: token?.address?.toLowerCase() || 'global',
    minRefreshInterval: 15000, // 15 seconds minimum between updates
    shouldRefetch: false,
    debug: false // Disable debug logging
  });
  
  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe)
    if (onTimeframeChange) {
      onTimeframeChange(newTimeframe)
    }
  }
  
  // Return empty state if token data is missing
  if (!token) {
    return <TokenChartSkeleton />
  }

  // Show message if connection is suspended
  const isConnectionSuspended = connectionState === ConnectionState.SUSPENDED;

  return (
    <View direction="column" gap={16}>
  
      {/* Chart content */}
      {priceData && priceData.length > 0 ? (
        <TokenPriceChartRenderer 
          tokenSymbol={token.symbol || ''}
          tokenDecimals={token.decimals ?? undefined}
          displayType={displayType as 'line' | 'area' | 'candle'}
          priceData={priceData}
        />
      ) : null}
    </View>
  )
}

// Chart skeleton component for loading states
function TokenChartSkeleton() {
  return (
    <View direction="column" gap={16} height={400}>
      {/* Chart title skeleton */}
      <View direction="row" justify="space-between" align="center">
        <Skeleton width={150} height={24} borderRadius="circular" />
        <Skeleton width={100} height={24} borderRadius="circular" />
      </View>
      
      {/* Chart area skeleton */}
      <View grow={true} position="relative">
        <View position="absolute" width="100%" height="100%">
          <View height="100%" width="100%" direction="column" justify="space-between">
            {/* Y-axis labels */}
            <View direction="row" width="100%" justify="space-between">
              <Skeleton width={60} height={16} borderRadius="circular" />
              <Skeleton width={40} height={16} borderRadius="circular" />
            </View>
            
            {/* Chart lines */}
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            
            {/* X-axis labels */}
            <View direction="row" width="100%" justify="space-between">
              <Skeleton width={50} height={16} borderRadius="circular" />
              <Skeleton width={50} height={16} borderRadius="circular" />
              <Skeleton width={50} height={16} borderRadius="circular" />
              <Skeleton width={50} height={16} borderRadius="circular" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// Renderer component for the chart - no queries, just render the data passed from the parent
function TokenPriceChartRenderer({
  tokenSymbol,
  tokenDecimals,
  displayType,
  priceData,
}: {
  tokenSymbol: string
  tokenDecimals?: number
  displayType: 'line' | 'area' | 'candle'
  priceData: ReadonlyArray<{
    readonly time: number
    readonly value: number
  }>
}) {
  const chartTitle = `${tokenSymbol} Price (USD)`

  // Create a clean copy of the data to avoid readonly issues
  let processedData = priceData.map(point => {
    // Always normalize values using the token's decimals (or default to 18)
    const decimals = tokenDecimals || 18;
    return {
      time: point.time,
      value: Number(point.value)
    };
  });

  // Explicitly sort the data by timestamp to ensure it's in correct order
  processedData = processedData.sort((a, b) => Number(a.time) - Number(b.time));
  
  // If there's only one data point, duplicate it to show a flat line
  if (processedData.length === 1) {
    const existingPoint = processedData[0];
    const timeOffset = 3600; // 1 hour in seconds
    
    processedData = [
      existingPoint,
      { time: existingPoint.time + timeOffset, value: existingPoint.value }
    ];
  }

  // Add price formatting for tooltip/hover display with enhanced precision for small values
  const formatTooltip = (value: number) => {
    // Special case for very small values
    if (value > 0 && value < 0.01) {
      // For tiny values below 0.0001, use more decimal places
      if (value < 0.0001) {
        return `$${value.toFixed(10)}`;
      }
      // For small values below 0.001, use 8 decimal places
      if (value < 0.001) {
        return `$${value.toFixed(8)}`;
      }
      // For values below 0.01, use 6 decimal places
      return `$${value.toFixed(6)}`;
    }
    
    // For regular values, use standard formatting
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  return (
    <PriceChart
      data={processedData}
      type={displayType}
      title={chartTitle}
      height={400}
      autoSize={true}
      yAxisLabel="Price (USD)"
      formatTooltip={formatTooltip}
    />
  )
}
