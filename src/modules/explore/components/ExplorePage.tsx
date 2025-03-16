'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { graphql, PreloadedQuery, useQueryLoader, usePreloadedQuery } from 'react-relay'
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

export const ExplorePage = (): React.ReactElement | null => {
  const [orderBy, setOrderBy] = useState<string>('reserveUSD')
  const [orderDirection, setOrderDirection] = useState<string>('desc')
  const [isPending, startTransition] = useTransition()

  // Create a query reference to store preloaded query
  const [queryRef, loadQuery] = useQueryLoader<ExplorePageQuery>(explorePageQuery)

  // Load the initial query when component mounts
  useEffect(() => {
    loadQuery({
      first: 50,
      orderBy: orderBy as any,
      orderDirection: orderDirection as any,
    })
  }, [loadQuery, orderBy, orderDirection])

  // Handle sorting changes
  const handleSortChange = (newOrderBy: string, newOrderDirection: string): void => {
    startTransition(() => {
      setOrderBy(newOrderBy)
      setOrderDirection(newOrderDirection)

      // Reload query with new parameters
      loadQuery({
        first: 50,
        orderBy: newOrderBy as any,
        orderDirection: newOrderDirection as any,
      })
    })
  }

  // If we don't have a query reference yet, render nothing
  // (the parent Suspense boundary will show the loading state)
  if (!queryRef) {
    return null
  }

  return (
    <ExplorePageContent
      queryRef={queryRef}
      orderBy={orderBy}
      orderDirection={orderDirection}
      isPending={isPending}
      onSortChange={handleSortChange}
    />
  )
}

interface ExplorePageContentProps {
  queryRef: PreloadedQuery<ExplorePageQuery>
  orderBy: string
  orderDirection: string
  isPending: boolean
  onSortChange: (orderBy: string, orderDirection: string) => void
}

// Separate component to use the preloaded query
function ExplorePageContent({
  queryRef,
  orderBy,
  orderDirection,
  isPending,
  onSortChange,
}: ExplorePageContentProps): React.ReactElement {
  // Use the preloaded query
  const data = usePreloadedQuery<ExplorePageQuery>(explorePageQuery, queryRef)

  return (
    <View gap={2}>
      <View direction="row" align="center" justify="space-between">
        <Text variant="featured-2">Pools</Text>
      </View>
      <Explore
        data={data}
        orderBy={orderBy}
        orderDirection={orderDirection}
        setOrderBy={(newOrderBy: string) => onSortChange(newOrderBy, orderDirection)}
        setOrderDirection={(newOrderDirection: string) =>
          onSortChange(orderBy, newOrderDirection)
        }
      />
    </View>
  )
}
