import { useState, useEffect } from 'react'
import { Text, Card, View, Button } from 'reshaped'
import { usePonderSDK } from '@ponderfinance/sdk'
import { Address, formatUnits, formatEther } from 'viem'
import { erc20Abi } from 'viem'

interface PairStats {
  address: Address
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
  reserve0: bigint
  reserve1: bigint
  totalSupply: bigint
  price0: string
  price1: string
  volume24h: string
  fee24h: string
  priceChange24h: number
  tvlUSD: string
  liquidityChange24h: number
}

export default function MultiPairStatsView() {
  const sdk = usePonderSDK()
  const [pairs, setPairs] = useState<PairStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [sortField, setSortField] = useState<'volume' | 'tvl' | 'fees'>('volume')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const fetchPairStats = async () => {
      if (!sdk) return

      try {
        setIsLoading(true)
        const allPairs = await sdk.factory.getAllPairs()
        const oracle = sdk.oracle
        const pairStats: PairStats[] = []

        for (const pairAddress of allPairs) {
          const pair = sdk.getPair(pairAddress)

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
            oracle.getAveragePrice(
              pairAddress,
              token0,
              BigInt(10 ** token0Decimals),
              3600
            ),
            oracle.getAveragePrice(
              pairAddress,
              token1,
              BigInt(10 ** token1Decimals),
              3600
            ),
          ])

          // Get 24h price change
          const priceChange = await oracle.getPriceChange(pairAddress, token0)

          // For MVP, we'll estimate volume based on price impact of recent trades
          // In production, you'd want to use an indexer to track actual volume
          const estimatedVolume = formatEther(
            (reserves.reserve0 * priceData0.amountOut) / BigInt(100)
          )
          const estimatedFees = formatEther(
            (reserves.reserve0 * priceData0.amountOut) / BigInt(333)
          ) // 0.3% fee

          pairStats.push({
            address: pairAddress,
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
            reserve0: reserves.reserve0,
            reserve1: reserves.reserve1,
            totalSupply,
            price0: priceData0.pricePerToken.toString(),
            price1: priceData1.pricePerToken.toString(),
            volume24h: estimatedVolume,
            fee24h: estimatedFees,
            priceChange24h: priceChange.percentageChange,
            tvlUSD: estimatedVolume, // Simplified TVL calculation
            liquidityChange24h: 0, // Would need historical data
          })
        }

        // Sort pairs
        const sortedPairs = [...pairStats].sort((a, b) => {
          const aValue = parseFloat(
            sortField === 'volume'
              ? a.volume24h
              : sortField === 'tvl'
                ? a.tvlUSD
                : a.fee24h
          )
          const bValue = parseFloat(
            sortField === 'volume'
              ? b.volume24h
              : sortField === 'tvl'
                ? b.tvlUSD
                : b.fee24h
          )
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue
        })

        setPairs(sortedPairs)
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
  }, [sdk, sortField, sortDirection])

  const handleSort = (field: 'volume' | 'tvl' | 'fees') => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  if ( isLoading) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Loading pair statistics...</Text>
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

  return (
    <View gap={16}>
      <View gap={8}>
        <Text variant="title-3">Trading Pairs</Text>
        <Text>Overview of all trading pairs and their performance</Text>
      </View>

      <View direction="row" gap={8}>
        <Button
          variant={sortField === 'volume' ? 'solid' : 'outline'}
          onClick={() => handleSort('volume')}
        >
          Sort by Volume{' '}
          {sortField === 'volume' && (sortDirection === 'desc' ? '↓' : '↑')}
        </Button>
        <Button
          variant={sortField === 'tvl' ? 'solid' : 'outline'}
          onClick={() => handleSort('tvl')}
        >
          Sort by TVL {sortField === 'tvl' && (sortDirection === 'desc' ? '↓' : '↑')}
        </Button>
        <Button
          variant={sortField === 'fees' ? 'solid' : 'outline'}
          onClick={() => handleSort('fees')}
        >
          Sort by Fees {sortField === 'fees' && (sortDirection === 'desc' ? '↓' : '↑')}
        </Button>
      </View>

      {pairs.map((pair) => (
        <Card key={pair.address}>
          <View padding={16} gap={12}>
            <View gap={4}>
              <Text variant="title-4">
                {pair.token0.symbol}/{pair.token1.symbol}
              </Text>
              <Text>Pair: {pair.address}</Text>
            </View>

            <View gap={8}>
              <View direction="row">
                <Text>Price:</Text>
                <View gap={2} align="end">
                  <Text>
                    1 {pair.token0.symbol} = {pair.price1} {pair.token1.symbol}
                  </Text>
                  <Text color={pair.priceChange24h >= 0 ? 'positive' : 'disabled'}>
                    {pair.priceChange24h >= 0 ? '+' : ''}
                    {pair.priceChange24h.toFixed(2)}%
                  </Text>
                </View>
              </View>

              <View direction="row">
                <Text>Liquidity:</Text>
                <View gap={2} align="end">
                  <Text>
                    {formatUnits(pair.reserve0, pair.token0.decimals)}{' '}
                    {pair.token0.symbol}
                  </Text>
                  <Text>
                    {formatUnits(pair.reserve1, pair.token1.decimals)}{' '}
                    {pair.token1.symbol}
                  </Text>
                </View>
              </View>

              <View direction="row" justify="space-between">
                <Text>Volume (24h):</Text>
                <Text>{pair.volume24h} KUB</Text>
              </View>

              <View direction="row" justify="space-between">
                <Text>Fees (24h):</Text>
                <Text>{pair.fee24h} KUB</Text>
              </View>

              <View direction="row" justify="space-between">
                <Text>TVL:</Text>
                <Text>{pair.tvlUSD} KUB</Text>
              </View>

              <View direction="row" gap={8}>
                <Button
                  variant="outline"
                  href={`/swap?inputToken=${pair.token0.address}&outputToken=${pair.token1.address}`}
                >
                  Trade
                </Button>
                <Button variant="outline" href={`/add?pair=${pair.address}`}>
                  Add Liquidity
                </Button>
                <Button variant="outline" href={`/info/${pair.address}`}>
                  Analytics
                </Button>
              </View>
            </View>
          </View>
        </Card>
      ))}
    </View>
  )
}
