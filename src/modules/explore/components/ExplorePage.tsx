'use client'

import React from 'react'
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

export const ExplorePage = () => {
  const [orderBy, setOrderBy] = React.useState<string>('reserveUSD')
  const [orderDirection, setOrderDirection] = React.useState<string>('desc')

  const data = useLazyLoadQuery<ExplorePageQuery>(
    explorePageQuery,
    {
      first: 50,
      orderBy: orderBy as any,
      orderDirection: orderDirection as any,
    },
    {
      fetchPolicy: 'network-only',
    }
  )

  return (
    <View gap={2}>
      <View>
        <Text variant="featured-2">Pools</Text>
      </View>
      <Explore
        data={data}
        orderBy={orderBy}
        orderDirection={orderDirection}
        setOrderBy={setOrderBy}
        setOrderDirection={setOrderDirection}
      />
    </View>
  )
}
