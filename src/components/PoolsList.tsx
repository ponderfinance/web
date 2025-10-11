'use client'

import React, { useState, useEffect } from 'react'
import { View, Text, Skeleton, Actionable } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'

import { PoolsListQuery } from '@/src/__generated__/PoolsListQuery.graphql'

// Define the GraphQL query - must match the component name
const poolsListQuery = graphql`
  query PoolsListQuery(
    $first: Int!
    $orderBy: PairOrderBy!
    $orderDirection: OrderDirection!
  ) {
    pairs(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {
      edges {
        node {
          id
          address
          token0 {
            id
            address
            symbol
            decimals
          }
          token1 {
            id
            address
            symbol
            decimals
          }
          tvl
          reserveUsd
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`

// Helper to format currency values
const formatCurrency = (value: number): string => {
  if (value === 0) return '$0'
  if (value < 0.01) return '<$0.01'

  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`

  return `$${value.toFixed(2)}`
}

// Custom chevron SVG component
const ChevronIcon = ({ direction = 'down' }: { direction?: 'up' | 'down' }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    style={{
      transform: direction === 'up' ? 'rotate(180deg)' : 'none',
      transition: 'transform 0.2s ease-in-out',
    }}
  >
    <path
      d="M4 6L8 10L12 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PoolsList: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false)
  const [orderBy, setOrderBy] = useState<string>('reserveUsd')
  const [orderDirection, setOrderDirection] = useState<string>('desc')

  // Only render client-side data after component is mounted
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Show loading skeleton during SSR or before mounting
  if (!isMounted) {
    return (
      <View direction="column" gap={4}>
        <Skeleton height={40} width="100%" borderRadius="large" />
        <Skeleton height={400} width="100%" borderRadius="large" />
      </View>
    )
  }

  return (
    <PoolsListContent
      orderBy={orderBy}
      orderDirection={orderDirection}
      setOrderBy={setOrderBy}
      setOrderDirection={setOrderDirection}
    />
  )
}

// Separate content component for client-side rendering
interface PoolsListContentProps {
  orderBy: string
  orderDirection: string
  setOrderBy: (value: string) => void
  setOrderDirection: (value: string) => void
}

const PoolsListContent: React.FC<PoolsListContentProps> = ({
  orderBy,
  orderDirection,
  setOrderBy,
  setOrderDirection,
}) => {
  // Fetch data using the GraphQL query
  const data = useLazyLoadQuery<PoolsListQuery>(
    poolsListQuery,
    {
      first: 50,
      orderBy: orderBy as any, // Cast to the enum type
      orderDirection: orderDirection as any, //
    },
    {
      fetchPolicy: 'network-only',
    }
  )

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

export default PoolsList
