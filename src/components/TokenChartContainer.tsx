'use client'

import React, { useState } from 'react'
import { Text, View, Skeleton, Select } from 'reshaped'
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay'
import PriceChart from './PriceChart'
import { TokenChartContainer_token$key } from '@/src/__generated__/TokenChartContainer_token.graphql'
import { TokenChartContainerQuery } from '@/src/__generated__/TokenChartContainerQuery.graphql'

// Define the fragment for token chart data
const TokenChartFragment = graphql`
  fragment TokenChartContainer_token on Token {
    id
    address
    symbol
    name
  }
`

// Define the query to fetch token price chart data
const TokenPriceChartQuery = graphql`
  query TokenChartContainerQuery(
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
]

interface TokenChartContainerProps {
  tokenRef: TokenChartContainer_token$key
  initialTimeframe?: string
  initialDisplayType?: string
}

export default function TokenChartContainer({
  tokenRef,
  initialTimeframe = '1d',
  initialDisplayType = 'area',
}: TokenChartContainerProps) {
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
      <View direction="row" justify="space-between" align="center">
        <Text variant="title-3">{token.symbol} Price Chart</Text>

        <View direction="row" gap={8}>
          <Select
            value={timeframe}
            onChange={(value) => setTimeframe(value as unknown as string)}
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
        tokenAddress={tokenAddress}
        timeframe={timeframe}
        displayType={displayType}
        tokenSymbol={token.symbol ?? undefined}
      />
    </View>
  )
}

// Separate component for chart content to handle data loading
function TokenChartContent({
  tokenAddress,
  timeframe,
  displayType,
  tokenSymbol,
}: {
  tokenAddress: string
  timeframe: string
  displayType: string
  tokenSymbol?: string
}) {
  const chartTitle = `${tokenSymbol || 'Token'} Price`

  // Fetch token price chart data
  const data = useLazyLoadQuery<TokenChartContainerQuery>(
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

  // Convert readonly array to mutable array for PriceChart
  const chartData = [...tokenPriceChart]

  // Render the chart
  return (
    <PriceChart
      data={chartData}
      type={displayType as 'line' | 'area'}
      title={chartTitle}
      height={400}
      autoSize={true}
    />
  )
}
