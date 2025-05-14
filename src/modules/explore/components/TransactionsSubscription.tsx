'use client'

import React, { useEffect } from 'react';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
import { useQueryLoader } from 'react-relay';
import { transactionsPageQuery } from './TransactionsPage';

interface TransactionsSubscriptionProps {
  children: React.ReactNode;
  queryRef: any; // Preloaded query reference
}

export default function TransactionsSubscription({ children, queryRef }: TransactionsSubscriptionProps) {
  // Get Redis subscriber context for real-time updates
  const { transactionLastUpdated, refreshData } = useRedisSubscriber();
  const [_, loadQuery] = useQueryLoader(transactionsPageQuery);
  
  // Effect to handle transaction updates
  useEffect(() => {
    console.log('[TransactionsSubscription] Setting up listener for transaction updates');
    
    // Track the latest known transaction timestamp
    let lastUpdateTimestamp = 0;
    
    // Get latest transaction timestamp from updates
    Object.values(transactionLastUpdated).forEach(timestamp => {
      if (timestamp > lastUpdateTimestamp) {
        lastUpdateTimestamp = timestamp;
      }
    });
    
    // Refresh data when we have new transactions
    if (lastUpdateTimestamp > 0) {
      console.log(`[TransactionsSubscription] Detected new transaction at ${new Date(lastUpdateTimestamp).toISOString()}`);
      
      // Reload the query with the same variables
      if (queryRef && queryRef.variables) {
        loadQuery(queryRef.variables);
      }
    }
    
    // Also set up a periodic refresh
    const interval = setInterval(() => {
      if (queryRef && queryRef.variables) {
        loadQuery(queryRef.variables);
      }
    }, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(interval);
  }, [transactionLastUpdated, queryRef, loadQuery]);
  
  // Just render the children directly
  return <>{children}</>;
} 