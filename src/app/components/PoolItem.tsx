import React from 'react'
import { Text, View } from 'reshaped'
import { Address } from 'viem'
import { TokenPair } from '@/src/app/components/TokenPair'
import { formatNumber, roundDecimal } from '@/src/app/utils/numbers'

interface PoolItemProps {
  pool: {
    pairAddress: Address
    token0: {
      address: Address
      symbol: string
      decimals: number
    }
    token1: {
      address: Address
      symbol: string
      decimals: number
    }
    totalSupply: bigint
    reserve0: bigint
    reserve1: bigint
    token0Amount: string
    token1Amount: string
  }
}

export default function PoolItem({ pool }: PoolItemProps) {
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
          tokenAddressA={pool.token0.address}
          tokenAddressB={pool.token1.address}
          size="large"
        />
        {/*<Text variant="body-3">Pair: {pool.pairAddress}</Text>*/}
      </View>
    </View>
  )
}
