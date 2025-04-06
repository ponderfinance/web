import React, { useEffect, useRef } from 'react'
import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
  PriceFormat,
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
  formatTooltip?: (value: number) => string
  yAxisLabel?: string
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
  formatTooltip,
  yAxisLabel = '',
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<
    ISeriesApi<'Area'> | ISeriesApi<'Line'> | ISeriesApi<'Histogram'> | null
  >(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

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

    // Determine the best price format based on data values
    const values = data.map(item => item.value).filter(v => !isNaN(v) && v !== 0)
    const minValue = values.length ? Math.min(...values) : 0
    const maxValue = values.length ? Math.max(...values) : 0
    const avgMagnitude = values.length 
      ? values.reduce((sum, val) => sum + Math.log10(Math.abs(val) || 1), 0) / values.length 
      : 0

    // Create price formatter based on value range
    let priceFormatter: (price: number) => string
    
    if (formatTooltip) {
      // Use the provided formatter
      priceFormatter = formatTooltip
    } else {
      // Create default formatter based on data range
      priceFormatter = (price: number) => {
        if (price === 0) return '$0.00'
        
        // Format based on magnitude
        if (Math.abs(price) < 0.0001) {
          return '$' + price.toExponential(4)
        } else if (Math.abs(price) < 0.001) {
          return '$' + price.toFixed(8)
        } else if (Math.abs(price) < 0.01) {
          return '$' + price.toFixed(6)
        } else if (Math.abs(price) < 0.1) {
          return '$' + price.toFixed(4)
        } else if (Math.abs(price) < 1) {
          return '$' + price.toFixed(3)
        } else if (Math.abs(price) < 1000) {
          return '$' + price.toFixed(2)
        } else {
          return '$' + price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        }
      }
    }

    // Create a custom price format for the Y-axis
    const priceFormat: PriceFormat = {
      type: 'custom',
      minMove: minValue < 0.001 ? 0.00000001 : 0.01,
      formatter: priceFormatter
    }

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
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
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
          priceFormat: priceFormat,
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
          priceFormat: priceFormat,
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

    // Create custom tooltip
    if (!tooltipRef.current && chartContainerRef.current) {
      const tooltip = document.createElement('div')
      tooltip.style.position = 'absolute'
      tooltip.style.display = 'none'
      tooltip.style.padding = '8px'
      tooltip.style.backgroundColor = 'rgba(21, 25, 36, 0.7)'
      tooltip.style.color = 'white'
      tooltip.style.borderRadius = '4px'
      tooltip.style.fontSize = '12px'
      tooltip.style.pointerEvents = 'none'
      tooltip.style.zIndex = '3'
      chartContainerRef.current.appendChild(tooltip)
      tooltipRef.current = tooltip
      
      // Subscribe to crosshair move to update tooltip
      chart.subscribeCrosshairMove((param) => {
        if (
          !param.point || 
          !param.time || 
          param.point.x < 0 || 
          param.point.y < 0
        ) {
          tooltip.style.display = 'none'
          return
        }
        
        const data = param.seriesData.get(series)
        if (!data || !('value' in data)) {
          tooltip.style.display = 'none'
          return
        }
        
        const price = data.value
        tooltip.innerHTML = priceFormatter(price as number)
        tooltip.style.display = 'block'
        tooltip.style.left = `${param.point.x + 15}px`
        tooltip.style.top = `${param.point.y - 30}px`
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
      
      if (tooltipRef.current && chartContainerRef.current) {
        chartContainerRef.current.removeChild(tooltipRef.current)
        tooltipRef.current = null
      }
    }
  }, [data, type, title, height, width, colors, autoSize, loading, defaultColors, formatTooltip, yAxisLabel])

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
