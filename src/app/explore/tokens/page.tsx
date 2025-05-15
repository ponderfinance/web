// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic'

import React, { Suspense } from 'react'
import { TokensPage } from '@/src/modules/explore/components/TokensPage'
import { View, Text, Skeleton } from 'reshaped'
import ScrollableTable from '@/src/components/ScrollableTable'

// Lightweight loading component that doesn't require data fetching
const LoadingFallback = () => (
  <View gap={4}>
    <Text variant="featured-2" weight="medium">Tokens</Text>
    <ScrollableTable minWidth="900px">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        padding={2}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
        width="100%"
      >
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">#</Text>
        </View.Item>
        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">Token name</Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">Price</Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">1H</Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">1D</Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">FDV</Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">Volume</Text>
        </View.Item>
      </View>

      {/* Skeleton Rows */}
      <View direction="column" gap={0} width="100%">
        {[...Array(5)].map((_, index) => (
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
                <Skeleton width="28px" height="28px" borderRadius="circular" />
                <View direction="column" gap={1}>
                  <Skeleton width="100px" height="20px" />
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
  </View>
)

export default function TokensRoute() {
  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <TokensPage />
      </Suspense>
    </>
  )
}

// Add metadata
export const metadata = {
  title: 'Explore Tokens | Ponder Finance',
  description: 'Explore tokens and their metrics on Ponder Finance.'
}
