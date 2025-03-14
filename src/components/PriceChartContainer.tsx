'use client'

import React, { useState } from 'react'
import { Text, View, Skeleton, Select } from 'reshaped'
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay'
import PriceChart from './PriceChart'
import { PriceChartContainer_pair$key } from '@/src/__generated__/PriceChartContainer_pair.graphql'
import { PriceChartContainerPriceQuery } from '@/src/__generated__/PriceChartContainerPriceQuery.graphql'
import { PriceChartContainerVolumeQuery } from '@/src/__generated__/PriceChartContainerVolumeQuery.graphql'

// Define the fragment for pair chart data
const PairChartFragment = graphql`
  fragment PriceChartContainer_pair on Pair {
    id
    address
    token0 {
      id
      symbol
    }
    token1 {
      id
      symbol
    }
  }
`

// Define the query to fetch price chart data
const PairPriceChartQuery = graphql`
  query PriceChartContainerPriceQuery(
    $pairAddress: String!
    $timeframe: String!
    $limit: Int!
  ) {
    pairPriceChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {
      time
      value
    }
  }
`

// Define the query to fetch volume chart data
const PairVolumeChartQuery = graphql`
  query PriceChartContainerVolumeQuery(
    $pairAddress: String!
    $timeframe: String!
    $limit: Int!
  ) {
    pairVolumeChart(pairAddress: $pairAddress, timeframe: $timeframe, limit: $limit) {
      time
      value
      volume0
      volume1
      count
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

// Define the chart type options
const CHART_TYPE_OPTIONS = [
  { value: 'price', label: 'Price' },
  { value: 'volume', label: 'Volume' },
]

// Define the chart display type options
const DISPLAY_TYPE_OPTIONS = [
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
]

interface PriceChartContainerProps {
  pairRef: PriceChartContainer_pair$key
  initialTimeframe?: string
  initialChartType?: string
  initialDisplayType?: string
}

export default function PriceChartContainer({
  pairRef,
  initialTimeframe = '1d',
  initialChartType = 'price',
  initialDisplayType = 'area',
}: PriceChartContainerProps) {
  const [timeframe, setTimeframe] = useState(initialTimeframe)
  const [chartType, setChartType] = useState(initialChartType)
  const [displayType, setDisplayType] = useState(initialDisplayType)

  // Extract pair data from the fragment
  const pair = useFragment(PairChartFragment, pairRef)
  const pairAddress = pair?.address

  // Return empty state if pair data is missing
  if (!pair || !pairAddress) {
    return <Text>No pair data available</Text>
  }

  return (
    <View direction="column" gap={16}>
      <View direction="row" justify="space-between" align="center">
        <Text variant="title-3">
          {pair.token0?.symbol}/{pair.token1?.symbol} Chart
        </Text>

        <View direction="row" gap={8}>
          <Select
            value={timeframe}
            onChange={(value) => setTimeframe(value as unknown as string)}
            options={TIMEFRAME_OPTIONS}
            name={'timeframe'}
          />

          <Select
            value={chartType}
            onChange={(value) => setChartType(value as unknown as string)}
            options={CHART_TYPE_OPTIONS}
            name={'chartType'}
          />

          <Select
            value={displayType}
            onChange={(value) => setDisplayType(value as unknown as string)}
            options={DISPLAY_TYPE_OPTIONS}
            name={'displayType'}
          />
        </View>
      </View>

      {/* Chart content */}
      <PriceChartContent
        pairAddress={pairAddress}
        timeframe={timeframe}
        chartType={chartType}
        displayType={displayType}
        token0Symbol={pair.token0?.symbol ?? undefined}
        token1Symbol={pair.token1?.symbol ?? undefined}
      />
    </View>
  )
}

// Separate component for chart content to handle data loading
function PriceChartContent({
  pairAddress,
  timeframe,
  chartType,
  displayType,
  token0Symbol,
  token1Symbol,
}: {
  pairAddress: string
  timeframe: string
  chartType: string
  displayType: string
  token0Symbol?: string
  token1Symbol?: string
}) {
  const chartTitle = `${token0Symbol || 'Token0'}/${token1Symbol || 'Token1'} ${
    chartType === 'price' ? 'Price' : 'Volume'
  }`

  // Fetch the appropriate data based on chart type
  if (chartType === 'price') {
    return (
      <PriceChartData
        pairAddress={pairAddress}
        timeframe={timeframe}
        displayType={displayType as 'line' | 'area'}
        title={chartTitle}
      />
    )
  } else {
    return (
      <VolumeChartData
        pairAddress={pairAddress}
        timeframe={timeframe}
        title={chartTitle}
      />
    )
  }
}

// Component to fetch and render price chart data
function PriceChartData({
  pairAddress,
  timeframe,
  displayType,
  title,
}: {
  pairAddress: string
  timeframe: string
  displayType: 'line' | 'area'
  title: string
}) {
  // Fetch price chart data
  const data = useLazyLoadQuery<PriceChartContainerPriceQuery>(
    PairPriceChartQuery,
    {
      pairAddress,
      timeframe,
      limit: 100,
    },
    {
      fetchPolicy: 'network-only', // Always fetch fresh data
    }
  )

  const pairPriceChart = data.pairPriceChart

  // Loading state
  if (!pairPriceChart) {
    return (
      <View height={400}>
        <Skeleton height="100%" width="100%" />
      </View>
    )
  }

  // Empty state
  if (pairPriceChart.length === 0) {
    return (
      <View height={400} align="center" justify="center">
        <Text>No price data available</Text>
      </View>
    )
  }

  // Render the chart
  // Convert readonly array to mutable array for PriceChart
  const chartData = [...pairPriceChart]

  return (
    <PriceChart
      data={chartData}
      type={displayType}
      title={title}
      height={400}
      autoSize={true}
    />
  )
}

// Component to fetch and render volume chart data
function VolumeChartData({
  pairAddress,
  timeframe,
  title,
}: {
  pairAddress: string
  timeframe: string
  title: string
}) {
  // Fetch volume chart data
  const data = useLazyLoadQuery<PriceChartContainerVolumeQuery>(
    PairVolumeChartQuery,
    {
      pairAddress,
      timeframe,
      limit: 100,
    },
    {
      fetchPolicy: 'network-only', // Always fetch fresh data
    }
  )

  const pairVolumeChart = data.pairVolumeChart

  // Loading state
  if (!pairVolumeChart) {
    return (
      <View height={400}>
        <Skeleton height="100%" width="100%" />
      </View>
    )
  }

  // Empty state
  if (pairVolumeChart.length === 0) {
    return (
      <View height={400} align="center" justify="center">
        <Text>No volume data available</Text>
      </View>
    )
  }

  // Render the chart
  // Convert readonly array to mutable array for PriceChart
  const chartData = [...pairVolumeChart]

  return (
    <PriceChart
      data={chartData}
      type="volume"
      title={title}
      height={400}
      autoSize={true}
    />
  )
}
