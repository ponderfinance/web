'use client'

import React, { useState, useEffect } from 'react'
import { Text, View, Select, Skeleton } from 'reshaped'
import { graphql, useFragment, useLazyLoadQuery, useQueryLoader } from 'react-relay'
import PriceChart from './PriceChart'
import { TokenPriceChartContainer_token$key } from '@/src/__generated__/TokenPriceChartContainer_token.graphql'
import { TokenPriceChartContainerQuery } from '@/src/__generated__/TokenPriceChartContainerQuery.graphql'
import { formatUnits } from 'viem'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'

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

// Define the query to fetch token price chart data
const TokenPriceChartQuery = graphql`
  query TokenPriceChartContainerQuery(
    $tokenAddress: String!
    $timeframe: String!
    $limit: Int!
  ) {
    tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {
      time
      value
    }
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
  initialTimeframe?: string
  initialDisplayType?: string
}

export default function TokenPriceChartContainer({
  tokenRef,
  initialTimeframe = '1d',
  initialDisplayType = 'area',
}: TokenPriceChartContainerProps) {
  // Store timeframe in state to avoid remounting the component
  const [timeframe, setTimeframe] = useState(() => initialTimeframe);
  
  // Update timeframe when prop changes
  React.useEffect(() => {
    if (timeframe !== initialTimeframe) {
      setTimeframe(initialTimeframe);
    }
  }, [initialTimeframe, timeframe]);
  
  // Extract token data from the fragment
  const token = useFragment(TokenChartFragment, tokenRef)
  const tokenAddress = token?.address
  const tokenId = token?.id

  // Return empty state if token data is missing
  if (!token || !tokenAddress) {
    return <TokenChartSkeleton />
  }

  // Memoize the chart content to prevent unnecessary rerenders
  const chartContent = React.useMemo(() => (
    <TokenPriceChartContent
      tokenId={tokenId}
      tokenAddress={tokenAddress}
      tokenSymbol={token.symbol || 'Token'}
      tokenDecimals={token.decimals ?? undefined}
      timeframe={timeframe}
      displayType={initialDisplayType as 'line' | 'area' | 'candle'}
    />
  ), [tokenId, tokenAddress, token.symbol, token.decimals, timeframe, initialDisplayType]);

  return (
    <View direction="column" gap={16}>
      {chartContent}
    </View>
  )
}

// Chart skeleton component for loading states
function TokenChartSkeleton() {
  return (
    <View direction="column" gap={16} height={400}>
      {/* Chart title skeleton */}
      <View direction="row" justify="space-between" align="center">
        <Skeleton width={150} height={24} borderRadius="full" />
        <Skeleton width={100} height={24} borderRadius="full" />
      </View>
      
      {/* Chart area skeleton */}
      <View flexGrow={1} position="relative">
        <View position="absolute" width="100%" height="100%">
          <View height="100%" width="100%" direction="column" justify="space-between">
            {/* Y-axis labels */}
            <View direction="row" width="100%" justify="space-between">
              <Skeleton width={60} height={16} borderRadius="full" />
              <Skeleton width={40} height={16} borderRadius="full" />
            </View>
            
            {/* Chart lines */}
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            <View height={1} width="100%" backgroundColor="neutral-faded" />
            
            {/* X-axis labels */}
            <View direction="row" width="100%" justify="space-between">
              <Skeleton width={50} height={16} borderRadius="full" />
              <Skeleton width={50} height={16} borderRadius="full" />
              <Skeleton width={50} height={16} borderRadius="full" />
              <Skeleton width={50} height={16} borderRadius="full" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// Separate component for chart content to handle data loading
function TokenPriceChartContent({
  tokenId,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  timeframe,
  displayType,
}: {
  tokenId: string
  tokenAddress: string
  tokenSymbol: string
  tokenDecimals?: number
  timeframe: string
  displayType: 'line' | 'area' | 'candle'
}) {
  const chartTitle = `${tokenSymbol} Price (USD)`
  // Get Redis subscriber context for real-time updates
  const { tokenLastUpdated } = useRedisSubscriber();
  
  // Set up query loader for refreshing data
  const [queryRef, loadQuery] = useQueryLoader<TokenPriceChartContainerQuery>(
    TokenPriceChartQuery
  );
  
  // Enhanced validation for parameters
  const areParamsValid = React.useMemo(() => {
    // Check for null, undefined, empty strings or invalid strings
    if (!tokenAddress || tokenAddress === 'null' || tokenAddress === 'undefined' || tokenAddress === '') {
      console.error(`[CHART] Invalid token address: ${tokenAddress}`);
      return false;
    }
    
    if (!timeframe || timeframe === 'null' || timeframe === 'undefined' || timeframe === '') {
      console.error(`[CHART] Invalid timeframe: ${timeframe}`);
      return false;
    }
    
    // Check if token address is a valid Ethereum address format (0x followed by 40 hex chars)
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      console.error(`[CHART] Token address is not in valid Ethereum format: ${tokenAddress}`);
      return false;
    }
    
    return true;
  }, [tokenAddress, timeframe]);
  
  // Load initial data - add extra validation for parameters
  useEffect(() => {
    if (areParamsValid) {
      console.log(`[CHART] Loading initial data for ${tokenSymbol} with address ${tokenAddress}, timeframe ${timeframe}`);
      try {
        loadQuery({
          tokenAddress,
          timeframe,
          limit: 100,
        });
      } catch (error) {
        console.error(`[CHART] Error loading chart data:`, error);
      }
    }
  }, [loadQuery, tokenAddress, timeframe, tokenSymbol, areParamsValid]);
  
  // Set up subscription to token updates for real-time chart updates
  useEffect(() => {
    // Check if we have an update for this token
    if (areParamsValid && tokenId && tokenLastUpdated[tokenId]) {
      console.log(`[CHART] Token ${tokenSymbol} updated, refreshing chart data...`);
      // Reload query when token data is updated
      try {
        loadQuery({
          tokenAddress,
          timeframe,
          limit: 100,
        }, { fetchPolicy: 'network-only' });
      } catch (error) {
        console.error(`[CHART] Error refreshing chart data:`, error);
      }
    }
  }, [tokenId, tokenLastUpdated, tokenSymbol, tokenAddress, timeframe, loadQuery, areParamsValid]);
  
  // If parameters are invalid, show error state
  if (!areParamsValid) {
    return (
      <View height={400} align="center" justify="center">
        <Text align="center">Cannot display chart for {tokenSymbol}:<br />Invalid parameters</Text>
      </View>
    );
  }
  
  // If query reference is not ready, show loading state
  if (!queryRef) {
    return <TokenChartSkeleton />;
  }
  
  return (
    <TokenPriceChartRenderer
      queryRef={queryRef}
      tokenSymbol={tokenSymbol}
      tokenDecimals={tokenDecimals}
      displayType={displayType}
    />
  );
}

// Renderer component to handle the data display
function TokenPriceChartRenderer({
  queryRef,
  tokenSymbol,
  tokenDecimals,
  displayType,
}: {
  queryRef: any
  tokenSymbol: string
  tokenDecimals?: number
  displayType: 'line' | 'area' | 'candle'
}) {
  const chartTitle = `${tokenSymbol} Price (USD)`

  // Use the query reference to fetch data
  const data = useLazyLoadQuery<TokenPriceChartContainerQuery>(
    TokenPriceChartQuery,
    queryRef,
    {
      fetchPolicy: 'store-and-network', // Use cache first, then network for updates
    }
  )

  const tokenPriceChart = data.tokenPriceChart

  // More robust empty state checking
  if (!tokenPriceChart || tokenPriceChart.length === 0) {
    return (
      <View height={400} align="center" justify="center">
        <Text>No price data available for {tokenSymbol}</Text>
      </View>
    )
  }

  // Create a clean copy of the data to avoid readonly issues
  let processedData = tokenPriceChart.map(point => {
    // Always normalize values using the token's decimals (or default to 18)
    const decimals = tokenDecimals || 18;
    return {
      time: point.time,
      // Use viem's formatUnits to convert from wei to token units
      value: Number(point.value)
    };
  });

  // Explicitly sort the data by timestamp to ensure it's in correct order
  // This is crucial when timestamps have been converted from strings to numbers
  processedData = processedData.sort((a, b) => Number(a.time) - Number(b.time));
  
  // Log the timestamps to help with debugging
  console.log(`[CHART] Sorted ${processedData.length} price points for ${tokenSymbol}`);
  if (processedData.length > 0) {
    const firstPoint = processedData[0];
    const lastPoint = processedData[processedData.length - 1];
    console.log(`[CHART] Time range: ${new Date(firstPoint.time * 1000).toISOString()} to ${new Date(lastPoint.time * 1000).toISOString()}`);
  }

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
