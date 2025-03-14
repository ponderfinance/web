'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Text, View, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay'
import PoolItem from './PoolItem'
import { PoolsListQuery } from '@/src/__generated__/PoolsListQuery.graphql'
import { PoolsListFragment$key } from '@/src/__generated__/PoolsListFragment.graphql'

// The initial query to load the first batch of pools
const PoolsQuery = graphql`
  query PoolsListQuery($first: Int) {
    ...PoolsListFragment @arguments(first: $first)
  }
`

// The fragment that defines the data requirements and pagination
const PoolsListFragment = graphql`
  fragment PoolsListFragment on Query
  @argumentDefinitions(
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  )
  @refetchable(queryName: "PoolsListPaginationQuery") {
    pairs(first: $first, after: $after, orderBy: createdAt, orderDirection: desc)
      @connection(key: "PoolsList_pairs", filters: ["orderBy", "orderDirection"]) {
      edges {
        node {
          id
          ...PoolItem_pair
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`

export default function PoolsList() {
  const POOLS_PER_PAGE = 10
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Only render client-side data after component is mounted
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Show loading skeleton during SSR or before mounting
  if (!isMounted) {
    return (
      <View direction="column" gap={4} data-testid="pools-list-loading">
        <Skeleton height={20} width="100%" borderRadius="large" />
        <Skeleton height={20} width="100%" borderRadius="large" />
        <Skeleton height={20} width="100%" borderRadius="large" />
      </View>
    )
  }

  // Client-side content
  return <PoolsListContent loadMoreRef={loadMoreRef} />
}

// Separate the content with data fetching to avoid hydration issues
function PoolsListContent({
  loadMoreRef,
}: {
  loadMoreRef: React.RefObject<HTMLDivElement>
}) {
  const POOLS_PER_PAGE = 10

  // Initial query to load the first batch of pools
  const queryData = useLazyLoadQuery<PoolsListQuery>(
    PoolsQuery,
    { first: POOLS_PER_PAGE },
    { fetchPolicy: 'store-and-network' } // Fetch from cache and network
  )

  // Use the pagination fragment to handle loading more pools
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    PoolsListQuery,
    PoolsListFragment$key
  >(PoolsListFragment, queryData)


  // Implement intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNext) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasNext && !isLoadingNext) {
          loadNext(POOLS_PER_PAGE)
        }
      },
      { threshold: 0.5 }
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [loadMoreRef, hasNext, isLoadingNext, loadNext])

  // Loading state
  if (!data?.pairs) {
    return (
      <View direction="column" gap={4}>
        <Skeleton height={20} width="100%" borderRadius="large" />
        <Skeleton height={20} width="100%" borderRadius="large" />
        <Skeleton height={20} width="100%" borderRadius="large" />
      </View>
    )
  }

  // Empty state
  if (data.pairs.edges.length === 0) {
    return <Text align="center">No pools found.</Text>
  }

  const totalCount = data.pairs.totalCount || 0

  return (
    <View direction="column" gap={16}>
      {/* Pool list */}
      <View direction="column" gap={8}>
        {data.pairs.edges.map((edge) => {
          // Skip if the node is null or undefined
          if (!edge?.node) return null

          return <PoolItem key={edge.node.id} pairRef={edge.node} />
        })}
      </View>

      {/* Loading more indicator */}
      {isLoadingNext && (
        <View direction="column" gap={4}>
          <Skeleton height={20} width="100%" borderRadius="large" />
          <Skeleton height={20} width="100%" borderRadius="large" />
        </View>
      )}

      {/* Invisible element to trigger loading more */}
      {hasNext && <div ref={loadMoreRef} style={{ height: '20px' }} />}

      {/* No more pools message */}
      {!hasNext && data.pairs.edges.length > 0 && (
        <Text align="center" color="neutral">
          Showing {data.pairs.edges.length} of {totalCount} pools
        </Text>
      )}
    </View>
  )
}
