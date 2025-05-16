'use client'

import React, { useState } from 'react'
import { Text, View, Skeleton, Select } from 'reshaped'
import { graphql, useFragment } from 'react-relay'
import PriceChart from './PriceChart'
import { PriceChartContainer_pair$key } from '@/src/__generated__/PriceChartContainer_pair.graphql'
import { PriceChartContainer_priceData$key } from '@/src/__generated__/PriceChartContainer_priceData.graphql'
import { PriceChartContainer_volumeData$key } from '@/src/__generated__/PriceChartContainer_volumeData.graphql'

// Define the fragment for pair data
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

// Define fragment for price chart data
const PriceChartDataFragment = graphql`
  fragment PriceChartContainer_priceData on ChartDataPoint @relay(plural: true) {
    time
    value
  }
`

// Define fragment for volume chart data
const VolumeChartDataFragment = graphql`
  fragment PriceChartContainer_volumeData on VolumeChartData @relay(plural: true) {
    time
    value
    volume0
    volume1
    count
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

// Define the display type options
const DISPLAY_TYPE_OPTIONS = [
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
]

interface PriceChartContainerProps {
  pairRef: PriceChartContainer_pair$key
  priceDataRef: PriceChartContainer_priceData$key
  volumeDataRef: PriceChartContainer_volumeData$key
  initialTimeframe?: string
  initialChartType?: string
  initialDisplayType?: string
  onTimeframeChange?: (timeframe: string) => void
}

export default function PriceChartContainer({
  pairRef,
  priceDataRef,
  volumeDataRef,
  initialTimeframe = '1d',
  initialChartType = 'price',
  initialDisplayType = 'area',
  onTimeframeChange,
}: PriceChartContainerProps) {
  const [timeframe, setTimeframe] = useState(initialTimeframe)
  const [chartType, setChartType] = useState(initialChartType)
  const [displayType, setDisplayType] = useState(initialDisplayType)

  // Extract data from the fragments
  const pair = useFragment(PairChartFragment, pairRef)
  const priceData = useFragment(PriceChartDataFragment, priceDataRef)
  const volumeData = useFragment(VolumeChartDataFragment, volumeDataRef)

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe)
    if (onTimeframeChange) {
      onTimeframeChange(newTimeframe)
    }
  }

  // Return empty state if pair data is missing
  if (!pair) {
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
            onChange={(value) => handleTimeframeChange(value as unknown as string)}
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
      <ChartContent
        chartType={chartType}
        displayType={displayType}
        token0Symbol={pair.token0?.symbol || undefined}
        token1Symbol={pair.token1?.symbol || undefined}
        priceData={priceData}
        volumeData={volumeData}
      />
    </View>
  )
}

// Separate component to render appropriate chart based on selected type
function ChartContent({
  chartType,
  displayType,
  token0Symbol,
  token1Symbol,
  priceData,
  volumeData,
}: {
  chartType: string
  displayType: string
  token0Symbol?: string
  token1Symbol?: string
  priceData: ReadonlyArray<{
    readonly time: number
    readonly value: number
  }>
  volumeData: ReadonlyArray<{
    readonly time: number
    readonly value: number
    readonly volume0?: number | null
    readonly volume1?: number | null
    readonly count?: number | null
  }>
}) {
  const chartTitle = `${token0Symbol || 'Token0'}/${token1Symbol || 'Token1'} ${
    chartType === 'price' ? 'Price' : 'Volume'
  }`

  // Loading or empty state handling
  if ((chartType === 'price' && (!priceData || priceData.length === 0)) || 
      (chartType === 'volume' && (!volumeData || volumeData.length === 0))) {
    return (
      <View height={400} align="center" justify="center">
        <Text>No {chartType} data available</Text>
      </View>
    )
  }

  // Render the appropriate chart
  if (chartType === 'price') {
    // Convert readonly array to mutable array for PriceChart
    const chartData = [...priceData]
    return (
      <PriceChart
        data={chartData}
        type={displayType as 'line' | 'area'}
        title={chartTitle}
        height={400}
        autoSize={true}
      />
    )
  } else {
    // Convert readonly array to mutable array for PriceChart
    const chartData = [...volumeData]
    return (
      <PriceChart
        data={chartData}
        type="volume"
        title={chartTitle}
        height={400}
        autoSize={true}
      />
    )
  }
}
