'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { TokensPageQuery } from '@/src/__generated__/TokensPageQuery.graphql'
import { TokensDisplay } from '@/src/modules/explore/components/TokensDisplay'
import { View, Text, Skeleton } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import ScrollableTable from '@/src/components/ScrollableTable'

export const tokensPageQuery = graphql`
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
          priceChange1h
          priceChange24h
          volumeUSD24h
          volume1h
          fdv
          ...TokenPairFragment
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
            Token name
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Price
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            1H
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            1D
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            FDV
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Volume
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
                <Skeleton width={8} height={8} borderRadius="circular" />
                <View direction="row" gap={1} align="center">
                  <Skeleton width="120px" height="24px" />
                </View>
              </View>
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="50px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="50px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
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
