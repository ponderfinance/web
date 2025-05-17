'use client'

import React, { useEffect, useState } from 'react';
import { useQueryLoader } from 'react-relay';
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql';
import GlobalProtocolMetrics, { globalProtocolMetricsQuery } from './GlobalProtocolMetrics';
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate';

// Helper for console logging
const logWithStyle = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
  const styles = {
    success: 'color: #00c853; font-weight: bold;',
    info: 'color: #2196f3; font-weight: bold;',
    error: 'color: #f44336; font-weight: bold;',
    warning: 'color: #ff9800; font-weight: bold;'
  };
  
  console.log(`%c${message}`, styles[type]);
};

// Simplified component using the singleton environment
export default function GlobalProtocolMetricsWithSubscription() {
  // We can safely use useQueryLoader here because this component only renders
  // when the RelayEnvironmentProvider is available (from the parent providers)
  const [queryRef, loadQuery] = useQueryLoader<GlobalProtocolMetricsQuery>(
    globalProtocolMetricsQuery
  );
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Initial load
  useEffect(() => {
    if (!queryRef) {
      logWithStyle('🔄 Loading protocol metrics...', 'info');
      loadQuery({}, { fetchPolicy: 'store-or-network' });
    }
    setIsLoading(false);
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
  
  // Show loading state if query ref is not ready yet
  if (isLoading || !queryRef) {
    return <div>Loading protocol metrics...</div>;
  }
  
  // Render the metrics component with the query reference
  return <GlobalProtocolMetrics queryRef={queryRef} />;
} 