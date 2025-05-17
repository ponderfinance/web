'use client'

import React, { useEffect, useCallback, useState } from 'react';
import { useQueryLoader } from 'react-relay';
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql';
import GlobalProtocolMetrics, { globalProtocolMetricsQuery, GlobalProtocolMetricsSkeleton } from './GlobalProtocolMetrics';
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate';
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary';
import { ConnectionState } from '@/src/lib/redis/eventService';

// Simple component with minimal error handling
function GlobalProtocolMetricsContent() {
  // Use Relay hooks directly - the withRelayBoundary HOC will protect us
  const [queryRef, loadQuery] = useQueryLoader<GlobalProtocolMetricsQuery>(globalProtocolMetricsQuery);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  
  // Callback for refreshing data
  const refreshData = useCallback(() => {
    try {
      loadQuery({}, { fetchPolicy: 'store-and-network' });
    } catch (err) {
      console.error('Error refreshing metrics', err);
      setLoadError(err instanceof Error ? err : new Error('Unknown error refreshing data'));
    }
  }, [loadQuery]);
  
  // Initial load
  useEffect(() => {
    // Skip if we've already loaded
    if (initialLoadComplete) return;
    
    try {
      loadQuery({}, { fetchPolicy: 'store-or-network' });
      setInitialLoadComplete(true);
    } catch (err) {
      console.error('Error loading initial metrics', err);
      setLoadError(err instanceof Error ? err : new Error('Unknown error loading initial data'));
    }
  }, [loadQuery, initialLoadComplete]);
  
  // Set up real-time updates with proper connection state handling
  const { connectionState } = useRefreshOnUpdate({
    entityType: 'metrics',
    onUpdate: refreshData,
    minRefreshInterval: 15000, // 15 second minimum between refreshes to reduce load
    debug: true // Enable debug logging
  });
  
  // Schedule a refresh if we reconnect after being suspended
  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED && initialLoadComplete) {
      const timer = setTimeout(() => {
        refreshData();
      }, 2000); // Wait 2 seconds after reconnection
      
      return () => clearTimeout(timer);
    }
  }, [connectionState, refreshData, initialLoadComplete]);
  
  // Show loading skeleton if data isn't loaded yet
  if (!queryRef) {
    return <GlobalProtocolMetricsSkeleton />;
  }
  
  // Show error state if something failed
  if (loadError) {
    return (
      <div className="p-4 border border-red-300 rounded bg-red-50 text-red-800">
        <h3 className="font-semibold">Error loading metrics</h3>
        <p>{loadError.message || 'Unknown error'}</p>
        <button 
          onClick={refreshData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Render with data
  return <GlobalProtocolMetrics queryRef={queryRef} />;
}

// Export with protection via withRelayBoundary
export default withRelayBoundary(GlobalProtocolMetricsContent, GlobalProtocolMetricsSkeleton); 