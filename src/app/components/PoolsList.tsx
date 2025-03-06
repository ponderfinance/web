import React from 'react'
import { Text, View, Skeleton } from 'reshaped'
import { useAllPairs, usePonderSDK } from '@ponderfinance/sdk'
import { formatUnits } from 'viem'
import PoolItem from './PoolItem'

export default function PoolsList() {
  const sdk = usePonderSDK()

  // Use the useAllPairs hook to fetch all pairs
  const {
    data: allPairs,
    isLoading,
    error: pairsError,
  } = useAllPairs({
    includeTotalSupply: true,
    includeReserves: true,
  })

  return (
    <View direction="column" gap={16}>
      {/* Loading state */}
      {isLoading && (
        <View direction="column" gap={4}>
          <Skeleton height={80} width="100%" borderRadius="large" />
          <Skeleton height={80} width="100%" borderRadius="large" />
          <Skeleton height={80} width="100%" borderRadius="large" />
        </View>
      )}

      {/* Empty state */}
      {!isLoading && (!allPairs || allPairs.length === 0) && (
        <Text align="center">No pools found.</Text>
      )}

      {/* Pool list */}
      <View direction="column" gap={8}>
        {allPairs &&
          allPairs.map((pool) => (
            <PoolItem
              key={pool.address}
              pool={{
                pairAddress: pool.address,
                token0: {
                  address: pool.token0,
                  symbol: pool.token0Symbol,
                  decimals: pool.token0Decimals,
                },
                token1: {
                  address: pool.token1,
                  symbol: pool.token1Symbol,
                  decimals: pool.token1Decimals,
                },
                totalSupply: pool.totalSupply,
                reserve0: pool.reserve0,
                reserve1: pool.reserve1,
                token0Amount: formatUnits(pool.reserve0, pool.token0Decimals),
                token1Amount: formatUnits(pool.reserve1, pool.token1Decimals),
              }}
            />
          ))}
      </View>
    </View>
  )
}
