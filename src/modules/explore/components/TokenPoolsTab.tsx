'use client'

import React, { useMemo } from 'react'
import { View, Text, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { TokenPoolsTabQuery } from '@/src/__generated__/TokenPoolsTabQuery.graphql'
import ScrollableTable from '@/src/components/ScrollableTable'
import Link from 'next/link'

// Main query - get token with all its pairs
export const tokenPoolsQuery = graphql`
  query TokenPoolsTabQuery($tokenAddress: String!) {
    tokenByAddress(address: $tokenAddress) {
      id
      address
      symbol
      imageUri
      pairsAsToken0 {
        id
        address
        token0 {
          id
          address
          symbol
          imageUri
        }
        token1 {
          id
          address
          symbol
          imageUri
        }
        tvl
        poolApr
        rewardApr
        reserveUsd
      }
      pairsAsToken1 {
        id
        address
        token0 {
          id
          address
          symbol
          imageUri
        }
        token1 {
          id
          address
          symbol
          imageUri
        }
        tvl
        poolApr
        rewardApr
        reserveUsd
      }
    }
  }
`

// Helper functions
const formatLargeNumber = (value: number | null | undefined): string => {
  if (!value) return '$0'

  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

const formatAPR = (apr: number | null | undefined): string => {
  if (!apr) return '0.00%'
  return `${apr.toFixed(2)}%`
}

// Loading skeleton component
function PoolsLoading() {
  return (
    <ScrollableTable minWidth="800px">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        paddingInline={4}
        paddingBlock={2}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
        width="100%"
      >
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">#</Text>
        </View.Item>
        <View.Item columns={5}>
          <Text color="neutral-faded" weight="medium">Pool</Text>
        </View.Item>
        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">TVL</Text>
        </View.Item>
        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">Pool APR</Text>
        </View.Item>
      </View>

      {/* Skeleton Rows */}
      <View direction="column" gap={0} width="100%">
        {[...Array(10)].map((_, index) => (
          <View
            key={index}
            direction="row"
            gap={0}
            padding={4}
            align="center"
            width="100%"
          >
            <View.Item columns={1}>
              <Skeleton width="24px" height="24px" />
            </View.Item>
            <View.Item columns={5}>
              <View direction="row" gap={2} align="center">
                <Skeleton width={8} height={8} borderRadius="circular" />
                <Skeleton width={8} height={8} borderRadius="circular" />
                <Skeleton width="120px" height="24px" />
              </View>
            </View.Item>
            <View.Item columns={3}>
              <Skeleton width="80px" height="24px" />
            </View.Item>
            <View.Item columns={3}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
}

// Component that renders pools
function PoolsQueryRenderer({ tokenAddress }: { tokenAddress: string }) {
  const data = useLazyLoadQuery<TokenPoolsTabQuery>(
    tokenPoolsQuery,
    { tokenAddress },
    { fetchPolicy: 'store-or-network' }
  )

  // Merge pairs from both token0 and token1 positions and sort by TVL
  const allPools = useMemo(() => {
    if (!data.tokenByAddress) return []

    const pools = [
      ...(data.tokenByAddress.pairsAsToken0 || []),
      ...(data.tokenByAddress.pairsAsToken1 || [])
    ]

    // Sort by TVL descending
    return pools.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
  }, [data])

  if (!data.tokenByAddress) {
    return (
      <View padding={4} align="center">
        <Text>Token not found</Text>
      </View>
    )
  }

  if (allPools.length === 0) {
    return (
      <View padding={4} align="center">
        <Text>No pools found for this token</Text>
      </View>
    )
  }

  return (
    <ScrollableTable minWidth="800px">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        paddingInline={4}
        paddingBlock={2}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
        width="100%"
      >
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">#</Text>
        </View.Item>
        <View.Item columns={5}>
          <Text color="neutral-faded" weight="medium">Pool</Text>
        </View.Item>
        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">TVL</Text>
        </View.Item>
        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">Pool APR</Text>
        </View.Item>
      </View>

      {/* Table Body */}
      <View direction="column" gap={0} width="100%">
        {allPools.map((pool, index) => {
          // Calculate total APR (pool + rewards)
          const totalAPR = (pool.poolApr || 0) + (pool.rewardApr || 0)

          return (
            <Link
              key={pool.address}
              href={`/explore/pools/${pool.address}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <View
                direction="row"
                gap={0}
                padding={4}
                className={'border-0 border-neutral-faded'}
                align="center"
                width="100%"
                attributes={{
                  style: { cursor: 'pointer' }
                }}
              >
                <View.Item columns={1}>
                  <Text variant="body-3">{index + 1}</Text>
                </View.Item>

                <View.Item columns={5}>
                  <View direction="row" align="center" gap={2}>
                    <Text variant="body-3">
                      {pool.token0.symbol}/{pool.token1.symbol}
                    </Text>
                  </View>
                </View.Item>

                <View.Item columns={3}>
                  <Text variant="body-3">{formatLargeNumber(pool.tvl)}</Text>
                </View.Item>

                <View.Item columns={3}>
                  <Text
                    variant="body-3"
                    color={totalAPR > 0 ? 'positive' : 'neutral'}
                  >
                    {formatAPR(totalAPR)}
                  </Text>
                </View.Item>
              </View>
            </Link>
          )
        })}
      </View>
    </ScrollableTable>
  )
}

// Main export component
export function TokenPoolsTab({ tokenAddress }: { tokenAddress: string }) {
  return (
    <React.Suspense fallback={<PoolsLoading />}>
      <PoolsQueryRenderer tokenAddress={tokenAddress} />
    </React.Suspense>
  )
}