'use client'

import React from 'react'
import { View, Text, Card, Grid, Skeleton, Tabs, Divider } from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import PriceChartContainer from './PriceChartContainer'
import { PairDetailPageQuery } from '@/src/__generated__/PairDetailPageQuery.graphql'

// Define the query for the pair detail page - using pairByAddress instead of pair
const PairDetailQuery = graphql`
  query PairDetailPageQuery($pairAddress: String!) {
    pairByAddress(address: $pairAddress) {
      id
      address
      reserve0
      reserve1
      token0 {
        id
        symbol
        address
      }
      token1 {
        id
        symbol
        address
      }
      ...PriceChartContainer_pair
    }
  }
`

export default function PairDetailPage({ params }: { params: { address: string } }) {
  const pairAddress = params.address

  // Only render client-side data after component is mounted
  const [isMounted, setIsMounted] = React.useState(false)
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Show loading skeleton during SSR or before mounting
  if (!isMounted) {
    return <PairDetailPageSkeleton />
  }

  return <PairDetailContent pairAddress={pairAddress} />
}

function PairDetailContent({ pairAddress }: { pairAddress: string }) {
  // Fetch pair data using pairByAddress
  const data = useLazyLoadQuery<PairDetailPageQuery>(
      PairDetailQuery,
      { pairAddress },
      { fetchPolicy: 'store-or-network' }
  )

  // Use pairByAddress instead of pair
  const pair = data.pairByAddress

  // Show error if pair not found
  if (!pair) {
    return (
        <View padding={24}>
          <Card>
            <Text variant="title-3" align="center">
              Pair not found
            </Text>
          </Card>
        </View>
    )
  }

  return (
      <View direction="column" gap={24} padding={24}>
        {/* Pair header */}
        <Card>
          <View padding={16}>
            <Text variant="title-2">
              {pair.token0.symbol}/{pair.token1.symbol} Pool
            </Text>
          </View>
        </Card>

        {/* Chart section */}
        <Card>
          <View padding={16} direction="column" gap={16}>
            <PriceChartContainer pairRef={pair} />
          </View>
        </Card>

        {/* Pool stats */}
        <Card>
          <View padding={16} direction="column" gap={16}>
            <Text variant="title-3">Pool Stats</Text>

            <Grid columns={{ s: 1, m: 3 }} gap={16}>
              <View direction="column" gap={4}>
                <Text color="neutral">Reserve {pair.token0.symbol}</Text>
                <Text variant="title-4">{parseFloat(pair.reserve0).toLocaleString()}</Text>
              </View>

              <View direction="column" gap={4}>
                <Text color="neutral">Reserve {pair.token1.symbol}</Text>
                <Text variant="title-4">{parseFloat(pair.reserve1).toLocaleString()}</Text>
              </View>

              <View direction="column" gap={4}>
                <Text color="neutral">TVL</Text>
                <Text variant="title-4">$0.00</Text>
              </View>
            </Grid>
          </View>
        </Card>
      </View>
  )
}

// Skeleton loading state
function PairDetailPageSkeleton() {
  return (
      <View direction="column" gap={24} padding={24}>
        <Card>
          <View padding={16}>
            <Skeleton height={32} width="50%" borderRadius="large" />
          </View>
        </Card>

        <Card>
          <View padding={16} direction="column" gap={16}>
            <Skeleton height={400} width="100%" borderRadius="large" />
          </View>
        </Card>

        <Card>
          <View padding={16} direction="column" gap={16}>
            <Skeleton height={24} width="30%" borderRadius="large" />

            <Grid columns={{ s: 1, m: 3 }} gap={16}>
              <View direction="column" gap={4}>
                <Skeleton height={16} width="80%" borderRadius="large" />
                <Skeleton height={24} width="60%" borderRadius="large" />
              </View>

              <View direction="column" gap={4}>
                <Skeleton height={16} width="80%" borderRadius="large" />
                <Skeleton height={24} width="60%" borderRadius="large" />
              </View>

              <View direction="column" gap={4}>
                <Skeleton height={16} width="80%" borderRadius="large" />
                <Skeleton height={24} width="60%" borderRadius="large" />
              </View>
            </Grid>
          </View>
        </Card>
      </View>
  )
}
