'use client'

import React, { useState } from 'react'
import { Text, View, Skeleton, Select } from 'reshaped'
import { graphql, useFragment } from 'react-relay'
import PriceChart from './PriceChart'
import { TokenChartContainer_token$key } from '@/src/__generated__/TokenChartContainer_token.graphql'
import { TokenChartContainer_priceData$key } from '@/src/__generated__/TokenChartContainer_priceData.graphql'

// Define the fragment for token chart data
const TokenChartFragment = graphql`
  fragment TokenChartContainer_token on Token {
    id
    address
    symbol
    name
  }
`

// Define fragment for price chart data
const PriceChartDataFragment = graphql`
  fragment TokenChartContainer_priceData on ChartDataPoint @relay(plural: true) {
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
]

interface TokenChartContainerProps {
  tokenRef: TokenChartContainer_token$key
  priceDataRef: TokenChartContainer_priceData$key
  initialTimeframe?: string
  initialDisplayType?: string
  onTimeframeChange?: (timeframe: string) => void
}

export default function TokenChartContainer({
  tokenRef,
  priceDataRef,
  initialTimeframe = '1d',
  initialDisplayType = 'area',
  onTimeframeChange,
}: TokenChartContainerProps) {
  const [timeframe, setTimeframe] = useState(initialTimeframe)
  const [displayType, setDisplayType] = useState(initialDisplayType)

  // Extract data from the fragments
  const token = useFragment(TokenChartFragment, tokenRef)
  const priceData = useFragment(PriceChartDataFragment, priceDataRef)

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe)
    if (onTimeframeChange) {
      onTimeframeChange(newTimeframe)
    }
  }
  
  // Return empty state if token data is missing
  if (!token) {
    return <Text>No token data available</Text>
  }

  return (
    <View direction="column" gap={16}>
      <View direction="row" justify="space-between" align="center">
        <Text variant="title-3">{token.symbol} Price Chart</Text>

        <View direction="row" gap={8}>
          <Select
            value={timeframe}
            onChange={(value) => handleTimeframeChange(value as unknown as string)}
            options={TIMEFRAME_OPTIONS}
            name={"timeframe"}
          />

          <Select
            value={displayType}
            onChange={(value) => setDisplayType(value as unknown as string)}
            options={DISPLAY_TYPE_OPTIONS}
            name={"displayType"}
          />
        </View>
      </View>

      {/* Chart content */}
      <TokenChartContent
        displayType={displayType}
        tokenSymbol={token.symbol ?? undefined}
        priceData={priceData}
      />
    </View>
  )
}

// Separate component for chart content to render the appropriate chart
function TokenChartContent({
  displayType,
  tokenSymbol,
  priceData,
}: {
  displayType: string
  tokenSymbol?: string
  priceData: ReadonlyArray<{
    readonly time: number
    readonly value: number
  }>
}) {
  const chartTitle = `${tokenSymbol || 'Token'} Price`

  // Loading or empty state handling
  if (!priceData || priceData.length === 0) {
    console.log(`[TOKEN-CHART] No price data available for ${tokenSymbol}`);
    return (
      <View height={400} align="center" justify="center">
        <Text>No price data available</Text>
      </View>
    )
  }

  // Convert readonly array to mutable array for PriceChart
  const chartData = [...priceData]
  
  // Add debug logging for diagnostics
  console.log(`[TOKEN-CHART] Rendering chart for ${tokenSymbol} with ${chartData.length} data points`);
  if (chartData.length > 0) {
    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    console.log(`[TOKEN-CHART] ${tokenSymbol} price range: ${min} to ${max}`);
    
    // Log first few data points
    chartData.slice(0, 3).forEach((point, i) => {
      console.log(`[TOKEN-CHART] Point ${i}: time=${new Date(point.time * 1000).toISOString()}, value=${point.value}`);
    });
  }
  
  // Check if this is a stablecoin chart based on symbol
  const isStablecoin = tokenSymbol && ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'].includes(tokenSymbol.toUpperCase());
  if (isStablecoin) {
    console.log(`[TOKEN-CHART] ${tokenSymbol} is a stablecoin, applying special formatting`);
  }

  // Create a custom tooltip formatter for stablecoins to show more decimal places
  const formatTooltip = isStablecoin 
    ? (price: number) => {
        if (price === 0) return '$0.00';
        return price < 1 
          ? `$${price.toFixed(4)}` 
          : `$${price.toFixed(2)}`;
      }
    : undefined;

  // Render the chart
  return (
    <PriceChart
      data={chartData}
      type={displayType as 'line' | 'area'}
      title={chartTitle}
      height={400}
      autoSize={true}
      formatTooltip={formatTooltip}
    />
  )
}
