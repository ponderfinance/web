'use client'

import React, { useEffect } from 'react';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';

interface TokenSubscriptionProps {
  tokenId: string;
  tokenAddress: string;
  children: React.ReactNode;
}

export default function TokenSubscription({ tokenId, tokenAddress, children }: TokenSubscriptionProps) {
  // Get Redis subscriber context for real-time updates
  const { tokenLastUpdated } = useRedisSubscriber();
  
  // For demo purposes, we'll just output to console when the token is updated
  useEffect(() => {
    if (tokenId && tokenLastUpdated[tokenId]) {
      console.log(`[TokenSubscription] Token ${tokenId} updated at ${new Date(tokenLastUpdated[tokenId]).toISOString()}`);
    }
  }, [tokenId, tokenLastUpdated]);

  // Just render the children directly
  // In a full implementation, we would handle querying and data refreshing here
  return <>{children}</>;
} 