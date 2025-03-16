// src/modules/explore/components/ExplorePage.tsx
'use client'

import React, { Suspense, useState } from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { ExplorePageQuery } from '@/src/__generated__/ExplorePageQuery.graphql'
import { Explore } from '@/src/modules/explore/components/Explore'
import { Text, View } from 'reshaped'

const explorePageQuery = graphql`
  query ExplorePageQuery(
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
function ExploreLoading() {
  return <View align="center" justify="center" height="40vh"></View>
}

// Main content component that fetches data
function ExploreContent({
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
  const data = useLazyLoadQuery<ExplorePageQuery>(
    explorePageQuery,
    {
      first: 50,
      orderBy: orderBy as any,
      orderDirection: orderDirection as any,
    },
    {
      fetchPolicy: 'store-and-network',
      fetchKey: orderBy + orderDirection, // Unique key when sort changes
    }
  )

  return (
    <Explore
      data={data}
      orderBy={orderBy}
      orderDirection={orderDirection}
      setOrderBy={setOrderBy}
      setOrderDirection={setOrderDirection}
    />
  )
}

// Exported page component
export const ExplorePage = () => {
  const [orderBy, setOrderBy] = useState<string>('reserveUSD')
  const [orderDirection, setOrderDirection] = useState<string>('desc')

  return (
    <View gap={2}>
      <View>
        <Text variant="featured-2">Pools</Text>
      </View>

      <Suspense fallback={<ExploreLoading />}>
        <ExploreContent
          orderBy={orderBy}
          orderDirection={orderDirection}
          setOrderBy={setOrderBy}
          setOrderDirection={setOrderDirection}
        />
      </Suspense>
    </View>
  )
}
