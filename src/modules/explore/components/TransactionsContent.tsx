import React, { useCallback, useState, useEffect } from 'react'
import { useLazyLoadQuery, PreloadedQuery } from 'react-relay'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'
import { TransactionsDisplay } from '@/src/modules/explore/components/TransactionsDisplay'
import { LoadMore } from '@/src/components/LoadMore'
import { transactionsPageQuery } from '@/src/modules/explore/components/TransactionsPage'

// Transactions content with pagination
interface TransactionsContentProps {
  queryRef: PreloadedQuery<TransactionsPageQuery>;
  initialQueryVariables: {
    first: number;
    after: string | null;
  };
  onLoadMore: (endCursor: string | null) => void;
}

export function TransactionsContent({ 
  queryRef, 
  initialQueryVariables,
  onLoadMore 
}: TransactionsContentProps) {
  const data = useLazyLoadQuery<TransactionsPageQuery>(
    transactionsPageQuery,
    initialQueryVariables,
    { fetchPolicy: 'store-or-network' }
  );
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Extract pageInfo from the data
  const { hasNextPage, endCursor } = data.recentTransactions.pageInfo;
  
  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isLoadingMore && endCursor) {
      setIsLoadingMore(true);
      onLoadMore(endCursor);
    }
  }, [hasNextPage, isLoadingMore, endCursor, onLoadMore]);
  
  // Reset loading state when new data is received
  useEffect(() => {
    setIsLoadingMore(false);
  }, [data]);
  
  const txCount = data.recentTransactions.edges.length;
  
  return (
    <>
      <TransactionsDisplay data={data} />
      {txCount > 0 && (
        <LoadMore 
          hasMore={hasNextPage}
          isLoading={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      )}
    </>
  );
} 