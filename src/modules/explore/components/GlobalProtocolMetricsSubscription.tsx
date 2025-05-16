'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  
  // Track refresh state
  const lastRefreshRef = useRef<number>(0);
  const refreshingRef = useRef<boolean>(false);
  
  // Refresh function with throttling built-in
  const refreshData = useCallback(() => {
    const now = Date.now();
    // Skip if already refreshing or refreshed recently (balanced 5 second throttle)
    if (refreshingRef.current || now - lastRefreshRef.current < 5000) {
      return;
    }
    
    // Mark as refreshing
    refreshingRef.current = true;
    lastRefreshRef.current = now;
    
    // Always use store-and-network to prevent skeleton loading states
    // This shows cached data immediately while fetching fresh data in background
    loadQuery({}, { fetchPolicy: 'store-and-network' });
    
    // Reset refreshing state after a short delay
    setTimeout(() => {
      refreshingRef.current = false;
    }, 1000);
  }, [loadQuery]);
  
  // Single useEffect to handle both initial load and subsequent updates
  useEffect(() => {
    // Initial load
    if (!queryRef) {
      loadQuery({}, { fetchPolicy: 'store-or-network' });
    }
    
    // Set up Redis update handler
    const handleMetricsUpdate = () => {
      if (metricsLastUpdated) {
        console.log('Protocol metrics updated via Redis:', new Date(metricsLastUpdated).toLocaleTimeString());
        refreshData();
      }
    };
    
    // Set up periodic refresh as fallback (very infrequent)
    const intervalId = setInterval(refreshData, 180000); // 3 minutes
    
    // Watch for changes to metricsLastUpdated
    if (metricsLastUpdated) {
      handleMetricsUpdate();
    }
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, [queryRef, loadQuery, metricsLastUpdated, refreshData]);
  
  // Render the metrics component with the query reference
  return queryRef ? (
    <GlobalProtocolMetrics queryRef={queryRef} />
  ) : (
    <div>Loading protocol metrics...</div>
  );
} 