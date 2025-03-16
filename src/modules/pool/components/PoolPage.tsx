'use client'

import { useAccount } from 'wagmi'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { PoolPageQuery } from '@/src/__generated__/PoolPageQuery.graphql'
import { Button, Text, View } from 'reshaped'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { LiquidityPositionsList } from '@/src/components/LiquidityPositionsList'
import React, { Suspense, useState } from 'react'

const userPositionsQuery = graphql`
  query PoolPageQuery($userAddress: String!) {
    userPositions(userAddress: $userAddress) {
      liquidityPositions {
        ...LiquidityPositionItem_position
      }
    }
  }
`

// Loading component for suspense
function PoolLoading() {
  return <View align="center" justify="center" height="40vh"></View>
}

// Main content component that fetches data
function PoolContent({ userAddress }: { userAddress: string }) {
  // Fetch data at the content level
  const data = useLazyLoadQuery<PoolPageQuery>(
    userPositionsQuery,
    {
      userAddress: userAddress || '',
    },
    {
      fetchPolicy: 'network-only',
    }
  )

  return <LiquidityPositionsList positionsData={data.userPositions} />
}

// Exported page component
export const PoolPage = () => {
  const account = useAccount()
  const userAddress = account.address?.toLowerCase() || ''

  return (
    <View direction="column">
      <View gap={12}>
        <View gap={4}>
          <Text variant="featured-2">Your Positions</Text>
          <Link href="/positions/create">
            <Button
              variant="faded"
              color="neutral"
              attributes={{ style: { alignSelf: 'self-start' } }}
              rounded={true}
            >
              <View gap={4} direction="row" align="center" paddingInline={2}>
                <Plus size={16} />
                <Text variant="body-3">New</Text>
              </View>
            </Button>
          </Link>
        </View>

        <Suspense fallback={<PoolLoading />}>
          <PoolContent userAddress={userAddress} />
        </Suspense>
      </View>
    </View>
  )
}
