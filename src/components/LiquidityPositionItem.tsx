'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { Text, View, Button, Skeleton } from 'reshaped'
import { Address, formatEther, formatUnits, erc20Abi } from 'viem'
import { TokenPair } from '@/src/components/TokenPair'
import { formatNumber, roundDecimal } from '@/src/utils/numbers'
import { graphql, useFragment } from 'react-relay'
import { LiquidityPositionItem_position$key } from '@/src/__generated__/LiquidityPositionItem_position.graphql'
import { usePonderSDK } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'

// Define the fragment for position data
export const PositionFragment = graphql`
  fragment LiquidityPositionItem_position on LiquidityPosition {
    id
    pair {
      id
      address
      token0 {
        id
        address
        symbol
      }
      token1 {
        id
        address
        symbol
      }
    }
    liquidityTokens
  }
`

interface PositionData {
  id: string
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
  userLPBalance: bigint
  totalSupply: bigint
  reserve0: bigint
  reserve1: bigint
  poolShare: string
  token0Amount: string
  token1Amount: string
  stakedInFarm: boolean
  isWETHPair: boolean
  tokenAddress?: Address
}

interface LiquidityPositionItemProps {
  positionRef: LiquidityPositionItem_position$key
  onRemoveLiquidity: (position: PositionData) => void
  wethAddress: string
}

function PositionContent({
  positionRef,
  onRemoveLiquidity,
  wethAddress,
}: LiquidityPositionItemProps) {
  const [position, setPosition] = useState<PositionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sdk = usePonderSDK()
  const account = useAccount()

  // Use the fragment to access the data
  const fragmentData = useFragment(PositionFragment, positionRef)

  // Fetch detailed position data from contracts
  const fetchPositionData = async () => {
    if (!sdk || !account.address) return

    try {
      setIsLoading(true)
      setError(null)

      const pairAddress = fragmentData.pair.address as Address

      // Get the pair contract
      const pair = sdk.getPair(pairAddress)

      // Get user's LP balance
      const lpBalance = await pair.balanceOf(account.address as Address)

      // Skip if no balance
      if (lpBalance === BigInt(0)) {
        setIsLoading(false)
        return
      }

      // Get pair details from contract
      const [reserves, totalSupply] = await Promise.all([
        pair.getReserves(),
        pair.totalSupply(),
      ])

      // Get token addresses
      const token0Address = fragmentData.pair.token0.address as Address
      const token1Address = fragmentData.pair.token1.address as Address

      // Get token decimals
      const [token0Decimals, token1Decimals] = await Promise.all([
        sdk.publicClient.readContract({
          address: token0Address,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
        sdk.publicClient.readContract({
          address: token1Address,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ])

      // Calculate pool share
      const poolShare = ((Number(lpBalance) / Number(totalSupply)) * 100).toFixed(2)

      // Calculate token amounts
      const token0Amount = formatUnits(
        (lpBalance * reserves.reserve0) / totalSupply,
        token0Decimals
      )
      const token1Amount = formatUnits(
        (lpBalance * reserves.reserve1) / totalSupply,
        token1Decimals
      )

      // Check if this is a WETH pair
      const isWETHPair =
        token0Address.toLowerCase() === wethAddress.toLowerCase() ||
        token1Address.toLowerCase() === wethAddress.toLowerCase()

      // Get the non-WETH token address if applicable
      const tokenAddress = isWETHPair
        ? token0Address.toLowerCase() === wethAddress.toLowerCase()
          ? token1Address
          : token0Address
        : undefined

      // Create the position object
      const positionData: PositionData = {
        id: fragmentData.id || `${pairAddress}-${account.address}`,
        pairAddress,
        token0: {
          address: token0Address,
          symbol: fragmentData.pair.token0.symbol ?? '',
          decimals: token0Decimals,
        },
        token1: {
          address: token1Address,
          symbol: fragmentData.pair.token1.symbol ?? '',
          decimals: token1Decimals,
        },
        userLPBalance: lpBalance,
        totalSupply,
        reserve0: reserves.reserve0,
        reserve1: reserves.reserve1,
        poolShare,
        token0Amount,
        token1Amount,
        stakedInFarm: false, // If you have staked farms, update this logic
        isWETHPair,
        tokenAddress,
      }

      setPosition(positionData)
    } catch (err) {
      console.error('Error fetching position data:', err)
      setError('Failed to load position data')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch data on mount and periodically
  useEffect(() => {
    fetchPositionData()

    const interval = setInterval(() => {
      fetchPositionData()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [sdk, account.address, fragmentData])

  // Show loading state
  if (isLoading && !position) {
    return (
      <View
        direction="column"
        gap={4}
        borderColor="neutral-faded"
        borderRadius="large"
        padding={8}
      >
        <Skeleton height={40} width="100%" borderRadius="large" />
        <Skeleton height={100} width="100%" borderRadius="large" />
      </View>
    )
  }

  // Show error state
  if (error || !position) return null

  return (
    <View
      direction="column"
      gap={4}
      borderColor="neutral-faded"
      borderRadius="large"
      padding={8}
    >
      <View gap={4}>
        <TokenPair
          tokenAddressA={position.token0.address}
          tokenAddressB={position.token1.address}
          size="large"
        />
        <Text variant="body-3">Pair: {position.pairAddress}</Text>
      </View>

      <View
        gap={8}
        direction="column"
        backgroundColor="elevation-base"
        padding={8}
        paddingInline={8}
        borderRadius="large"
      >
        <View direction="row" gap={{ s: 4, m: 8 }}>
          <View.Item columns={{ s: 12, m: 4 }}>
            <View direction="column" width="100%" align="start">
              <Text variant="body-1">Your Pool Share</Text>
              <Text>{position.poolShare}%</Text>
            </View>
          </View.Item>
          <View.Item columns={{ s: 12, m: 4 }}>
            <View direction="column" width="100%" align="start">
              <Text>Your Position:</Text>
              <View gap={2} direction="column" align="end">
                <Text>
                  {formatNumber(roundDecimal(position.token0Amount))}{' '}
                  {position.token0.symbol}
                </Text>
                <Text>
                  {formatNumber(roundDecimal(position.token1Amount))}{' '}
                  {position.token1.symbol}
                </Text>
              </View>
            </View>
          </View.Item>
          <View.Item columns={{ s: 12, m: 4 }}>
            <View direction="column" width="100%" align="start">
              <Text>LP Tokens:</Text>
              <View gap={2} direction="column" align="end">
                <Text>
                  {formatNumber(roundDecimal(formatEther(position.userLPBalance)))}
                </Text>
                {position.stakedInFarm && <Text color="positive">Farming Active</Text>}
              </View>
            </View>
          </View.Item>
        </View>

        <Button
          disabled={position.stakedInFarm}
          color={position.stakedInFarm ? 'neutral' : 'primary'}
          onClick={() => {
            if (!position.stakedInFarm) {
              onRemoveLiquidity(position)
            }
          }}
        >
          {position.stakedInFarm ? 'Unstake from Farm First' : 'Remove Liquidity'}
        </Button>
      </View>
    </View>
  )
}

// Create a wrapper component that uses Suspense
export default function LiquidityPositionItem(props: LiquidityPositionItemProps) {
  return (
    <Suspense
      fallback={
        <View
          direction="column"
          gap={4}
          borderColor="neutral-faded"
          borderRadius="large"
          padding={8}
        >
          <Skeleton height={40} width="100%" borderRadius="large" />
          <Skeleton height={100} width="100%" borderRadius="large" />
        </View>
      }
    >
      <PositionContent {...props} />
    </Suspense>
  )
}
