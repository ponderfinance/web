'use client'

import React, { useEffect, useRef } from 'react';
import { useQueryLoader } from 'react-relay';
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql';
import GlobalProtocolMetrics, { globalProtocolMetricsQuery } from './GlobalProtocolMetrics';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';

export default function GlobalProtocolMetricsWithSubscription() {
  // Get query reference for Relay
  const [queryRef, loadQuery] = useQueryLoader<GlobalProtocolMetricsQuery>(
    globalProtocolMetricsQuery
  );
  
  // Use Redis subscriber for real-time updates
  const { metricsLastUpdated } = useRedisSubscriber();
  
  // Track the last refresh time to prevent too frequent updates
  const lastRefreshTimeRef = useRef<number>(0);
  
  // Load the initial data
  useEffect(() => {
    loadQuery({}, { fetchPolicy: 'network-only' });
  }, [loadQuery]);
  
  // Set up listener for Redis metrics updates
  useEffect(() => {
    if (metricsLastUpdated) {
      const now = Date.now();
      // Throttle refreshes to at most once per second
      if (now - lastRefreshTimeRef.current > 1000) {
        console.log('Protocol metrics updated via Redis at:', new Date(metricsLastUpdated).toISOString());
        loadQuery({}, { fetchPolicy: 'network-only' });
        lastRefreshTimeRef.current = now;
      }
    }
  }, [metricsLastUpdated, loadQuery]);
  
  // Set up periodic refresh as fallback
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadQuery({}, { fetchPolicy: 'network-only' });
    }, 30000); // Refresh every 30 seconds as fallback
    
    return () => clearInterval(intervalId);
  }, [loadQuery]);

  // Render the metrics component with the query reference
  return queryRef ? (
    <GlobalProtocolMetrics queryRef={queryRef} />
  ) : (
    <div>Loading protocol metrics...</div>
  );
} 