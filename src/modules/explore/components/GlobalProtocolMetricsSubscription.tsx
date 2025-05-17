'use client'

import React, { useEffect, useCallback } from 'react';
import { useQueryLoader } from 'react-relay';
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql';
import GlobalProtocolMetrics, { globalProtocolMetricsQuery, GlobalProtocolMetricsSkeleton } from './GlobalProtocolMetrics';
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate';
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary';

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

// Simple component with minimal error handling
function GlobalProtocolMetricsContent() {
  // Use Relay hooks directly - the withRelayBoundary HOC will protect us
  const [queryRef, loadQuery] = useQueryLoader<GlobalProtocolMetricsQuery>(globalProtocolMetricsQuery);
  
  // Callback for refreshing data
  const refreshData = useCallback(() => {
    console.log('Refreshing protocol metrics');
    try {
      loadQuery({}, { fetchPolicy: 'store-and-network' });
    } catch (err) {
      console.error('Error refreshing metrics', err);
    }
  }, [loadQuery]);
  
  // Initial load
  useEffect(() => {
    try {
      console.log('Loading initial protocol metrics');
      loadQuery({}, { fetchPolicy: 'store-or-network' });
    } catch (err) {
      console.error('Error loading initial metrics', err);
    }
  }, [loadQuery]);
  
  // Set up real-time updates
  useRefreshOnUpdate({
    entityType: 'metrics',
    onUpdate: refreshData,
    minRefreshInterval: 5000
  });
  
  // Show loading skeleton if data isn't loaded yet
  if (!queryRef) {
    return <GlobalProtocolMetricsSkeleton />;
  }
  
  // Render with data
  return <GlobalProtocolMetrics queryRef={queryRef} />;
}

// Export with protection via withRelayBoundary
export default withRelayBoundary(GlobalProtocolMetricsContent, GlobalProtocolMetricsSkeleton); 