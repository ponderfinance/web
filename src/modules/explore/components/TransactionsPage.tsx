'use client'

import React, { Suspense } from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'
import { TransactionsDisplay } from '@/src/modules/explore/components/TransactionsDisplay'
import { View, Text, Skeleton } from 'reshaped'

const transactionsPageQuery = graphql`
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
    <View>
      <Skeleton height="300px" width="100%" />
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
  return (
    <View gap={6}>
      <Suspense fallback={<TransactionsLoading />}>
        <TransactionsContent />
      </Suspense>
    </View>
  )
}
