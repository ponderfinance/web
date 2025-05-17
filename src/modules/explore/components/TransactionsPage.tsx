'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { graphql, useLazyLoadQuery, useQueryLoader, PreloadedQuery } from 'react-relay'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'
import { TransactionsDisplay } from '@/src/modules/explore/components/TransactionsDisplay'
import { View, Text, Skeleton } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import ScrollableTable from '@/src/components/ScrollableTable'
import { registerSubscriber, unregisterSubscriber } from '@/src/lib/redis/subscriber'

export const transactionsPageQuery = graphql`
  query TransactionsPageQuery($first: Int!) {
    recentTransactions(first: $first) {
      edges {
        node {
          id
          txHash
          timestamp
          userAddress
          token0 {
            id
            address
            symbol
            ...TokenPairFragment
          }
          token1 {
            id
            address
            symbol
            ...TokenPairFragment
          }
          amountIn0
          amountIn1
          amountOut0
          amountOut1
          valueUSD
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`

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

// Loading component for suspense
function TransactionsLoading() {
  return (
    <ScrollableTable minWidth="1000px">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        paddingInline={4}
        paddingBlock={2}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
        width="100%"
      >
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Time
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Type
          </Text>
        </View.Item>

        <View.Item columns={4}>
          <Text color="neutral-faded" weight="medium">
            Token Pair
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Token Amount
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Token Amount
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Value
          </Text>
        </View.Item>
      </View>

      {/* Skeleton Rows */}
      {Array.from({ length: 5 }).map((_, index) => (
        <View
          key={index}
          direction="row"
          gap={0}
          paddingInline={4}
          paddingBlock={2}
          className={'border-0 border-b border-neutral-faded'}
          backgroundColor="elevation-base"
          width="100%"
        >
          <View.Item columns={2}>
            <Skeleton width="80px" height="20px" />
          </View.Item>

          <View.Item columns={1}>
            <Skeleton width="60px" height="20px" />
          </View.Item>

          <View.Item columns={4}>
            <Skeleton width="120px" height="20px" />
          </View.Item>

          <View.Item columns={2}>
            <Skeleton width="90px" height="20px" />
          </View.Item>

          <View.Item columns={2}>
            <Skeleton width="90px" height="20px" />
          </View.Item>

          <View.Item columns={1}>
            <Skeleton width="60px" height="20px" />
          </View.Item>
        </View>
      ))}
    </ScrollableTable>
  )
}

// Main content component that fetches data
function TransactionsContent({ queryRef }: { queryRef: PreloadedQuery<TransactionsPageQuery> }) {
  const data = useLazyLoadQuery<TransactionsPageQuery>(
    transactionsPageQuery,
    {
      first: 15,
    },
    {
      fetchPolicy: 'store-and-network',
    }
  )

  return <TransactionsDisplay data={data} />
}

// Main transactions page component with safe handling of Relay environment
export const TransactionsPage = () => {
  const [isRelayAvailable, setIsRelayAvailable] = useState<boolean>(false);
  const [queryRef, setQueryRef] = useState<any>(null);
  const [loadQuery, setLoadQuery] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Safely try to initialize Relay hooks
  useEffect(() => {
    try {
      // Try to use the hook - this will throw if Relay environment isn't available
      const [qRef, qLoader] = useQueryLoader<TransactionsPageQuery>(transactionsPageQuery);
      
      // If we got here, Relay is available
      setIsRelayAvailable(true);
      setQueryRef(qRef);
      setLoadQuery(() => qLoader); // Store the function
      
      // Initial data load
      logWithStyle('🔄 Loading transaction data...', 'info');
      qLoader({ first: 15 }, { fetchPolicy: 'network-only' });
    } catch (error) {
      // Relay environment not available yet
      setIsRelayAvailable(false);
      logWithStyle('⏳ Waiting for Relay environment to be ready...', 'warning');
    }
  }, []);
  
  // Register this component as a real-time update subscriber
  useEffect(() => {
    if (!isRelayAvailable) return;
    
    // Register as a transaction subscriber
    registerSubscriber();
    
    // Clean up when unmounted
    return () => {
      unregisterSubscriber();
    };
  }, [isRelayAvailable]);
  
  // Set up real-time update hook for transactions
  useEffect(() => {
    if (!isRelayAvailable || !loadQuery) return;
    
    useRefreshOnUpdate({
      entityType: 'transaction',
      onUpdate: () => {
        logWithStyle('🔄 Refreshing transactions due to real-time update', 'info');
        // Reload query
        loadQuery({ first: 15 }, { fetchPolicy: 'network-only' });
        // Force re-render by changing key
        setRefreshKey(prev => prev + 1);
      },
      minRefreshInterval: 1000,
      shouldRefetch: true,
    });
  }, [isRelayAvailable, loadQuery]);

  // Create a key that changes when the refresh counter changes
  const contentKey = `transactions-content-${refreshKey}`;
  
  // Show a loading/skeleton UI if Relay or query ref is not available
  if (!isRelayAvailable || !queryRef) {
    return <TransactionsLoading />;
  }
  
  return (
    <View gap={6}>
      <Suspense fallback={<TransactionsLoading />}>
        <TransactionsContent key={contentKey} queryRef={queryRef} />
      </Suspense>
    </View>
  );
}
