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

  // Enhanced debugging to see the raw data
  console.log(`[DEBUG] Raw token data for ${tokenSymbol}:`, { 
    tokenAddress, 
    tokenSymbol, 
    tokenDecimals,
    hasChartData: !!tokenPriceChart && tokenPriceChart.length > 0,
    dataPointCount: tokenPriceChart?.length || 0
  });
  
  if (tokenPriceChart && tokenPriceChart.length > 0) {
    console.log(`[DEBUG] First few data points:`, 
      tokenPriceChart.slice(0, 3).map(point => ({
        time: point.time,
        value: point.value,
        timeFormatted: new Date(point.time * 1000).toISOString()
      }))
    );
  }

  // More robust empty state checking
  if (!tokenPriceChart || tokenPriceChart.length === 0) {
    console.log(`[DEBUG] No price data available for ${tokenSymbol}`);
    return (
      <View height={400} align="center" justify="center">
        <Text>No price data available for {tokenSymbol}</Text>
      </View>
    )
  }

  // Very minimal data detection
  if (tokenPriceChart.length < 2) {
    console.log(`[DEBUG] Insufficient price data for ${tokenSymbol} (only ${tokenPriceChart.length} points)`);
    return (
      <View height={400} align="center" justify="center">
        <Text>Insufficient price data for {tokenSymbol}</Text>
        <Text variant="caption-1" color="neutral-faded">The chart requires at least 2 data points</Text>
      </View>
    )
  }

  // Log the raw data we received from the GraphQL query
  console.log(`[DEBUG] tokenPriceChart raw data for ${tokenSymbol}:`, tokenPriceChart.slice(0, 5));

  // Process the chart data to ensure proper formatting with more robust error handling
  const chartData = [...tokenPriceChart]
    .map((point) => {
      try {
        // Make sure both time and value are proper numbers
        const timeValue = typeof point.time === 'string' ? parseInt(point.time, 10) : Number(point.time);
        const priceValue = typeof point.value === 'string' ? parseFloat(point.value) : Number(point.value);
        
        // Log any issues with data conversion
        if (isNaN(timeValue) || isNaN(priceValue)) {
          console.error(`[DEBUG] Invalid chart point:`, point);
          return null;
        }
        
        return {
          time: timeValue,
          value: priceValue
        };
      } catch (error) {
        console.error(`[DEBUG] Error processing chart point:`, error, point);
        return null;
      }
    })
    .filter((point): point is {time: number, value: number} => 
      point !== null && 
      !isNaN(point.time) && 
      !isNaN(point.value) && 
      point.value > 0
    );

  // Check if values are too small to display (e.g. all 0.000001)
  const allMinimalValues = chartData.length > 0 && 
    chartData.every(point => point.value <= 0.000001);

  if (allMinimalValues) {
    console.log(`[DEBUG] All chart values are minimal (0.000001) for ${tokenSymbol}`);
    return (
      <View height={400} align="center" justify="center">
        <Text>Chart data unavailable for {tokenSymbol}</Text>
        <Text variant="caption-1" color="neutral-faded">The price data appears to be invalid</Text>
      </View>
    )
  }
  
  // Check if we still have enough valid points after filtering
  if (chartData.length < 2) {
    console.log(`[DEBUG] Insufficient valid price data after filtering for ${tokenSymbol}`);
    return (
      <View height={400} align="center" justify="center">
        <Text>Insufficient valid price data for {tokenSymbol}</Text>
      </View>
    )
  }

  console.log(`[DEBUG] Raw chart data for ${tokenSymbol}:`, chartData.slice(0, 5));
  
  // Report min, max, and average values before processing
  if (chartData.length > 0) {
    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    console.log(`[DEBUG] Before processing - Min: ${min}, Max: ${max}, Avg: ${avg}`);
  }

  // Simplified stablecoin detection based purely on token symbol
  // This is more reliable than trying to detect based on price
  const isStablecoin = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDC.e', 'FRAX', 'USDP'].includes(tokenSymbol);
  console.log(`[DEBUG] Token ${tokenSymbol} is stablecoin: ${isStablecoin}`);

  // Use our simplified processing function
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
