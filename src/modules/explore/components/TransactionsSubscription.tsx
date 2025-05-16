'use client'

import React, { useEffect, useRef } from 'react';
import { useQueryLoader } from 'react-relay';
import { transactionsPageQuery } from './TransactionsPage';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';

interface TransactionsSubscriptionProps {
  children: React.ReactNode;
  queryRef: any; // Preloaded query reference
}

export default function TransactionsSubscription({ children, queryRef }: TransactionsSubscriptionProps) {
  const [_, loadQuery] = useQueryLoader(transactionsPageQuery);
  
  // Use Redis subscriber for real-time updates
  const { transactionLastUpdated } = useRedisSubscriber();
  
  // Track the last refresh time to prevent too frequent updates
  const lastRefreshTimeRef = useRef<number>(0);
  
  // Set up listener for transaction updates from Redis
  useEffect(() => {
    if (Object.keys(transactionLastUpdated).length > 0) {
      const now = Date.now();
      // Throttle refreshes to at most once per second
      if (now - lastRefreshTimeRef.current > 1000) {
        console.log('[TransactionsSubscription] Refreshing transactions data due to Redis update');
        if (queryRef && queryRef.variables) {
          loadQuery(queryRef.variables, { fetchPolicy: 'network-only' });
          lastRefreshTimeRef.current = now;
        }
      }
    }
  }, [transactionLastUpdated, queryRef, loadQuery]);
  
  // Set up a periodic refresh as a backup
  useEffect(() => {
    const interval = setInterval(() => {
      if (queryRef && queryRef.variables) {
        console.log('[TransactionsSubscription] Performing periodic refresh');
        loadQuery(queryRef.variables, { fetchPolicy: 'network-only' });
      }
    }, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(interval);
  }, [queryRef, loadQuery]);
  
  // Just render the children directly
  return <>{children}</>;
} 