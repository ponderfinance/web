'use client'

import React, { useEffect, useRef } from 'react';
import { subscribeToTokenUpdates } from '@/src/lib/subscriptions/subscription-server';

interface TokenSubscriptionProps {
  tokenId: string;
  tokenAddress: string;
  children: React.ReactNode;
  onTokenUpdate?: () => void; // Optional callback when token updates
}

export default function TokenSubscription({ 
  tokenId, 
  tokenAddress, 
  children,
  onTokenUpdate 
}: TokenSubscriptionProps) {
  // Track the last refresh time to prevent too frequent updates
  const lastRefreshTimeRef = useRef<number>(0);
  
  // Set up event subscription for token updates
  useEffect(() => {
    if (!tokenId) return;
    
    console.log(`[TokenSubscription] Setting up subscription to token ${tokenId} updates`);
    
    // Create a handler function that implements debounce logic
    const handleTokenUpdate = () => {
      const now = Date.now();
      // Only call callback if it's been at least 1 second since the last refresh
      if (now - lastRefreshTimeRef.current > 1000) {
        console.log(`[TokenSubscription] Token ${tokenId} updated at ${new Date().toISOString()}`);
        if (onTokenUpdate) {
          onTokenUpdate();
          lastRefreshTimeRef.current = now;
        }
      }
    };
    
    // Subscribe to token updates
    const unsubscribe = subscribeToTokenUpdates(tokenId, handleTokenUpdate);
    
    // Clean up
    return () => {
      unsubscribe();
    };
  }, [tokenId, onTokenUpdate]);
  
  // Just render the children directly
  return <>{children}</>;
} 