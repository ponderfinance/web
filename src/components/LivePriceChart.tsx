'use client'

import React, { useState, useMemo } from 'react'
import { View, Text, Card, Tabs } from 'reshaped'
import { LineChart, BarChart } from '@/src/components/Charts'
import { useLiveChartData } from '@/src/hooks/useLiveChartData'
import LivePriceIndicator from './LivePriceIndicator'

// Define available timeframes
const timeframes = [
  { value: '1h', label: '1H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '1y', label: 'All' },
]

interface ChartDataPoint {
  timestamp: string;
  value: number;
  [key: string]: any;
}

interface LivePriceChartProps {
  priceData: ChartDataPoint[];
  volumeData?: ChartDataPoint[];
  entityId: string;
  title?: string;
  initialTimeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
  height?: number;
  showVolume?: boolean;
}

export default function LivePriceChart({
  priceData,
  volumeData = [],
  entityId,
  title = 'Price',
  initialTimeframe = '1d',
  onTimeframeChange,
  height = 300,
  showVolume = true
}: LivePriceChartProps) {
  // State for selected timeframe
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  
  // Get live data from Redis
  const { 
    chartData: livePriceData, 
    hasNewData, 
    heartbeatTime,
    isLive 
  } = useLiveChartData({
    initialData: priceData,
    entityId,
    valueField: 'value',
    timeField: 'timestamp'
  });
  
  // Change timeframe handler
  const handleTimeframeChange = (args: { value: string }) => {
    setTimeframe(args.value);
    if (onTimeframeChange) {
      onTimeframeChange(args.value);
    }
  };
  
  // Format data for charts
  const formattedPriceData = useMemo(() => {
    return livePriceData.map(point => ({
      x: new Date(point.timestamp),
      y: point.value
    }));
  }, [livePriceData]);
  
  const formattedVolumeData = useMemo(() => {
    return volumeData.map(point => ({
      x: new Date(point.timestamp),
      y: point.value
    }));
  }, [volumeData]);
  
  // Calculate price change
  const priceChange = useMemo(() => {
    if (livePriceData.length < 2) return 0;
    
    const firstPrice = livePriceData[0].value;
    const lastPrice = livePriceData[livePriceData.length - 1].value;
    
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }, [livePriceData]);
  
  // Determine color based on price change
  const changeColor = priceChange >= 0 ? 'positive' : 'critical';
  
  return (
    <Card>
      <View padding={4} direction="column" gap={4}>
        <View direction="row" justify="space-between" align="center">
          <View direction="row" align="center" gap={2}>
            <Text variant="title-3">{title}</Text>
            
            {/* Live indicator */}
            {isLive && (
              <View direction="row" align="center" gap={1}>
                <LivePriceIndicator 
                  isActive={true} 
                  pulseTrigger={heartbeatTime} 
                  color="#4caf50"
                />
                <Text color="positive" variant="body-2">LIVE</Text>
              </View>
            )}
          </View>
          
          <View direction="row" align="center" gap={2}>
            <Text
              variant="title-3"
              color={changeColor}
            >
              {priceChange.toFixed(2)}%
            </Text>
            
            <Tabs
              value={timeframe}
              onChange={handleTimeframeChange}
              items={timeframes}
            />
          </View>
        </View>
        
        {/* Price chart */}
        <View height={height}>
          <LineChart 
            data={formattedPriceData} 
            color={changeColor === 'positive' ? '#4caf50' : '#f44336'}
          />
        </View>
        
        {/* Volume chart */}
        {showVolume && volumeData.length > 0 && (
          <View height={height / 3}>
            <BarChart 
              data={formattedVolumeData} 
              color="#8884d8"
            />
          </View>
        )}
      </View>
    </Card>
  );
} 