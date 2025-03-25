'use client'

import React, { useState } from 'react'
import { Text, View, Skeleton, Select } from 'reshaped'
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
  const [timeframe, setTimeframe] = useState(initialTimeframe)
  const [displayType, setDisplayType] = useState(initialDisplayType)

  // Extract token data from the fragment
  const token = useFragment(TokenChartFragment, tokenRef)
  const tokenAddress = token?.address

  // Return empty state if token data is missing
  if (!token || !tokenAddress) {
    return <Text>No token data available</Text>
  }

  return (
    <View direction="column" gap={16}>
      {/* Chart content */}
      <TokenPriceChartContent
        tokenAddress={tokenAddress}
        tokenSymbol={token.symbol || 'Token'}
        tokenDecimals={token.decimals ?? undefined}
        timeframe={timeframe}
        displayType={displayType as 'line' | 'area' | 'candle'}
      />
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

  // Loading state
  if (!tokenPriceChart) {
    return (
      <View height={400}>
        <Skeleton height="100%" width="100%" />
      </View>
    )
  }

  // Empty state
  if (tokenPriceChart.length === 0) {
    return (
      <View height={400} align="center" justify="center">
        <Text>No price data available</Text>
      </View>
    )
  }

  // Process the chart data to ensure proper formatting
  // Now using the utility function instead of the service
  const chartData = [...tokenPriceChart].map((point) => ({
    time: point.time,
    value: typeof point.value === 'string' ? parseFloat(point.value) : point.value,
  }))

  const processedData = processPriceHistoryData(chartData, tokenDecimals)

  // Add price formatting for tooltip/hover display
  const formatTooltip = (value: number) => formatCurrency(value) ?? ''

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
