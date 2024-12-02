import { useState, useEffect } from 'react'
import { Text, Card, View } from 'reshaped'
import { usePonderSDK } from '@/app/providers/ponder'
import { useAccount } from 'wagmi'
import { Address, formatUnits } from 'viem'
import { erc20Abi } from 'viem'

interface PairStatsCardProps {
  pairAddress: Address
  className?: string
}

interface PairStats {
  token0Symbol: string
  token1Symbol: string
  token0Decimals: number
  token1Decimals: number
  reserve0: bigint
  reserve1: bigint
  totalSupply: bigint
  volume24h: bigint
  fees24h: bigint
  tvlUSD: string
  price0: string
  price1: string
  userLPBalance?: bigint
  userShare?: string
}

export default function PairStatsCard({ pairAddress, className }: PairStatsCardProps) {
  const { sdk, isReady } = usePonderSDK()
  const account = useAccount()
  const [stats, setStats] = useState<PairStats>()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPairStats = async () => {
      if (!sdk) return

      try {
        setIsLoading(true)
        const pair = sdk.getPair(pairAddress)
        const oracle = sdk.oracle

        // Get basic pair info
        const [token0, token1, reserves, totalSupply] = await Promise.all([
          pair.token0(),
          pair.token1(),
          pair.getReserves(),
          pair.totalSupply(),
        ])

        // Get token details
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

        // Get price data from oracle
        const [priceData0, priceData1] = await Promise.all([
          oracle.getAveragePrice(pairAddress, token0, BigInt(10 ** token0Decimals), 3600),
          oracle.getAveragePrice(pairAddress, token1, BigInt(10 ** token1Decimals), 3600),
        ])

        // Calculate additional stats
        const priceChange = await oracle.getPriceChange(pairAddress, token0)

        // Get user LP balance if connected
        let userLPBalance: bigint | undefined
        let userShare: string | undefined

        if (account.address) {
          userLPBalance = await pair.balanceOf(account.address)
          if (userLPBalance > BigInt(0)) {
            userShare = ((Number(userLPBalance) / Number(totalSupply)) * 100).toFixed(2)
          }
        }

        setStats({
          token0Symbol,
          token1Symbol,
          token0Decimals,
          token1Decimals,
          reserve0: reserves.reserve0,
          reserve1: reserves.reserve1,
          totalSupply,
          volume24h: BigInt(0), // Would need indexer data
          fees24h: BigInt(0), // Would need indexer data
          tvlUSD: '0', // Would need price oracle/indexer data
          price0: priceData0.pricePerToken.toString(),
          price1: priceData1.pricePerToken.toString(),
          userLPBalance,
          userShare,
        })
      } catch (err: any) {
        console.error('Error fetching pair stats:', err)
        setError(err.message || 'Failed to fetch pair statistics')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPairStats()
    const interval = setInterval(fetchPairStats, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [sdk, pairAddress, account.address])

  if (!isReady || isLoading) {
    return (
      <Card className={className}>
        <View align="center" justify="center" padding={8}>
          <Text>Loading pair statistics...</Text>
        </View>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <View align="center" justify="center" padding={8}>
          <Text>{error}</Text>
        </View>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card className={className}>
        <View align="center" justify="center" padding={8}>
          <Text>No data available</Text>
        </View>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <View gap={12} padding={16}>
        <View gap={4}>
          <Text variant="title-3">
            {stats.token0Symbol}/{stats.token1Symbol} Pair
          </Text>
          <Text>Pair: {pairAddress}</Text>
        </View>

        <View gap={8}>
          <View direction="row">
            <Text>Price:</Text>
            <View gap={2} align="end">
              <Text>
                1 {stats.token0Symbol} = {stats.price1} {stats.token1Symbol}
              </Text>
              <Text>
                1 {stats.token1Symbol} = {stats.price0} {stats.token0Symbol}
              </Text>
            </View>
          </View>

          <View direction="row">
            <Text>Liquidity:</Text>
            <View gap={2} align="end">
              <Text>
                {formatUnits(stats.reserve0, stats.token0Decimals)} {stats.token0Symbol}
              </Text>
              <Text>
                {formatUnits(stats.reserve1, stats.token1Decimals)} {stats.token1Symbol}
              </Text>
            </View>
          </View>

          <View direction="row">
            <Text>Total Supply:</Text>
            <Text>{formatUnits(stats.totalSupply, 18)} LP</Text>
          </View>

          {stats.userLPBalance && stats.userShare && (
            <View direction="row">
              <Text>Your Position:</Text>
              <View gap={2} align="end">
                <Text>{formatUnits(stats.userLPBalance, 18)} LP</Text>
                <Text>{stats.userShare}% of pool</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Card>
  )
}
