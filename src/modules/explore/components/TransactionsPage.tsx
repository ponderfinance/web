'use client'

import React, { Suspense, useEffect, useCallback } from 'react'
import { graphql, useQueryLoader, usePaginationFragment, useLazyLoadQuery } from 'react-relay'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'
import { TransactionsPage_transactions$key } from '@/src/__generated__/TransactionsPage_transactions.graphql'
import { TransactionsDisplay } from '@/src/modules/explore/components/TransactionsDisplay'
import { View, Text, Skeleton, Button, Loader } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import { inlineTokenSwapFragment } from '@/src/components/InlineTokenSwap'
import { tokenAmountFragment } from '@/src/components/TokenAmount'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import { registerRedisConnection, unregisterRedisConnection } from '@/src/lib/redis'
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary'
import ScrollableTable from '@/src/components/ScrollableTable'

// Define our main query
export const transactionsPageQuery = graphql`
  query TransactionsPageQuery($first: Int!, $after: String) {
    ...TransactionsPage_transactions @arguments(first: $first, after: $after)
  }
`;

// Define a refetchable fragment for pagination
export const transactionsPageFragment = graphql`
  fragment TransactionsPage_transactions on Query
  @refetchable(queryName: "TransactionsPagePaginationQuery")
  @argumentDefinitions(
    first: { type: "Int!" }
    after: { type: "String" }
  ) {
    recentTransactions(first: $first, after: $after)
    @connection(key: "TransactionsPage__recentTransactions") {
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
            ...InlineTokenSwapFragment
            ...TokenAmountFragment
          }
          token1 {
            id
            address
            symbol
            ...TokenPairFragment
            ...InlineTokenSwapFragment
            ...TokenAmountFragment
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
`;

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
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Time
          </Text>
        </View.Item>

        <View.Item columns={4}>
          <Text color="neutral-faded" weight="medium">
            Type
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            USD
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

        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Wallet
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
            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>

            <View.Item columns={4}>
              <View direction="row" gap={2} align="center">
                <Skeleton width="150px" height="24px" />
              </View>
            </View.Item>

            <View.Item columns={1}>
              <Skeleton width="70px" height="24px" />
            </View.Item>

            <View.Item columns={2}>
              <Skeleton width="90px" height="24px" />
            </View.Item>

            <View.Item columns={2}>
              <Skeleton width="90px" height="24px" />
            </View.Item>

            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
}

// Paginated transactions component
function PaginatedTransactions({
  fragmentRef
}: {
  fragmentRef: TransactionsPage_transactions$key
}) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment(
    transactionsPageFragment,
    fragmentRef
  );
  const loaderRef = React.useRef<HTMLDivElement>(null);

  // Load more function
  const loadMoreItems = useCallback(() => {
    if (hasNext && !isLoadingNext) {
      loadNext(10);
    }
  }, [hasNext, isLoadingNext, loadNext]);

  // Setup intersection observer to detect when the user scrolls to the bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingNext) {
          loadMoreItems();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loaderRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNext, isLoadingNext, loadMoreItems]);

  return (
    <TransactionsDisplay 
      data={{ recentTransactions: data.recentTransactions }} 
      hasMore={hasNext}
      isLoading={isLoadingNext}
      loaderRef={loaderRef}
    />
  );
}

// Component that consumes the query and passes the fragment reference
function TransactionsQueryRenderer({
  queryReference
}: {
  queryReference: any;
}) {
  const data = useLazyLoadQuery<TransactionsPageQuery>(
    transactionsPageQuery,
    {
      first: 15,
      after: null
    },
    { fetchPolicy: 'store-or-network', fetchKey: queryReference }
  );

  return <PaginatedTransactions fragmentRef={data} />;
}

// Main component with Relay hooks
function TransactionsPageContent() {
  const [queryRef, loadQuery] = useQueryLoader<TransactionsPageQuery>(transactionsPageQuery);
  // Use a counter to force re-render of the query renderer
  const [queryRefreshCounter, setQueryRefreshCounter] = React.useState(0);
  
  // Initial data load
  useEffect(() => {
    loadQuery({ first: 15, after: null });
    setQueryRefreshCounter(prev => prev + 1); // Increment to trigger re-render
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
    onUpdate: () => {
      // Clear any cached data to ensure we get fresh data
      loadQuery({ first: 15, after: null }, { fetchPolicy: 'network-only' });
      setQueryRefreshCounter(prev => prev + 1); // Increment to trigger re-render
    },
    minRefreshInterval: 500, // Reduced from 1000ms to 500ms for more responsive updates
    shouldRefetch: true,
    debug: true, // Enable debug to trace transaction update flow
  });
  
  return (
    <Suspense fallback={<TransactionsLoading />}>
      <TransactionsQueryRenderer queryReference={queryRefreshCounter} />
    </Suspense>
  );
}

// Export wrapped component with Relay boundary
export const TransactionsPage = withRelayBoundary(TransactionsPageContent, TransactionsLoading);
