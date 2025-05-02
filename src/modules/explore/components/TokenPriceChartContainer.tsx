'use client'

import React, { useState } from 'react'
import { Text, View, Select } from 'reshaped'
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay'
import PriceChart from './PriceChart'
import { TokenPriceChartContainer_token$key } from '@/src/__generated__/TokenPriceChartContainer_token.graphql'
import { TokenPriceChartContainerQuery } from '@/src/__generated__/TokenPriceChartContainerQuery.graphql'
import { formatUnits } from 'viem'

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

  // Return empty state if token data is missing
  if (!token || !tokenAddress) {
    return <Text>No token data available</Text>
  }

  // Memoize the chart content to prevent unnecessary rerenders
  const chartContent = React.useMemo(() => (
    <TokenPriceChartContent
      tokenAddress={tokenAddress}
      tokenSymbol={token.symbol || 'Token'}
      tokenDecimals={token.decimals ?? undefined}
      timeframe={timeframe}
      displayType={initialDisplayType as 'line' | 'area' | 'candle'}
    />
  ), [tokenAddress, token.symbol, token.decimals, timeframe, initialDisplayType]);

  return (
    <View direction="column" gap={16}>
      {chartContent}
    </View>
  )
}

// Separate component for chart content to handle data loading
function TokenPriceChartContent({
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  timeframe,
  displayType,
}: {
  tokenAddress: string
  tokenSymbol: string
  tokenDecimals?: number
  timeframe: string
  displayType: 'line' | 'area' | 'candle'
}) {
  const chartTitle = `${tokenSymbol} Price (USD)`

  // Fetch token price chart data
  const data = useLazyLoadQuery<TokenPriceChartContainerQuery>(
    TokenPriceChartQuery,
    {
      tokenAddress,
      timeframe,
      limit: 100,
    },
    {
      fetchPolicy: 'network-only', // Always fetch fresh data
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
      value: Number(formatUnits(BigInt(Math.round(point.value)), decimals))
    };
  });

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
