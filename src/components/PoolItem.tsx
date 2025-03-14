'use client'

import React from 'react'
import { Text, View } from 'reshaped'
import { Address } from 'viem'
import { TokenPair } from '@/src/components/TokenPair'
import { graphql, useFragment } from 'react-relay'
import { formatUnits } from 'viem'
import { PoolItem_pair$key } from '@/src/__generated__/PoolItem_pair.graphql'

// Define fragment for the PoolItem component
const poolFragment = graphql`
  fragment PoolItem_pair on Pair {
    id
    address
    totalSupply
    reserve0
    reserve1
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
`

interface PoolItemProps {
  pairRef: PoolItem_pair$key
}

export default function PoolItem({ pairRef }: PoolItemProps) {
  // Use the fragment to access data
  const pair = useFragment(poolFragment, pairRef)

  return (
    <View
      direction="column"
      gap={4}
      borderColor="neutral-faded"
      borderRadius="large"
      padding={8}
    >
      <View direction={{ s: 'column', m: 'row' }} gap={4}>
        <TokenPair
          tokenAddressA={pair.token0.address as Address}
          tokenAddressB={pair.token1.address as Address}
          size="large"
        />
        {/*<Text variant="body-3">Pair: {pair.address}</Text>*/}
      </View>
    </View>
  )
}
