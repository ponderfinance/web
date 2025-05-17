'use client'

import React, { useEffect, useCallback } from 'react'
import { graphql, useLazyLoadQuery, useQueryLoader, PreloadedQuery } from 'react-relay'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'
import { TransactionsDisplay } from '@/src/modules/explore/components/TransactionsDisplay'
import { View, Text, Skeleton } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import ScrollableTable from '@/src/components/ScrollableTable'
import { registerRedisConnection, unregisterRedisConnection } from '@/src/lib/redis'
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary'

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

// Loading component
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
      <View direction="column" gap={0} width="100%">
        {[...Array(10)].map((_, index) => (
          <View
            key={index}
            direction="row"
            gap={0}
            padding={4}
            align="center"
            width="100%"
          >
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>

            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>

            <View.Item columns={4}>
              <View direction="row" gap={2} align="center">
                <Skeleton width={8} height={8} borderRadius="circular" />
                <Skeleton width={8} height={8} borderRadius="circular" />
                <Skeleton width="80px" height="24px" />
              </View>
            </View.Item>

            <View.Item columns={2}>
              <Skeleton width="90px" height="24px" />
            </View.Item>

            <View.Item columns={2}>
              <Skeleton width="90px" height="24px" />
            </View.Item>

            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
}

// Component for displaying transactions data
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

// Main component with Relay hooks
function TransactionsPageContent() {
  // All hooks at the top level
  const [queryRef, loadQuery] = useQueryLoader<TransactionsPageQuery>(transactionsPageQuery);
  
  // Callback for refreshing data
  const refreshData = useCallback(() => {
    logWithStyle('🔄 Refreshing transactions due to real-time update', 'info');
    loadQuery({ first: 15 }, { fetchPolicy: 'network-only' });
  }, [loadQuery]);
  
  // Initial data load
  useEffect(() => {
    loadQuery({ first: 15 }, { fetchPolicy: 'network-only' });
    logWithStyle('🔄 Loading transaction data...', 'info');
  }, [loadQuery]);
  
  // Register for updates
  useEffect(() => {
    registerRedisConnection();
    return () => {
      unregisterRedisConnection();
    };
  }, []);
  
  // Set up real-time updates
  useRefreshOnUpdate({
    entityType: 'transaction',
    onUpdate: refreshData,
    minRefreshInterval: 1000,
    shouldRefetch: true,
  });
  
  // Simple conditional rendering
  if (!queryRef) {
    return <TransactionsLoading />;
  }
  
  return <TransactionsContent queryRef={queryRef} />;
}

// Export wrapped component with Relay boundary
export const TransactionsPage = withRelayBoundary(TransactionsPageContent, TransactionsLoading);
