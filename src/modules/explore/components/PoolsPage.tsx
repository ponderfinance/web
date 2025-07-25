'use client'

import React, { Suspense, useEffect, useCallback } from 'react'
import { graphql, useQueryLoader, usePaginationFragment, useLazyLoadQuery } from 'react-relay'
import { PoolsPageQuery, PairOrderBy, OrderDirection } from '@/src/__generated__/PoolsPageQuery.graphql'
import { PoolsPage_pairs$key } from '@/src/__generated__/PoolsPage_pairs.graphql'
import { PoolsDisplay } from '@/src/modules/explore/components/PoolsDisplay'
import { View, Text, Skeleton, Button, Loader } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import ScrollableTable from '@/src/components/ScrollableTable'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary'

// Define main query for pools
export const poolsPageQuery = graphql`
  query PoolsPageQuery(
    $first: Int!
    $after: String
    $orderBy: PairOrderBy!
    $orderDirection: OrderDirection!
  ) {
    ...PoolsPage_pairs @arguments(
      first: $first
      after: $after
      orderBy: $orderBy
      orderDirection: $orderDirection
    )
  }
`;

// Define a refetchable fragment for pagination
export const poolsPageFragment = graphql`
  fragment PoolsPage_pairs on Query 
  @refetchable(queryName: "PoolsPagePaginationQuery")
  @argumentDefinitions(
    first: { type: "Int!" }
    after: { type: "String" }
    orderBy: { type: "PairOrderBy!" }
    orderDirection: { type: "OrderDirection!" }
  ) {
    pairs(first: $first, after: $after, orderBy: $orderBy, orderDirection: $orderDirection)
    @connection(key: "PoolsPage__pairs", filters: ["orderBy", "orderDirection"]) {
      edges {
        node {
          id
          address
          token0 {
            id
            address
            symbol
            decimals
            ...TokenPairFragment
          }
          token1 {
            id
            address
            symbol
            decimals
            ...TokenPairFragment
          }
          tvl
          reserveUSD
          poolAPR
          rewardAPR
          volume24h
          volume30d
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

// Loading component for suspense
function PoolsLoading() {
  return (
    <ScrollableTable minWidth="900px">
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
            #
          </Text>
        </View.Item>
        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">
            Pool
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            TVL
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Pool APR
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Reward APR
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            1D vol
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            30D vol
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
            className={'border-0 border-neutral-faded'}
            align="center"
            width="100%"
          >
            <View.Item columns={1}>
              <Text color="neutral-faded" weight="medium">
                {index + 1}
              </Text>
            </View.Item>
            <View.Item columns={3}>
              <View direction="row" gap={2} align="center">
                <Skeleton width={8} height={8} borderRadius="circular" />
                <Skeleton width="120px" height="24px" />
              </View>
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="100px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="100px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="100px" height="24px" />
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
}

// Paginated pools with sorting
interface PaginatedPoolsProps {
  fragmentRef: PoolsPage_pairs$key;
  onSortChange: (orderBy: PairOrderBy, orderDirection: OrderDirection) => void;
  currentOrderBy: PairOrderBy;
  currentOrderDirection: OrderDirection;
}

function PaginatedPools({
  fragmentRef,
  onSortChange,
  currentOrderBy,
  currentOrderDirection
}: PaginatedPoolsProps) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment(
    poolsPageFragment,
    fragmentRef
  );
  const loaderRef = React.useRef<HTMLDivElement>(null);

  console.log('data', data)

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    const orderBy = column as PairOrderBy;
    const orderDirection =
      orderBy === currentOrderBy && currentOrderDirection === 'desc'
        ? 'asc' as OrderDirection
        : 'desc' as OrderDirection;

    onSortChange(orderBy, orderDirection);
  }, [currentOrderBy, currentOrderDirection, onSortChange]);

  // Load more handler
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
    <PoolsDisplay
      data={data}
      orderBy={currentOrderBy}
      orderDirection={currentOrderDirection}
      setOrderBy={handleSort}
      setOrderDirection={() => {}} // Handled in handleSort
      hasMore={hasNext}
      isLoading={isLoadingNext}
      loaderRef={loaderRef}
    />
  );
}

// Component that consumes the query and passes the fragment reference
function PoolsQueryRenderer({
  queryReference,
  orderBy,
  orderDirection,
  onSortChange
}: {
  queryReference: any;
  orderBy: PairOrderBy;
  orderDirection: OrderDirection;
  onSortChange: (orderBy: PairOrderBy, orderDirection: OrderDirection) => void;
}) {
  const data = useLazyLoadQuery<PoolsPageQuery>(
    poolsPageQuery,
    {
      first: 20,
      after: null,
      orderBy,
      orderDirection
    },
    { fetchPolicy: 'store-or-network', fetchKey: queryReference }
  );

  return (
    <PaginatedPools
      fragmentRef={data}
      onSortChange={onSortChange}
      currentOrderBy={orderBy}
      currentOrderDirection={orderDirection}
    />
  );
}

// Exported page component
const PoolsPageContent = () => {
  // Get sort parameters from URL if available
  const getInitialSortParams = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const orderBy = params.get('orderBy') as PairOrderBy || 'reserveUSD';
      const orderDirection = params.get('orderDirection') as OrderDirection || 'desc';
      return { orderBy, orderDirection };
    }
    return { orderBy: 'reserveUSD' as PairOrderBy, orderDirection: 'desc' as OrderDirection };
  };

  const [sortParams, setSortParams] = React.useState(getInitialSortParams);
  const [mounted, setMounted] = React.useState(false);
  const [queryRef, loadQuery] = useQueryLoader<PoolsPageQuery>(poolsPageQuery);
  // Use a counter to force re-render of the query renderer
  const [queryRefreshCounter, setQueryRefreshCounter] = React.useState(0);

  // Sync URL params with state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleRouteChange = () => {
        setSortParams(getInitialSortParams());
      };

      window.addEventListener('popstate', handleRouteChange);
      setMounted(true);

      return () => {
        window.removeEventListener('popstate', handleRouteChange);
      };
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (mounted) {
      loadQuery({
        first: 20,
        after: null,
        orderBy: sortParams.orderBy,
        orderDirection: sortParams.orderDirection
      });
      setQueryRefreshCounter(prev => prev + 1); // Increment to trigger re-render
    }
  }, [mounted, loadQuery, sortParams]);

  // Handle sort change
  const handleSortChange = useCallback((orderBy: PairOrderBy, orderDirection: OrderDirection) => {
    window.history.pushState(
      {},
      '',
      `?orderBy=${orderBy}&orderDirection=${orderDirection}`
    );
    setSortParams({ orderBy, orderDirection });
  }, []);

  // Use our custom hook for real-time updates
  useRefreshOnUpdate({
    entityType: 'pair',
    onUpdate: () => {
      loadQuery({
        first: 20,
        after: null,
        orderBy: sortParams.orderBy,
        orderDirection: sortParams.orderDirection
      });
      setQueryRefreshCounter(prev => prev + 1); // Increment to trigger re-render
    },
    minRefreshInterval: 5000,
    shouldRefetch: true
  });

  if (!mounted) {
    return <PoolsLoading />;
  }

  return (
    <View gap={6}>
      <Suspense fallback={<PoolsLoading />}>
        <PoolsQueryRenderer
          queryReference={queryRefreshCounter}
          orderBy={sortParams.orderBy}
          orderDirection={sortParams.orderDirection}
          onSortChange={handleSortChange}
        />
      </Suspense>
    </View>
  );
};

// Export the component wrapped with Relay boundary
export const PoolsPage = withRelayBoundary(PoolsPageContent, PoolsLoading);
