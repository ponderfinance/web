import { useState, useEffect } from 'react'
import { Text, Card, View, Button } from 'reshaped'
import { usePonderSDK } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import { Address, formatUnits, formatEther } from 'viem'
import { erc20Abi } from 'viem'

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
}

export default function LiquidityPositionsList() {
  const sdk = usePonderSDK()
  const account = useAccount()
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const fetchPositions = async () => {
      if (!sdk || !account.address) return

      try {
        setIsLoading(true)
        setError('')

        // Get all pairs from factory
        const allPairs = await sdk.factory.getAllPairs()
        const positions: Position[] = []

        // Get farming pool info to check for staked positions
        const poolLength = await sdk.masterChef.poolLength()
        const farmPools = new Set<string>()

        for (let i = 0; i < Number(poolLength); i++) {
          const pool = await sdk.masterChef.poolInfo(BigInt(i))
          farmPools.add(pool.lpToken.toLowerCase())
        }

        // Check each pair for user's position
        for (const pairAddress of allPairs) {
          const pair = sdk.getPair(pairAddress)
          const lpBalance = await pair.balanceOf(account.address)

          // If user has no balance in this pair, skip
          if (lpBalance === BigInt(0)) continue

          // Get pair details
          const [token0, token1, reserves, totalSupply] = await Promise.all([
            pair.token0(),
            pair.token1(),
            pair.getReserves(),
            pair.totalSupply(),
          ])

          // Get token info
          const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] =
            await Promise.all([
              sdk.publicClient.readContract({
                address: token0,
                abi: erc20Abi,
                functionName: 'symbol',
              }),
              sdk.publicClient.readContract({
                address: token1,
                abi: erc20Abi,
                functionName: 'symbol',
              }),
              sdk.publicClient.readContract({
                address: token0,
                abi: erc20Abi,
                functionName: 'decimals',
              }),
              sdk.publicClient.readContract({
                address: token1,
                abi: erc20Abi,
                functionName: 'decimals',
              }),
            ])

          // Calculate share of the pool
          const poolShare = ((Number(lpBalance) / Number(totalSupply)) * 100).toFixed(2)

          // Calculate token amounts based on share
          const token0Amount = formatUnits(
            (lpBalance * reserves.reserve0) / totalSupply,
            token0Decimals
          )
          const token1Amount = formatUnits(
            (lpBalance * reserves.reserve1) / totalSupply,
            token1Decimals
          )

          positions.push({
            pairAddress,
            token0: {
              address: token0,
              symbol: token0Symbol,
              decimals: token0Decimals,
            },
            token1: {
              address: token1,
              symbol: token1Symbol,
              decimals: token1Decimals,
            },
            userLPBalance: lpBalance,
            totalSupply,
            reserve0: reserves.reserve0,
            reserve1: reserves.reserve1,
            poolShare,
            token0Amount,
            token1Amount,
            stakedInFarm: farmPools.has(pairAddress.toLowerCase()),
          })
        }

        setPositions(positions)
      } catch (err: any) {
        console.error('Error fetching positions:', err)
        setError(err.message || 'Failed to fetch liquidity positions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPositions()
    const interval = setInterval(fetchPositions, 1000000000)
    return () => clearInterval(interval)
  }, [sdk, account.address])

  if (!account.address) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Connect wallet to view your liquidity positions</Text>
        </View>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Loading your positions...</Text>
        </View>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>{error}</Text>
        </View>
      </Card>
    )
  }

  if (positions.length === 0) {
    return (
      <Card>
        <View align="center" justify="center" gap={8} padding={16}>
          <Text>You have no liquidity positions</Text>
          <Button href="/add">Add Liquidity</Button>
        </View>
      </Card>
    )
  }

  return (
    <View gap={16} paddingInline={16}>
      <View gap={8}>
        <Text variant="featured-2">Your Positions</Text>
        <Text>View and manage your liquidity across all pairs</Text>
      </View>

      {positions.map((position) => (
        <Card key={position.pairAddress}>
          <View padding={16} gap={12}>
            <View gap={4}>
              <Text variant="title-4">
                {position.token0.symbol}/{position.token1.symbol}
              </Text>
              <Text>Pair: {position.pairAddress}</Text>
            </View>

            <View gap={8}>
              <View direction="row">
                <Text>Your Pool Share:</Text>
                <Text>{position.poolShare}%</Text>
              </View>

              <View direction="row">
                <Text>Your Position:</Text>
                <View gap={2} align="end">
                  <Text>
                    {position.token0Amount} {position.token0.symbol}
                  </Text>
                  <Text>
                    {position.token1Amount} {position.token1.symbol}
                  </Text>
                </View>
              </View>

              <View direction="row">
                <Text>LP Tokens:</Text>
                <View gap={2} align="end">
                  <Text>{formatEther(position.userLPBalance)}</Text>
                  {position.stakedInFarm && <Text color="positive">Farming Active</Text>}
                </View>
              </View>

              <View direction="row" gap={8}>
                <Button href={`/remove?pair=${position.pairAddress}`}>Remove</Button>
                <Button href={`/add?pair=${position.pairAddress}`}>Add</Button>
                {position.stakedInFarm ? (
                  <Button href="/farm">View Farm</Button>
                ) : (
                  <Button href={`/farm?pair=${position.pairAddress}`}>
                    Start Farming
                  </Button>
                )}
              </View>
            </View>
          </View>
        </Card>
      ))}
    </View>
  )
}
