'use client'

import React, { Suspense, useState } from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { TokensPageQuery } from '@/src/__generated__/TokensPageQuery.graphql'
import { TokensDisplay } from '@/src/modules/explore/components/TokensDisplay'
import { View, Text } from 'reshaped'

const tokensPageQuery = graphql`
  query TokensPageQuery(
    $first: Int!
    $orderBy: TokenOrderBy!
    $orderDirection: OrderDirection!
  ) {
    tokens(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {
      edges {
        node {
          id
          address
          imageURI
          name
          symbol
          priceUSD
          priceChange24h
          volumeUSD24h
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
function TokensLoading() {
  return <View align="center" justify="center" height="40vh"></View>
}

// Main content component that fetches data
function TokensContent({
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
  const data = useLazyLoadQuery<TokensPageQuery>(
    tokensPageQuery,
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
    <TokensDisplay
      data={data}
      orderBy={orderBy}
      orderDirection={orderDirection}
      setOrderBy={setOrderBy}
      setOrderDirection={setOrderDirection}
    />
  )
}

// Exported page component
export const TokensPage = () => {
  const [orderBy, setOrderBy] = useState<string>('volumeUSD24h')
  const [orderDirection, setOrderDirection] = useState<string>('desc')

  return (
    <View gap={6}>
      <Suspense fallback={<TokensLoading />}>
        <TokensContent
          orderBy={orderBy}
          orderDirection={orderDirection}
          setOrderBy={setOrderBy}
          setOrderDirection={setOrderDirection}
        />
      </Suspense>
    </View>
  )
}
