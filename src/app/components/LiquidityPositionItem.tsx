import React from 'react'
import { Text, Card, View, Button } from 'reshaped'
import { Address, formatEther } from 'viem'

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
    <Card>
      <View direction="column" gap={16}>
        <View gap={4}>
          <Text variant="featured-1">
            {position.token0.symbol}/{position.token1.symbol}
            {position.isWETHPair && ' (ETH Pair)'}
          </Text>
          <Text variant="body-3">Pair: {position.pairAddress}</Text>
        </View>

        <View gap={8} direction="column">
          <View direction="row" justify="space-between">
            <Text>Your Pool Share:</Text>
            <Text>{position.poolShare}%</Text>
          </View>

          <View direction="row" justify="space-between">
            <Text>Your Position:</Text>
            <View gap={2} direction="column" align="end">
              <Text>
                {position.token0Amount} {position.token0.symbol}
              </Text>
              <Text>
                {position.token1Amount} {position.token1.symbol}
              </Text>
            </View>
          </View>

          <View direction="row" justify="space-between">
            <Text>LP Tokens:</Text>
            <View gap={2} direction="column" align="end">
              <Text>{formatEther(position.userLPBalance)}</Text>
              {position.stakedInFarm && <Text color="positive">Farming Active</Text>}
            </View>
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
    </Card>
  )
}
