import React from 'react'
import { View, Text, Actionable } from 'reshaped'
import { pageExploreQuery } from '@/src/__generated__/pageExploreQuery.graphql'

// Helper to format currency values
const formatCurrency = (value: number): string => {
  if (value === 0) return '$0'
  if (value < 0.01) return '<$0.01'

  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`

  return `$${value.toFixed(2)}`
}

// Define the component props
interface ExploreProps {
  data: pageExploreQuery['response']
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
      <View direction="row" gap={0} padding={4} borderColor="neutral-faded">
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
            borderColor="neutral-faded"
            backgroundColor="elevation-base"
            className={'border-0'}
          >
            <View.Item columns={1}>
              <Text color="neutral-faded">{index + 1}</Text>
            </View.Item>

            <View.Item columns={3}>
              <View direction="row" align="center" gap={2}>
                <View direction="row">
                  <View
                    width={8}
                    height={8}
                    borderRadius="circular"
                    backgroundColor="primary"
                    justify="center"
                    align="center"
                  >
                    <Text weight="medium">{node.token0.symbol?.charAt(0)}</Text>
                  </View>
                </View>
                <View direction="column" gap={1}>
                  <Text weight="medium">
                    {node.token0.symbol}/{node.token1.symbol}
                  </Text>
                </View>
              </View>
            </View.Item>

            <View.Item columns={2}>
              <Text>{formatCurrency(node.tvl)}</Text>
            </View.Item>
          </View>
        ))}
      </View>
    </View>
  )
}
