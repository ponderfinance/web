import React from 'react'
import { View, Text, Actionable, Button, Loader } from 'reshaped'
import { TokenPair } from '@/src/components/TokenPair'
import { PoolsPage_pairs$data } from '@/src/__generated__/PoolsPage_pairs.graphql'

// Helper to format currency values
const formatCurrency = (value: number): string => {
  if (value === 0) return '$0'
  if (value < 0.01) return '<$0.01'

  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`

  return `$${value.toFixed(2)}`
}

// Define the component props - use the actual fragment data
interface ExploreProps {
  data: PoolsPage_pairs$data
  orderBy: string
  orderDirection: string
  setOrderBy: (value: string) => void
  setOrderDirection: (value: string) => void
}

export const Explore: React.FC<ExploreProps> = ({
  data,
  orderBy,
  orderDirection,
  setOrderBy,
  setOrderDirection,
}) => {
  // Handle sorting
  const handleSort = (column: string) => {
    if (orderBy === column) {
      setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(column)
      setOrderDirection('desc')
    }
  }

  return (
    <View
      borderRadius="medium"
      backgroundColor="elevation-base"
      borderColor="neutral-faded"
      overflow="auto"
      width="100%"
    >
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        padding={4}
        className={'border-0 border-b border-neutral-faded'}
      >
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            #
          </Text>
        </View.Item>

        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">
            Pool
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <View direction="row" align="center" gap={1}>
            <Text color="neutral-faded" weight="medium">
              TVL
            </Text>
          </View>
        </View.Item>
      </View>

      {/* Table Body */}
      <View direction="column" gap={0}>
        {data.pairs.edges.map(({ node }, index) => (
          <View
            key={node.id}
            direction="row"
            gap={0}
            padding={4}
            backgroundColor="elevation-base"
            className={'border-0'}
            align="center"
          >
            <View.Item columns={1}>
              <Text color="neutral-faded">{index + 1}</Text>
            </View.Item>

            <View.Item columns={3}>
              <View direction="row" align="center" gap={2}>
                {/* Use TokenPair component with proper fragments */}
                <TokenPair
                  tokenA={node.token0}
                  tokenB={node.token1}
                  size="small"
                />
              </View>
            </View.Item>

            <View.Item columns={2}>
              <Text variant="body-2">{formatCurrency(Number(node.tvl || node.reserveUsd))}</Text>
            </View.Item>
          </View>
        ))}
      </View>
    </View>
  )
}
