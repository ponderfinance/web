'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { PoolsPageQuery } from '@/src/__generated__/PoolsPageQuery.graphql'
import { PoolsDisplay } from '@/src/modules/explore/components/PoolsDisplay'
import { View, Text, Skeleton } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import ScrollableTable from '@/src/components/ScrollableTable'

export const poolsPageQuery = graphql`
  query PoolsPageQuery(
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
            ...TokenPairFragment
          }
          token1 {
            id
            address
            symbol
            decimals
            ...TokenPairFragment
          }
          tvl
          reserveUSD
          poolAPR
          rewardAPR
          volume24h
          volume30d
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

// Loading component for suspense
function PoolsLoading() {
  return (
    <ScrollableTable minWidth="900px">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        padding={4}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
        width="100%"
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
          <Text color="neutral-faded" weight="medium">
            TVL
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Pool APR
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Reward APR
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            1D vol
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            30D vol
          </Text>
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
            className={'border-0 border-neutral-faded'}
            align="center"
            width="100%"
          >
            <View.Item columns={1}>
              <Skeleton width="20px" height="24px" />
            </View.Item>
            <View.Item columns={3}>
              <View direction="row" gap={2} align="center">
                <View direction="row" gap={1}>
                  <Skeleton width="28px" height="28px" borderRadius="circular" />
                  <Skeleton width="28px" height="28px" borderRadius="circular" />
                </View>
                <Skeleton width="120px" height="24px" />
              </View>
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="100px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="100px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="100px" height="24px" />
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
}

// Main content component that fetches data
function PoolsContent({
  orderBy,
  orderDirection,
  setOrderBy,
  setOrderDirection,
}: {
  orderBy: string
  orderDirection: string
  setOrderBy: (value: string) => void
  setOrderDirection: (value: string) => void
}) {
  const data = useLazyLoadQuery<PoolsPageQuery>(
    poolsPageQuery,
    {
      first: 20,
      orderBy: orderBy as any,
      orderDirection: orderDirection as any,
    },
    {
      fetchPolicy: 'store-or-network',
      fetchKey: orderBy + orderDirection,
    }
  )

  return (
    <PoolsDisplay
      data={data}
      orderBy={orderBy}
      orderDirection={orderDirection}
      setOrderBy={setOrderBy}
      setOrderDirection={setOrderDirection}
    />
  )
}

// Exported page component
export const PoolsPage = () => {
  const [orderBy, setOrderBy] = useState<string>('reserveUSD')
  const [orderDirection, setOrderDirection] = useState<string>('desc')
  const [mounted, setMounted] = useState(false)

  // Only render the query component after mounting on the client
  useEffect(() => {
    setMounted(true)
    
    // Prefetch the data
    return () => {
      // Cleanup any resources if needed
    }
  }, [])

  if (!mounted) {
    return <PoolsLoading />
  }

  return (
    <View gap={6}>
      <Suspense fallback={<PoolsLoading />}>
        <PoolsContent
          orderBy={orderBy}
          orderDirection={orderDirection}
          setOrderBy={setOrderBy}
          setOrderDirection={setOrderDirection}
        />
      </Suspense>
    </View>
  )
}
