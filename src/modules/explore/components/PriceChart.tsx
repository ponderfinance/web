'use client'

import React, { useEffect, useRef } from 'react'
import { View, Text } from 'reshaped'

import {
  createChart,
  ColorType,
  IChartApi,
  LineData,
  AreaData,
  HistogramData,
  MouseEventParams,
  UTCTimestamp,
  PriceFormat,
} from 'lightweight-charts'
import { formatCurrency } from '@/src/lib/utils/tokenPriceUtils'

interface ChartDataPoint {
  time: number
  value: number
}

interface PriceChartProps {
  data: ChartDataPoint[]
  type: 'line' | 'area' | 'candle' | 'volume'
  title?: string
  height?: number
  autoSize?: boolean
  yAxisLabel?: string
  formatTooltip?: (value: number) => string
  brandColor?: string
}

export default function PriceChart({
  data,
  type = 'area',
  title,
  height = 400,
  autoSize = true,
  yAxisLabel = 'Price',
  formatTooltip = (value: number) => formatCurrency(value),
  brandColor = '#94e0fe', // Default brand color
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Clean up any existing chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    // Cleanup any existing tooltip
    if (tooltipRef.current && chartContainerRef.current.contains(tooltipRef.current)) {
      chartContainerRef.current.removeChild(tooltipRef.current)
      tooltipRef.current = null
    }

    // Skip rendering if no valid data
    if (data.length === 0) {
      return
    }

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current && autoSize) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    // Filter and sort data to ensure unique timestamps and ascending order
    const uniqueDataMap = new Map<number, number>()

    // Add each data point to the map, using time as key
    // If there are duplicate timestamps, the last one wins
    data.forEach((point) => {
      if (!isNaN(point.value)) {
        uniqueDataMap.set(point.time, point.value)
      }
    })

    // Convert back to array and sort by time
    const cleanedData = Array.from(uniqueDataMap.entries())
      .map(([time, value]) => ({ time, value }))
      .sort((a, b) => a.time - b.time)

    // Skip rendering if no valid data after cleaning
    if (cleanedData.length === 0) {
      return
    }

    // Determine optimal price formatting based on data range
    const values = cleanedData.map((item) => item.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)

    // Create a custom price format based on the data range
    let priceFormat: PriceFormat = {
      type: 'custom' as const,
      minMove: 0.00000001, // Allow much smaller price movements for tiny values
      formatter: (price: number) => {
        if (price < 0.0001) {
          return '$' + price.toFixed(10); // Use fixed notation for very small values
        } else if (price < 0.001) {
          return '$' + price.toFixed(8);
        } else if (price < 0.01) {
          return '$' + price.toFixed(6);
        } else if (price < 0.1) {
          return '$' + price.toFixed(4);
        } else if (price < 1) {
          return '$' + price.toFixed(3);
        } else {
          return '$' + price.toFixed(2);
        }
      },
    }

    // Create chart with dark theme styling to match the screenshot
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1e1e1e', type: ColorType.Solid },
        textColor: '#999999',
        fontSize: 12,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      watermark: {
        visible: false
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      grid: {
        vertLines: { color: 'var(--rs-color-foreground-neutral-faded)', visible: false, style: 4 }, // Dotted style
        horzLines: { color: 'var(--rs-color-foreground-neutral-faded)', visible: false, style: 4 }, // Dotted style
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e1e1e',
      },
      rightPriceScale: {
        borderColor: '#1e1e1e',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        visible: true,
        textColor: '#999999',
        entireTextOnly: false,
        borderVisible: false,
        autoScale: true,
        mode: 2, // Use mode 2 for better small value display
        alignLabels: true,
      },
      crosshair: {
        horzLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          labelBackgroundColor: '#333333',
        },
        vertLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          labelBackgroundColor: '#1e1e1e',
        },
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    })

    chartRef.current = chart

    // Format data for chart based on type
    const formattedData = cleanedData.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
    }))

    // Calculate color variants for area gradient
    const getAlphaColor = (baseColor: string, alpha: number) => {
      const r = parseInt(baseColor.slice(1, 3), 16)
      const g = parseInt(baseColor.slice(3, 5), 16)
      const b = parseInt(baseColor.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    // Add the appropriate series based on chart type
    let series
    if (type === 'line') {
      series = chart.addLineSeries({
        color: brandColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        lastValueVisible: true,
        priceLineVisible: false, // Remove price line to match screenshot
        priceFormat: priceFormat,
        lineType: 0, // Solid line
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: minValue * 0.95,
            maxValue: maxValue * 1.05,
          },
        }),
      })
      series.setData(formattedData as LineData<UTCTimestamp>[])
    } else if (type === 'volume') {
      series = chart.addHistogramSeries({
        color: brandColor,
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      })
      series.setData(formattedData as HistogramData<UTCTimestamp>[])
    } else {
      // Default to area
      series = chart.addAreaSeries({
        lineColor: brandColor,
        topColor: getAlphaColor(brandColor, 0.4),
        bottomColor: getAlphaColor(brandColor, 0.05),
        lineWidth: 2,
        crosshairMarkerVisible: true,
        lastValueVisible: false, // Hide last value to match screenshot
        priceLineVisible: false, // Hide price line to match screenshot
        priceFormat: priceFormat,
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: minValue * 0.95,
            maxValue: maxValue * 1.05,
          },
        }),
      })
      series.setData(formattedData as AreaData<UTCTimestamp>[])
    }

    // If we have enough data points, auto-fit the time scale
    if (formattedData.length > 1) {
      chart.timeScale().fitContent()
    }

    // Ensure the price axis is properly scaled 
    chart.priceScale('right').applyOptions({
      autoScale: true,
      entireTextOnly: false,
      mode: 0, 
      invertScale: false,
      ticksVisible: true,
    });

    // Setup custom tooltip
    const tooltipElement = document.createElement('div')
    tooltipElement.style.position = 'absolute'
    tooltipElement.style.display = 'none'
    tooltipElement.style.padding = '6px 8px'
    tooltipElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
    tooltipElement.style.color = 'white'
    tooltipElement.style.borderRadius = '4px'
    tooltipElement.style.fontSize = '12px'
    tooltipElement.style.pointerEvents = 'none'
    tooltipElement.style.zIndex = '1000'
    tooltipElement.style.fontFamily =
      'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    chartContainerRef.current.appendChild(tooltipElement)
    tooltipRef.current = tooltipElement

    // Subscribe to crosshair move
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0 ||
        !tooltipElement
      ) {
        tooltipElement.style.display = 'none'
        return
      }

      // Get the price at the crosshair position from the correct series
      const seriesData = param.seriesData.get(series)
      let price: number | undefined

      if (seriesData) {
        if ('value' in seriesData) {
          price = seriesData.value as number
        } else if ('close' in seriesData) {
          // For candlestick/bar data
          price = seriesData.close as number
        }
      }

      if (price !== undefined) {
        // Format price and display tooltip
        tooltipElement.innerHTML = formatTooltip(price)
        tooltipElement.style.display = 'block'

        // Position the tooltip
        const coordinate = series.priceToCoordinate(price)
        if (coordinate !== null) {
          tooltipElement.style.left = `${param.point.x + 10}px`
          tooltipElement.style.top = `${coordinate - 35}px`
        }
      } else {
        tooltipElement.style.display = 'none'
      }
    })

    // Listen for window resize to update chart width
    window.addEventListener('resize', handleResize)

    // Clean up on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [data, type, height, autoSize, formatTooltip, brandColor])

  return (
    <View direction="column" gap={0}>
      <div
        ref={chartContainerRef}
        style={{
          height: `${height}px`,
          backgroundColor: 'transparent',
          borderRadius: '8px',
        }}
      />
    </View>
  )
}
