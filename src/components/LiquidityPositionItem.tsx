'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { Text, View, Button, Skeleton, Popover } from 'reshaped'
import { Address, formatEther, formatUnits, erc20Abi } from 'viem'
import { TokenPair } from '@/src/components/TokenPair'
import { formatNumber, roundDecimal } from '@/src/utils/numbers'
import { graphql, useFragment } from 'react-relay'
import { LiquidityPositionItem_position$key } from '@/src/__generated__/LiquidityPositionItem_position.graphql'
import { usePonderSDK } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import {DotsThree, Minus} from '@phosphor-icons/react'

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
        ...TokenPairFragment
      }
      token1 {
        id
        address
        symbol
        ...TokenPairFragment
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

  // Show error state
  if (error || !position) return null

  return (
    <View
      direction="column"
      gap={4}
      borderColor="neutral-faded"
      borderRadius="large"
      overflow="hidden"
    >
      <View gap={4} padding={8} paddingBottom={4}>
        <TokenPair
          tokenA={fragmentData.pair.token0}
          tokenB={fragmentData.pair.token1}
          size="large"
        />
      </View>

      <View
        gap={8}
        direction="column"
        backgroundColor="elevation-base"
        padding={8}
        paddingInline={8}
      >
        <View direction="row" gap={{ s: 4, m: 8 }} justify="center">
          <View.Item columns={{ s: 12, m: 4 }}>
            <View direction="column" width="100%" align="start">
              <View gap={2} direction="row">
                <Text variant="body-1">
                  {formatNumber(roundDecimal(position.token0Amount))}{' '}
                  {position.token0.symbol}
                </Text>
                <Text variant="body-1">
                  {formatNumber(roundDecimal(position.token1Amount))}{' '}
                  {position.token1.symbol}
                </Text>
              </View>
              <Text>Deposited tokens</Text>
            </View>
          </View.Item>
          <View.Item columns={{ s: 12, m: 4 }}>
            <View direction="column" width="100%" align="start">
              <View gap={2} direction="column" align="end">
                <Text variant="body-1">
                  {formatNumber(roundDecimal(formatEther(position.userLPBalance)))}
                </Text>
                {position.stakedInFarm && <Text color="positive">Farming Active</Text>}
              </View>
              <Text>Pool tokens</Text>
            </View>
          </View.Item>
          <View.Item columns={{ s: 12, m: 4 }}>
            <View direction="column" width="100%" align="start">
              <Text variant="body-1">{position.poolShare}%</Text>
              <Text>Share of pool</Text>
            </View>
          </View.Item>
        </View>
      </View>
      <Popover>
        <Popover.Trigger>
          {(attributes) => (
            <View position="absolute" insetEnd={4} insetTop={4}>
              <Button attributes={attributes} variant="ghost">
                <DotsThree size={24} />
              </Button>
            </View>
          )}
        </Popover.Trigger>
        <Popover.Content>
          <Button
            disabled={position.stakedInFarm}
            color={position.stakedInFarm ? 'neutral' : 'primary'}
            fullWidth={true}
            onClick={() => {
              if (!position.stakedInFarm) {
                onRemoveLiquidity(position)
              }
            }}
          >
            <Minus />
            {position.stakedInFarm ? 'Unstake from Farm First' : 'Remove Liquidity'}
          </Button>
        </Popover.Content>
      </Popover>
    </View>
  )
}

// Create a wrapper component that uses Suspense
export default function LiquidityPositionItem(props: LiquidityPositionItemProps) {
  return (
    <Suspense fallback={<Skeleton height={'222px'} width="100%" borderRadius="large" />}>
      <PositionContent {...props} />
    </Suspense>
  )
}
