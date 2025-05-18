'use client'

import React, { Suspense, useEffect, useCallback } from 'react'
import { graphql, useQueryLoader, usePaginationFragment, useLazyLoadQuery } from 'react-relay'
import { TokensPageQuery, TokenOrderBy, OrderDirection } from '@/src/__generated__/TokensPageQuery.graphql'
import { TokensPage_tokens$key } from '@/src/__generated__/TokensPage_tokens.graphql'
import { TokensDisplay } from '@/src/modules/explore/components/TokensDisplay'
import { View, Text, Skeleton, Button, Loader } from 'reshaped'
import { tokenFragment } from '@/src/components/TokenPair'
import ScrollableTable from '@/src/components/ScrollableTable'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary'

// Define main query for tokens
export const tokensPageQuery = graphql`
  query TokensPageQuery(
    $first: Int!
    $after: String
    $orderBy: TokenOrderBy!
    $orderDirection: OrderDirection!
  ) {
    ...TokensPage_tokens @arguments(
      first: $first
      after: $after
      orderBy: $orderBy
      orderDirection: $orderDirection
    )
  }
`;

// Define a refetchable fragment for pagination
export const tokensPageFragment = graphql`
  fragment TokensPage_tokens on Query
  @refetchable(queryName: "TokensPagePaginationQuery")
  @argumentDefinitions(
    first: { type: "Int!" }
    after: { type: "String" }
    orderBy: { type: "TokenOrderBy!" }
    orderDirection: { type: "OrderDirection!" }
  ) {
    tokens(first: $first, after: $after, orderBy: $orderBy, orderDirection: $orderDirection)
    @connection(key: "TokensPage__tokens", filters: ["orderBy", "orderDirection"]) {
      edges {
        node {
          id
          address
          imageURI
          name
          symbol
          priceUSD
          priceChange1h
          priceChange24h
          volumeUSD24h
          volume1h
          fdv
          ...TokenPairFragment
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
function TokensLoading() {
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
            Token name
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Price
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            1H
          </Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            1D
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            FDV
          </Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Volume
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
                <View direction="row" gap={1} align="center">
                  <Skeleton width="120px" height="24px" />
                </View>
              </View>
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="50px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="50px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
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

// Paginated tokens with sorting
interface PaginatedTokensProps {
  fragmentRef: TokensPage_tokens$key;
  onSortChange: (orderBy: TokenOrderBy, orderDirection: OrderDirection) => void;
  currentOrderBy: TokenOrderBy;
  currentOrderDirection: OrderDirection;
}

function PaginatedTokens({ 
  fragmentRef, 
  onSortChange,
  currentOrderBy,
  currentOrderDirection 
}: PaginatedTokensProps) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment(
    tokensPageFragment,
    fragmentRef
  );
  const loaderRef = React.useRef<HTMLDivElement>(null);

  // Handle sorting
  const handleSort = useCallback((column: string) => {
    const orderBy = column as TokenOrderBy;
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
    <TokensDisplay
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
function TokensQueryRenderer({
  queryReference,
  orderBy,
  orderDirection,
  onSortChange
}: {
  queryReference: any;
  orderBy: TokenOrderBy;
  orderDirection: OrderDirection;
  onSortChange: (orderBy: TokenOrderBy, orderDirection: OrderDirection) => void;
}) {
  const data = useLazyLoadQuery<TokensPageQuery>(
    tokensPageQuery,
    {
      first: 20,
      after: null,
      orderBy,
      orderDirection
    },
    { fetchPolicy: 'store-or-network', fetchKey: queryReference }
  );

  return (
    <PaginatedTokens
      fragmentRef={data}
      onSortChange={onSortChange}
      currentOrderBy={orderBy}
      currentOrderDirection={orderDirection}
    />
  );
}

// Exported page component
const TokensPageContent = () => {
  // Get sort parameters from URL if available
  const getInitialSortParams = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const orderBy = params.get('orderBy') as TokenOrderBy || 'volumeUSD24h';
      const orderDirection = params.get('orderDirection') as OrderDirection || 'desc';
      return { orderBy, orderDirection };
    }
    return { orderBy: 'volumeUSD24h' as TokenOrderBy, orderDirection: 'desc' as OrderDirection };
  };

  const [sortParams, setSortParams] = React.useState(getInitialSortParams);
  const [mounted, setMounted] = React.useState(false);
  const [queryRef, loadQuery] = useQueryLoader<TokensPageQuery>(tokensPageQuery);
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
  const handleSortChange = useCallback((orderBy: TokenOrderBy, orderDirection: OrderDirection) => {
    window.history.pushState(
      {}, 
      '', 
      `?orderBy=${orderBy}&orderDirection=${orderDirection}`
    );
    setSortParams({ orderBy, orderDirection });
  }, []);

  // Use our custom hook for real-time updates
  useRefreshOnUpdate({
    entityType: 'token',
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
    return <TokensLoading />;
  }

  return (
    <View gap={6}>
      <Suspense fallback={<TokensLoading />}>
        <TokensQueryRenderer
          queryReference={queryRefreshCounter}
          orderBy={sortParams.orderBy}
          orderDirection={sortParams.orderDirection}
          onSortChange={handleSortChange}
        />
      </Suspense>
    </View>
  );
};

// Use the RelayBoundary HOC with a custom loading component
export const TokensPage = withRelayBoundary(TokensPageContent, TokensLoading);
