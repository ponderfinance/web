'use client'

import React, { Suspense, useEffect, useState, useCallback } from 'react'
import { graphql, useLazyLoadQuery, useQueryLoader, PreloadedQuery } from 'react-relay'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'
import { TransactionsDisplay } from '@/src/modules/explore/components/TransactionsDisplay'
import { View, Text, Skeleton } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import ScrollableTable from '@/src/components/ScrollableTable'

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
    <ScrollableTable minWidth="1000px">
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
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>

            <View.Item columns={1}>
              <Skeleton width="40px" height="24px" />
            </View.Item>

            <View.Item columns={4}>
              <View direction="row" gap={2} align="center">
                <Skeleton width={8} height={8} borderRadius="circular" />
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
    </ScrollableTable>
  )
}

// Main content component that fetches data
function TransactionsContent({ queryRef }: { queryRef: PreloadedQuery<TransactionsPageQuery> }) {
  const data = useLazyLoadQuery<TransactionsPageQuery>(
    transactionsPageQuery,
    {
      first: 15,
    },
    {
      fetchPolicy: 'store-or-network',
    }
  )

  return <TransactionsDisplay data={data} />
}

// Exported page component
export const TransactionsPage = () => {
  const [mounted, setMounted] = useState(false)
  const [queryRef, loadQuery] = useQueryLoader<TransactionsPageQuery>(transactionsPageQuery)

  // Handle transaction updates
  const handleTransactionUpdate = useCallback(() => {
    console.log('[TransactionsPage] Refreshing transactions due to real-time update')
    loadQuery({ first: 15 }, { fetchPolicy: 'store-and-network' })
  }, [loadQuery])
  
  // Use our custom hook for real-time updates
  useRefreshOnUpdate({
    entityType: 'transaction',
    onUpdate: handleTransactionUpdate,
    minRefreshInterval: 5000, // 5 seconds minimum between updates
    shouldRefetch: true // Force refetch when transactions are updated
  })

  // Only render the query component after mounting on the client
  useEffect(() => {
    setMounted(true)
    
    // Initial load
    loadQuery({ first: 15 })
  }, [loadQuery])

  if (!mounted) {
    return <TransactionsLoading />
  }
  
  return (
    <View gap={6}>
      <Suspense fallback={<TransactionsLoading />}>
        {queryRef && <TransactionsContent queryRef={queryRef} />}
      </Suspense>
    </View>
  )
}
