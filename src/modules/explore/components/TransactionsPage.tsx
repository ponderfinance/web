'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'
import { TransactionsDisplay } from '@/src/modules/explore/components/TransactionsDisplay'
import { View, Text, Skeleton } from 'reshaped'

export const transactionsPageQuery = graphql`
  query TransactionsPageQuery($first: Int!) {
    recentTransactions(first: $first) {
      edges {
        node {
          id
          txHash
          timestamp
          userAddress
          token0 {
            id
            address
            symbol
            ...TokenPairFragment
          }
          token1 {
            id
            address
            symbol
            ...TokenPairFragment
          }
          amountIn0
          amountIn1
          amountOut0
          amountOut1
          valueUSD
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
function TransactionsLoading() {
  return (
    <View borderRadius="medium" borderColor="neutral-faded" overflow="auto" width="100%">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        padding={4}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
      >
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Time
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Type
          </Text>
        </View.Item>

        <View.Item columns={4}>
          <Text color="neutral-faded" weight="medium">
            Token Pair
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Token Amount
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Token Amount
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Value
          </Text>
        </View.Item>
      </View>

      {/* Skeleton Rows */}
      {[...Array(10)].map((_, index) => (
        <View
          key={index}
          direction="row"
          gap={0}
          padding={4}
          className={'border-0 border-neutral-faded'}
          align="center"
        >
          <View.Item columns={2}>
            <Skeleton width="80px" height="24px" />
          </View.Item>

          <View.Item columns={1}>
            <Skeleton width="40px" height="24px" />
          </View.Item>

          <View.Item columns={4}>
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

          <View.Item columns={2}>
            <Skeleton width="100px" height="24px" />
          </View.Item>

          <View.Item columns={1}>
            <Skeleton width="60px" height="24px" />
          </View.Item>
        </View>
      ))}
    </View>
  )
}

// Main content component that fetches data
function TransactionsContent() {
  const data = useLazyLoadQuery<TransactionsPageQuery>(
    transactionsPageQuery,
    {
      first: 20,
    },
    {
      fetchPolicy: 'store-and-network',
    }
  )

  return <TransactionsDisplay data={data} />
}

// Exported page component
export const TransactionsPage = () => {
  const [mounted, setMounted] = useState(false)

  // Only render the query component after mounting on the client
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }
  
  return (
    <View gap={6}>
      <Suspense fallback={<TransactionsLoading />}>
        <TransactionsContent />
      </Suspense>
    </View>
  )
}
