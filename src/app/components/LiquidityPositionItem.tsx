import React from 'react'
import { Text, Card, View, Button } from 'reshaped'
import { Address, formatEther } from 'viem'
import { TokenPair } from '@/src/app/components/TokenPair'
import { formatNumber, roundDecimal } from '@/src/app/utils/numbers'

interface Position {
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
  position: Position
  onRemoveLiquidity: (position: Position) => void
}

export default function LiquidityPositionItem({
  position,
  onRemoveLiquidity,
}: LiquidityPositionItemProps) {
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
