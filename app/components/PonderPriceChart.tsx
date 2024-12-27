import React, { useEffect, useRef, useState } from 'react'
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  ChartOptions,
  LineData,
  HistogramData,
  Time,
} from 'lightweight-charts'
import { type Address } from 'viem'
import {
  usePairInfo,
  usePriceHistory,
  usePriceInfo,
  useOracleStatus,
} from '@ponderfinance/sdk'
import { DeepPartial } from 'react-hook-form'

interface PriceChartProps {
  pairAddress: Address
  tokenIn: Address
  className?: string
  theme?: 'dark' | 'light'
}

const PonderPriceChart = ({
  pairAddress,
  tokenIn,
  className = '',
  theme = 'dark',
}: PriceChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [period, setPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const chartRef = useRef<IChartApi>()
  const areaSeriesRef = useRef<ISeriesApi<'Area'>>()
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'>>()
  console.log('OR', pairAddress)


  // Get pair info
  const { data: pairInfo } = usePairInfo(pairAddress)

  // Get price history data
  const { data: priceHistory, isLoading: historyLoading } = usePriceHistory({
    pairAddress,
    tokenIn,
    period,
    refetchInterval: 30000, // Refresh every 30s
  })

  // Get current price info
  const { data: priceInfo } = usePriceInfo(pairAddress, tokenIn)

  // Monitor oracle status
  const { data: oracleStatus } = useOracleStatus(pairAddress)


  useEffect(() => {
    if (!chartContainerRef.current || !priceHistory?.points.length) return

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: {
          type: ColorType.Solid,
          color: theme === 'dark' ? '#1B1B1B' : '#ffffff',
        },
        textColor: theme === 'dark' ? '#d1d4dc' : '#000000',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0)' },
        horzLines: { color: 'rgba(42, 46, 57, 0)' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        autoScale: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          width: 1,
          color: '#C3BCDB44',
          style: 0,
          visible: true,
          labelVisible: true,
        },
        horzLine: {
          visible: true,
          labelVisible: true,
        },
      },
    }

    // Create chart
    if (!chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        ...chartOptions,
        width: chartContainerRef.current.clientWidth,
        height: 400,
      })

      // Create area series
      areaSeriesRef.current = chartRef.current.addAreaSeries({
        lineColor: '#5973FE',
        topColor: '#5973FE66',
        bottomColor: 'rgba(89, 115, 254, 0.04)',
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 6,
          minMove: 0.000001,
        },
      })

      // Create volume series if needed
      if (priceHistory.points.some((p) => p.volume > BigInt(0))) {
        volumeSeriesRef.current = chartRef.current.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
        })
      }
    }

    // Update data
    if (areaSeriesRef.current) {
      // Convert to LineData and ensure unique timestamps
      const priceDataMap = new Map<number, number>();
      priceHistory.points.forEach((point) => {
        priceDataMap.set(point.timestamp, point.price);
      });

      const priceData: LineData[] = Array.from(priceDataMap.entries())
          .map(([timestamp, price]) => ({
            time: timestamp as Time,
            value: price,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

      areaSeriesRef.current.setData(priceData);
    }


    if (volumeSeriesRef.current) {
      const volumeDataMap = new Map<number, { volume: number; price: number }>();
      priceHistory.points.forEach((point) => {
        volumeDataMap.set(point.timestamp, {
          volume: Number(point.volume),
          price: point.price,
        });
      });

      const volumeData: HistogramData[] = Array.from(volumeDataMap.entries())
          .map(([timestamp, { volume, price }]) => ({
            time: timestamp as Time,
            value: volume,
            color: price > priceHistory.averagePrice ? '#26a69a' : '#ef5350',
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

      volumeSeriesRef.current.setData(volumeData);
    }

    // Fit content
    chartRef.current?.timeScale().fitContent()

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = undefined
        areaSeriesRef.current = undefined
        volumeSeriesRef.current = undefined
      }
    }
  }, [theme, priceHistory])

  // Format percentage change
  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)}%`
  }

  // Format price based on token decimals
  const formatPrice = (price: number) => {
    if (price < 0.0001) return price.toExponential(4)
    if (price < 1) return price.toPrecision(4)
    return price.toFixed(2)
  }

  const periodLabels = {
    '1h': '1H',
    '24h': '1D',
    '7d': '1W',
    '30d': '1M',
  }

  if (!pairInfo) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="text-gray-500">Invalid pair</div>
      </div>
    )
  }

  if (historyLoading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="text-gray-500">Loading price data...</div>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        {priceInfo && (
          <>
            <div className="text-2xl font-bold">${formatPrice(priceInfo.current)}</div>
            <div
              className={priceInfo.change24h >= 0 ? 'text-emerald-500' : 'text-red-500'}
            >
              {formatChange(priceInfo.change24h)}
            </div>
          </>
        )}
        {oracleStatus?.needsUpdate && (
          <div className="text-amber-500 text-sm ml-auto">Oracle update needed</div>
        )}
      </div>

      <div ref={chartContainerRef} className="w-full h-96" />

      <div className="flex gap-2 mt-4">
        {(Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((key) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              period === key ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {periodLabels[key]}
          </button>
        ))}
      </div>
    </div>
  )
}

export default PonderPriceChart
