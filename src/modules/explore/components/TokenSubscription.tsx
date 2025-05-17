'use client'

import React from 'react';
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate';

interface TokenSubscriptionProps {
  tokenId: string;
  tokenAddress: string;
  children: React.ReactNode;
  onTokenUpdate?: () => void; // Optional callback when token updates
}

/**
 * TokenSubscription component that uses the centralized registry-based update system
 * This component is a wrapper that subscribes to token updates and triggers a callback
 */
export default function TokenSubscription({ 
  tokenId, 
  tokenAddress, 
  children,
  onTokenUpdate 
}: TokenSubscriptionProps) {
  // Use our custom hook for real-time updates
  useRefreshOnUpdate({
    entityType: 'token',
    entityId: tokenAddress.toLowerCase(),
    onUpdate: onTokenUpdate,
    minRefreshInterval: 5000, // 5 seconds minimum between updates
    shouldRefetch: false // Let the callback handle the refresh
  });
  
  // Just render the children directly
  return <>{children}</>;
} 