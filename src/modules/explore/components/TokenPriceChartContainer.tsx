'use client'

import React, { useState } from 'react'
import { Text, View, Select } from 'reshaped'
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay'
import PriceChart from './PriceChart'
import { TokenPriceChartContainer_token$key } from '@/src/__generated__/TokenPriceChartContainer_token.graphql'
import { TokenPriceChartContainerQuery } from '@/src/__generated__/TokenPriceChartContainerQuery.graphql'
import { processPriceHistoryData } from '@/src/lib/utils/tokenPriceUtils'
import { formatCurrency } from '@/src/utils/numbers'

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

  // Empty state
  if (!tokenPriceChart || tokenPriceChart.length === 0) {
    return (
      <View height={400} align="center" justify="center">
        <Text>No price data available</Text>
      </View>
    )
  }

  // Process the chart data to ensure proper formatting
  const chartData = [...tokenPriceChart].map((point) => ({
    time: point.time,
    value: typeof point.value === 'string' ? parseFloat(point.value) : point.value,
  }))

  console.log(`[DEBUG] Raw chart data for ${tokenSymbol}:`, chartData.slice(0, 5));
  
  // Report min, max, and average values before processing
  if (chartData.length > 0) {
    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    console.log(`[DEBUG] Before processing - Min: ${min}, Max: ${max}, Avg: ${avg}`);
  }

  // Check if this token is likely a stablecoin by symbol or reasonable price range
  const isStablecoin = 
    ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDC.e', 'FRAX', 'USDP'].includes(tokenSymbol) || 
    (chartData.length > 0 && 
      chartData.every(point => 
        typeof point.value === 'number' && 
        point.value > 0.5 && 
        point.value < 1.5
      )
    );

  const processedData = processPriceHistoryData(chartData, tokenDecimals, isStablecoin)
  
  console.log(`[DEBUG] Processed chart data for ${tokenSymbol}:`, processedData.slice(0, 5));
  
  // Report min, max, and average values after processing
  if (processedData.length > 0) {
    const values = processedData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    console.log(`[DEBUG] After processing - Min: ${min}, Max: ${max}, Avg: ${avg}`);
  }
  
  console.log(`[DEBUG] Token is stablecoin:`, isStablecoin);
  console.log(`[DEBUG] Token decimals:`, tokenDecimals);

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
    
    // For regular values, use the standard formatter
    return formatCurrency(value) ?? '';
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
