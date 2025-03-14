import React, { useEffect, useRef } from 'react'
import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
} from 'lightweight-charts'

// Define a more flexible data type to accommodate both readonly and mutable arrays
interface ChartDataPoint {
  time: number
  value: number
  volume0?: number | null
  volume1?: number | null
  count?: number | null
}

// Define prop types
interface PriceChartProps {
  data: ReadonlyArray<ChartDataPoint> | Array<ChartDataPoint>
  type?: 'line' | 'area' | 'candlestick' | 'bar' | 'volume'
  title?: string
  height?: number
  width?: number
  colors?: {
    background?: string
    text?: string
    line?: string
    area?: {
      top?: string
      bottom?: string
    }
    volume?: string
  }
  autoSize?: boolean
  loading?: boolean
}

const PriceChart: React.FC<PriceChartProps> = ({
  data,
  type = 'line',
  title = '',
  height = 400,
  width,
  colors = {},
  autoSize = true,
  loading = false,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<
    ISeriesApi<'Area'> | ISeriesApi<'Line'> | ISeriesApi<'Histogram'> | null
  >(null)

  // Set default colors
  const defaultColors = {
    background: colors.background || '#151924',
    text: colors.text || '#d1d4dc',
    line: colors.line || '#2962FF',
    area: {
      top: colors.area?.top || 'rgba(41, 98, 255, 0.2)',
      bottom: colors.area?.bottom || 'rgba(41, 98, 255, 0.0)',
    },
    volume: colors.volume || '#26a69a',
  }

  useEffect(() => {
    // If loading or no container, don't do anything
    if (loading || !chartContainerRef.current) return

    // Clean up any existing chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = null
    }

    // Calculate container width if autoSize is true
    const containerWidth =
      width ||
      (autoSize && chartContainerRef.current
        ? chartContainerRef.current.clientWidth
        : 600)

    // Create chart with options
    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height,
      layout: {
        background: {
          type: ColorType.Solid,
          color: defaultColors.background,
        },
        textColor: defaultColors.text,
      },
      grid: {
        vertLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: LineStyle.Dotted,
        },
        horzLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: LineStyle.Dotted,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(197, 203, 206, 0.8)',
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.8)',
      },
      crosshair: {
        mode: 1,
      },
    })

    chartRef.current = chart

    // Add appropriate series based on type
    let series
    switch (type) {
      case 'area':
        series = chart.addAreaSeries({
          topColor: defaultColors.area.top,
          bottomColor: defaultColors.area.bottom,
          lineColor: defaultColors.line,
          lineWidth: 2,
        })
        break
      case 'volume':
        series = chart.addHistogramSeries({
          color: defaultColors.volume,
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
        })
        break
      case 'line':
      default:
        series = chart.addLineSeries({
          color: defaultColors.line,
          lineWidth: 2,
          crosshairMarkerVisible: true,
          lastValueVisible: true,
          priceLineVisible: true,
        })
        break
    }

    seriesRef.current = series

    // Format the data for the chart
    const formattedData = [...data].map((item) => ({
      time: item.time as UTCTimestamp,
      value: item.value,
      // For volume chart, include volume as value
      ...(type === 'volume' && { value: item.volume0 || item.value }),
    }))

    // Set the data on the series
    if (formattedData.length > 0) {
      series.setData(formattedData)
      chart.timeScale().fitContent()
    }

    // Add title if provided
    if (title) {
      chart.applyOptions({
        watermark: {
          visible: true,
          text: title,
          fontSize: 24,
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: 'Roboto, sans-serif',
        },
      })
    }

    // Handle window resize
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current && autoSize) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    // Clean up function
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
      }
    }
  }, [data, type, title, height, width, colors, autoSize, loading, defaultColors])

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && data.length > 0 && !loading) {
      const formattedData = [...data].map((item) => ({
        time: item.time as UTCTimestamp,
        value: item.value,
        // For volume chart, include volume as value
        ...(type === 'volume' && { value: item.volume0 || item.value }),
      }))

      seriesRef.current.setData(formattedData)

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent()
      }
    }
  }, [data, type, loading])

  return (
    <div className="price-chart-container" style={{ position: 'relative' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(21, 25, 36, 0.7)',
            zIndex: 1,
          }}
        >
          <span>Loading...</span>
        </div>
      )}
      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: height || 400,
        }}
      />
    </div>
  )
}

export default PriceChart
