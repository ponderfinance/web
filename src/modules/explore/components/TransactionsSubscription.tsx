'use client'

import React, { useEffect, useRef, useCallback } from 'react';
import { useQueryLoader, PreloadedQuery } from 'react-relay';
import { transactionsPageQuery } from './TransactionsPage';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql';

interface TransactionsSubscriptionProps {
  children: React.ReactNode;
  queryRef: PreloadedQuery<TransactionsPageQuery>; // Properly typed PreloadedQuery
}

export default function TransactionsSubscription({ children, queryRef }: TransactionsSubscriptionProps) {
  const [_, loadQuery] = useQueryLoader<TransactionsPageQuery>(transactionsPageQuery);
  
  // Track seen transaction IDs for deduplication
  const seenTransactionIds = useRef<Set<string>>(new Set());
  
  // Use Redis subscriber for real-time updates
  const { transactionLastUpdated } = useRedisSubscriber();
  
  // Track refresh state
  const lastRefreshRef = useRef<number>(0);
  const refreshingRef = useRef<boolean>(false);
    
  // Refresh function with built-in throttling and deduplication
  const refreshData = useCallback(() => {
    // Skip if already refreshing or refreshed recently (5 second minimum)
      const now = Date.now();
    if (refreshingRef.current || now - lastRefreshRef.current < 5000) {
      return;
    }
    
    // Check if we have new transactions not seen before
    const newTransactionIds = Object.keys(transactionLastUpdated).filter(
      id => !seenTransactionIds.current.has(id)
    );
    
    if (newTransactionIds.length === 0 && lastRefreshRef.current > 0) {
      // Skip if no new transactions (except on first run)
      return;
    }
    
    console.log(`[TransactionsSubscription] Refreshing with ${newTransactionIds.length} new transactions`);
    
    // Mark as refreshing and update timestamp
    refreshingRef.current = true;
    lastRefreshRef.current = now;
    
    // Add new transaction IDs to seen set
    newTransactionIds.forEach(id => seenTransactionIds.current.add(id));
    
    // Use store-and-network to prevent skeleton loading states
    loadQuery({ first: queryRef.variables.first }, { fetchPolicy: 'store-and-network' });
    
    // Reset refreshing state after a short delay
    setTimeout(() => {
      refreshingRef.current = false;
    }, 1000);
  }, [loadQuery, transactionLastUpdated, queryRef.variables.first]);
  
  // Single useEffect to handle both transaction updates and periodic refresh
  useEffect(() => {
    // Run initial refresh to populate seen transactions
    refreshData();
    
    // Set up periodic refresh as fallback (less frequent)
    const intervalId = setInterval(refreshData, 30000); // 30 seconds
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, [refreshData]);
  
  // Just render the children directly
  return <>{children}</>;
} 