'use client'

import React, { useEffect, useRef } from 'react';
import { useQueryLoader } from 'react-relay';
import { transactionsPageQuery } from './TransactionsPage';
import { subscribeToTransactionUpdates } from '@/src/lib/subscriptions/subscription-server';

interface TransactionsSubscriptionProps {
  children: React.ReactNode;
  queryRef: any; // Preloaded query reference
}

export default function TransactionsSubscription({ children, queryRef }: TransactionsSubscriptionProps) {
  const [_, loadQuery] = useQueryLoader(transactionsPageQuery);
  
  // Track the last refresh time to prevent too frequent updates
  const lastRefreshTimeRef = useRef<number>(0);
  
  // Set up event subscription for transaction updates
  useEffect(() => {
    console.log('[TransactionsSubscription] Setting up subscription to transaction updates');
    
    // Create a handler function that implements debounce logic
    const handleTransactionUpdate = () => {
      const now = Date.now();
      // Only refresh if it's been at least 1 second since the last refresh
      if (now - lastRefreshTimeRef.current > 1000) {
        console.log('[TransactionsSubscription] Refreshing transactions data due to update');
        if (queryRef && queryRef.variables) {
          loadQuery(queryRef.variables, { fetchPolicy: 'network-only' });
          lastRefreshTimeRef.current = now;
        }
      }
    };
    
    // Subscribe to transaction updates
    const unsubscribe = subscribeToTransactionUpdates(handleTransactionUpdate);
    
    // Set up a periodic refresh as a backup
    const interval = setInterval(() => {
      if (queryRef && queryRef.variables) {
        console.log('[TransactionsSubscription] Performing periodic refresh');
        loadQuery(queryRef.variables, { fetchPolicy: 'network-only' });
        lastRefreshTimeRef.current = Date.now();
      }
    }, 15000); // Refresh every 15 seconds
    
    // Clean up
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [queryRef, loadQuery]);
  
  // Just render the children directly
  return <>{children}</>;
} 