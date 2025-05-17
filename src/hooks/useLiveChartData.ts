'use client'

import { useEffect, useState, useMemo } from 'react';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';

interface PriceDataPoint {
  timestamp: string | Date;
  value: number;
  [key: string]: any;
}

interface UseLiveChartDataProps {
  initialData: PriceDataPoint[];
  entityId: string;
  valueField?: string;
  timeField?: string;
  maxPoints?: number;
}

/**
 * Hook to manage live-updating chart data
 * Combines initial data (from GraphQL) with real-time updates from Redis
 */
export function useLiveChartData({
  initialData = [],
  entityId,
  valueField = 'value',
  timeField = 'timestamp',
  maxPoints = 100
}: UseLiveChartDataProps) {
  // Get access to real-time data from Redis
  const { priceSnapshotUpdates, heartbeatTime } = useRedisSubscriber();
  
  // Track if new data has been received recently
  const [hasNewData, setHasNewData] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  
  // Combine initial data with real-time updates
  const chartData = useMemo(() => {
    const realtimeUpdates = priceSnapshotUpdates[entityId] || [];
    
    if (realtimeUpdates.length === 0) {
      return initialData;
    }
    
    // If we have real-time updates, add them to initial data
    const combined = [
      ...initialData,
      ...realtimeUpdates.filter(update => {
        // Filter out any updates already in the initial data
        return !initialData.some(point => {
          const updateTime = new Date(update[timeField]).getTime();
          const pointTime = new Date(point[timeField]).getTime();
          return Math.abs(updateTime - pointTime) < 1000; // Within 1 second
        });
      })
    ]
    .sort((a, b) => {
      const timeA = new Date(a[timeField]).getTime();
      const timeB = new Date(b[timeField]).getTime();
      return timeA - timeB;
    })
    .slice(-maxPoints); // Keep only the most recent points
    
    return combined;
  }, [initialData, priceSnapshotUpdates, entityId, timeField, maxPoints]);
  
  // Update the "new data" indicator when we receive real-time updates
  useEffect(() => {
    const updates = priceSnapshotUpdates[entityId] || [];
    if (updates.length > 0) {
      setHasNewData(true);
      setLastUpdateTime(Date.now());
      
      // Auto-clear the indicator after 3 seconds
      const timer = setTimeout(() => {
        setHasNewData(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [priceSnapshotUpdates, entityId]);
  
  return {
    chartData,
    hasNewData,
    lastUpdateTime,
    heartbeatTime,
    isLive: Boolean(chartData.length > initialData.length)
  };
}

export default useLiveChartData; 