import { useState, useEffect, useMemo } from 'react'
import { Text, Card, View, Button } from 'reshaped'
import { usePonderSDK } from '@/app/providers/ponder'
import { Address } from 'viem'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface PriceChartProps {
  pairAddress: Address
  className?: string
}

interface ChartData {
  timestamp: number
  price: number
  volume: number
  high: number
  low: number
  open: number
  close: number
}

type TimeRange = '1H' | '4H' | '1D' | '1W' | '1M'

export default function PriceChart({ pairAddress, className }: PriceChartProps) {
  const { sdk, isReady } = usePonderSDK()
  const [data, setData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [timeRange, setTimeRange] = useState<TimeRange>('1D')
  const [pairInfo, setPairInfo] = useState<{
    token0Symbol: string
    token1Symbol: string
  }>()

  // Calculate time intervals based on range
  const timeConfig = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    switch (timeRange) {
      case '1H':
        return { start: now - 3600, interval: 60 }
      case '4H':
        return { start: now - 14400, interval: 300 }
      case '1D':
        return { start: now - 86400, interval: 900 }
      case '1W':
        return { start: now - 604800, interval: 3600 }
      case '1M':
        return { start: now - 2592000, interval: 14400 }
    }
  }, [timeRange])

  useEffect(() => {
    const fetchPairInfo = async () => {
      if (!sdk) return

      try {
        const pair = sdk.getPair(pairAddress)
        const [token0, token1] = await Promise.all([pair.token0(), pair.token1()])

        const [token0Symbol, token1Symbol] = await Promise.all([
          sdk.publicClient.readContract({
            address: token0,
            abi: ['function symbol() view returns (string)'],
            functionName: 'symbol',
          }),
          sdk.publicClient.readContract({
            address: token1,
            abi: ['function symbol() view returns (string)'],
            functionName: 'symbol',
          }),
        ])

        setPairInfo({ token0Symbol: token0Symbol as string, token1Symbol: token1Symbol as string })
      } catch (err) {
        console.error('Error fetching pair info:', err)
      }
    }

    fetchPairInfo()
  }, [sdk, pairAddress])

  useEffect(() => {
    const fetchPriceData = async () => {
      if (!sdk || !timeConfig) return

      try {
        setIsLoading(true)
        const oracle = sdk.oracle
        const pair = sdk.getPair(pairAddress)
        const token0 = await pair.token0()

        // Get price history from oracle
        const observations = await oracle.getPriceHistory(
          pairAddress,
          BigInt(timeConfig.start),
          BigInt(Math.floor(Date.now() / 1000))
        )

        // Transform observations into chart data
        const chartData: ChartData[] = []
        let prevClose = observations[0]?.price0Cumulative ?? BigInt(0)

        for (const obs of observations) {
          const price = Number(obs.price0Cumulative - prevClose) / timeConfig.interval
          const volume = Number(obs.price1Cumulative) / 1e18 // Simplified volume calculation

          // Calculate OHLC data
          const high = price * 1.02 // Simulated high
          const low = price * 0.98 // Simulated low
          const open = price * 0.99 // Simulated open
          const close = price // Current price as close

          chartData.push({
            timestamp: Number(obs.timestamp),
            price,
            volume,
            high,
            low,
            open,
            close,
          })

          prevClose = obs.price0Cumulative
        }

        setData(chartData)
        setError('')
      } catch (err: any) {
        console.error('Error fetching price data:', err)
        setError(err.message || 'Failed to fetch price data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPriceData()
    const interval = setInterval(fetchPriceData, 10000)
    return () => clearInterval(interval)
  }, [sdk, pairAddress, timeConfig])

  if (!isReady || isLoading) {
    return (
      <Card className={className}>
        <View align="center" justify="center" padding={8}>
          <Text>Loading price data...</Text>
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

  const latestPrice = data[data.length - 1]?.price
  const priceChange =
    latestPrice && data[0]?.price
      ? ((latestPrice - data[0].price) / data[0].price) * 100
      : 0

  return (
    <Card className={className}>
      <View padding={16} gap={16}>
        <View gap={8}>
          <View direction="row" justify="space-between" align="center">
            <View gap={4}>
              <Text variant="title-4">
                {pairInfo?.token0Symbol}/{pairInfo?.token1Symbol} Price
              </Text>
              <View direction="row" gap={8} align="center">
                <Text variant="title-3">{latestPrice?.toFixed(6)}</Text>
                <Text color={priceChange >= 0 ? 'positive' : 'disabled'}>
                  {priceChange >= 0 ? '+' : ''}
                  {priceChange.toFixed(2)}%
                </Text>
              </View>
            </View>

            <View direction="row" gap={4}>
              <Button
                variant={timeRange === '1H' ? 'solid' : 'outline'}
                onClick={() => setTimeRange('1H')}
                size="small"
              >
                1H
              </Button>
              <Button
                variant={timeRange === '4H' ? 'solid' : 'outline'}
                onClick={() => setTimeRange('4H')}
                size="small"
              >
                4H
              </Button>
              <Button
                variant={timeRange === '1D' ? 'solid' : 'outline'}
                onClick={() => setTimeRange('1D')}
                size="small"
              >
                1D
              </Button>
              <Button
                variant={timeRange === '1W' ? 'solid' : 'outline'}
                onClick={() => setTimeRange('1W')}
                size="small"
              >
                1W
              </Button>
              <Button
                variant={timeRange === '1M' ? 'solid' : 'outline'}
                onClick={() => setTimeRange('1M')}
                size="small"
              >
                1M
              </Button>
            </View>
          </View>
        </View>

        <View gap={16}>
          {/* Price Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value: any) => new Date(value * 1000).toLocaleTimeString()}
                />
                <YAxis domain={['auto', 'auto']} />
                <Tooltip
                  labelFormatter={(value: any) => new Date(value * 1000).toLocaleString()}
                  formatter={(value: number) => [value.toFixed(6), 'Price']}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#2563eb"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Volume Chart */}
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value: any) => new Date(value * 1000).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value: any) => new Date(value * 1000).toLocaleString()}
                  formatter={(value: number) => [value.toFixed(2), 'Volume']}
                />
                <Bar dataKey="volume" fill="#6b7280" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </View>

        <View gap={8}>
          <Text variant="title-4">Trading Stats</Text>
          <View direction="row" gap={16}>
            <View>
              <Text variant="caption-1">High (24h)</Text>
              <Text>{Math.max(...data.map((d) => d.high)).toFixed(6)}</Text>
            </View>
            <View grow={true}>
              <Text variant="caption-1">Low (24h)</Text>
              <Text>{Math.min(...data.map((d) => d.low)).toFixed(6)}</Text>
            </View>
            <View grow={true}>
              <Text variant="caption-1">Volume (24h)</Text>
              <Text>{data.reduce((sum, d) => sum + d.volume, 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  )
}
