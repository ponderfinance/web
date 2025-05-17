'use client'

import React, { useEffect } from 'react';
import { useQueryLoader } from 'react-relay';
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql';
import GlobalProtocolMetrics, { globalProtocolMetricsQuery } from './GlobalProtocolMetrics';
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate';

export default function GlobalProtocolMetricsWithSubscription() {
  // Get query reference for Relay
  const [queryRef, loadQuery] = useQueryLoader<GlobalProtocolMetricsQuery>(
    globalProtocolMetricsQuery
  );
  
  // Initial load
  useEffect(() => {
    if (!queryRef) {
      loadQuery({}, { fetchPolicy: 'store-or-network' });
    }
  }, [queryRef, loadQuery]);
  
  // Handle refreshing when metrics update
  const handleMetricsUpdate = () => {
    // Always use store-and-network to prevent skeleton loading states
    // This shows cached data immediately while fetching fresh data in background
    loadQuery({}, { fetchPolicy: 'store-and-network' });
  };
  
  // Use our custom hook for real-time updates
  useRefreshOnUpdate({
    entityType: 'metrics',
    onUpdate: handleMetricsUpdate,
    minRefreshInterval: 5000, // 5 seconds minimum between updates
    shouldRefetch: false // No need to force refetch, loadQuery will handle it
  });
  
  // Render the metrics component with the query reference
  return queryRef ? (
    <GlobalProtocolMetrics queryRef={queryRef} />
  ) : (
    <div>Loading protocol metrics...</div>
  );
} 