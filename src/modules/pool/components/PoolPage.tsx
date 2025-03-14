'use client'

import { useAccount } from 'wagmi'
import { graphql, useLazyLoadQuery } from 'react-relay'
import { PoolPageQuery } from '@/src/__generated__/PoolPageQuery.graphql'
import { Button, Text, View } from 'reshaped'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { LiquidityPositionsList } from '@/src/components/LiquidityPositionsList'
import React from 'react'

const userPositionsQuery = graphql`
  query PoolPageQuery($userAddress: String!) {
    userPositions(userAddress: $userAddress) {
      liquidityPositions {
        ...LiquidityPositionItem_position
      }
    }
  }
`

export const PoolPage = () => {
  const account = useAccount()

  // Fetch data at the page level
  const data = useLazyLoadQuery<PoolPageQuery>(
    userPositionsQuery,
    {
      userAddress: account.address?.toLowerCase() || '',
    },
    {
      fetchPolicy: 'network-only',
    }
  )

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

        <LiquidityPositionsList positionsData={data.userPositions} />
      </View>
    </View>
  )
}
