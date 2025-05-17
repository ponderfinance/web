'use client'

import React, { useEffect, useState } from 'react';
import { useQueryLoader } from 'react-relay';
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql';
import GlobalProtocolMetrics, { globalProtocolMetricsQuery, GlobalProtocolMetricsSkeleton } from './GlobalProtocolMetrics';
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
  const [isRelayAvailable, setIsRelayAvailable] = useState<boolean>(false);
  const [queryRef, setQueryRef] = useState<any>(null);
  const [loadQuery, setLoadQuery] = useState<any>(null);
  
  // Safely try to initialize Relay hooks
  useEffect(() => {
    try {
      // Try to use the hook - this will throw if Relay environment isn't available
      const [qRef, qLoader] = useQueryLoader<GlobalProtocolMetricsQuery>(globalProtocolMetricsQuery);
      
      // If we got here, Relay is available
      setIsRelayAvailable(true);
      setQueryRef(qRef);
      setLoadQuery(() => qLoader); // Store the function
      
      // Initial data load
      if (!qRef) {
        logWithStyle('🔄 Loading protocol metrics...', 'info');
        qLoader({}, { fetchPolicy: 'store-or-network' });
      }
    } catch (error) {
      // Relay environment not available yet
      setIsRelayAvailable(false);
      logWithStyle('⏳ Waiting for Relay environment to be ready...', 'warning');
    }
  }, []);
  
  // Handle refreshing when metrics update (only if Relay is available)
  useEffect(() => {
    if (!isRelayAvailable || !loadQuery) return;
    
    const handleMetricsUpdate = () => {
      // Always use store-and-network to prevent skeleton loading states
      loadQuery({}, { fetchPolicy: 'store-and-network' });
    };
    
    // Use our custom hook for real-time updates
    useRefreshOnUpdate({
      entityType: 'metrics',
      onUpdate: handleMetricsUpdate,
      minRefreshInterval: 5000, // 5 seconds minimum between updates
      shouldRefetch: false // No need to force refetch, loadQuery will handle it
    });
    
    // No cleanup needed - hook manages its own lifecycle
  }, [isRelayAvailable, loadQuery]);
  
  // Show loading state if Relay is not available yet or query ref is not ready
  if (!isRelayAvailable || !queryRef) {
    return <GlobalProtocolMetricsSkeleton />;
  }
  
  // Render the metrics component with the query reference
  return <GlobalProtocolMetrics queryRef={queryRef} />;
} 