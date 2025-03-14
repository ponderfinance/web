'use client'

import React from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { pageExploreQuery } from '@/src/__generated__/pageExploreQuery.graphql'
import { Explore } from '@/src/modules/explore/components/Explore'

const explorePageQuery = graphql`
  query pageExploreQuery(
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

  const data = useLazyLoadQuery<pageExploreQuery>(
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
    <Explore
      data={data}
      orderBy={orderBy}
      orderDirection={orderDirection}
      setOrderBy={setOrderBy}
      setOrderDirection={setOrderDirection}
    />
  )
}
