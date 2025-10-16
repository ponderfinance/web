import React, { useEffect, useRef } from 'react';
import { View, Loader } from 'reshaped';

interface LoadMoreProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading?: boolean;
  threshold?: number;
  rootMargin?: string;
  root?: HTMLElement | null;
}

/**
 * LoadMore component that uses Intersection Observer to trigger loading more items
 * when the component comes into view.
 */
export const LoadMore: React.FC<LoadMoreProps> = ({
  onLoadMore,
  hasMore,
  isLoading = false,
  threshold = 0.5,
  rootMargin = '0px 0px 200px 0px', // Load more when within 200px of the bottom
  root = null,
}) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create the intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        // If the element is visible and we have more items to load
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      {
        root,
        threshold,
        rootMargin,
      }
    );

    // Start observing the load more element
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    // Cleanup the observer on unmount
    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore, isLoading, onLoadMore, threshold, rootMargin, root]);

  // If there are no more items to load, don't render anything
  if (!hasMore && !isLoading) {
    return null;
  }

  return (
    <View 
      padding={2} 
      align="center" 
      width="100%"
      attributes={{ ref: loadMoreRef }}
    >
      {isLoading && <Loader size="small" />}
    </View>
  );
}; 