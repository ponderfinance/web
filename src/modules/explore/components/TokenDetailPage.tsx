'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { View, Text } from 'reshaped'
import TokenDetailContent from './TokenDetailContent'
import TokenPairListContainer from './TokenPairListContainer'
import TokenTxHistoryContainer from './TokenTxHistoryContainer'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'
import { isAddress } from 'viem'
import { RelayEnvironmentProvider } from 'react-relay'
import { getClientEnvironment } from '@/src/lib/relay/environment'

interface TokenDetailPageProps {
  tokenAddress: string
}

// Create a wrapper component to handle Relay environment
function TokenDetailContentWithRelay({ tokenAddress }: { tokenAddress: string }) {
  const [environment, setEnvironment] = useState<any>(null);
  
  useEffect(() => {
    // Get the Relay environment on the client side
    const relayEnvironment = getClientEnvironment();
    setEnvironment(relayEnvironment);
  }, []);
  
  // Don't render anything until we have the environment
  if (!environment) {
    return <TokenDetailSkeleton />;
  }
  
  return (
    <RelayEnvironmentProvider environment={environment}>
      <TokenDetailContent tokenAddress={tokenAddress} />
    </RelayEnvironmentProvider>
  );
}

export default function TokenDetailPage({ tokenAddress }: TokenDetailPageProps) {
  // Validate the token address
  if (!tokenAddress) {
    console.error(`[TokenDetail] Missing token address`);
    return renderErrorState("Token address is missing");
  }
  
  // Normalize the address - ensure lowercase for consistency
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Validate the token address format
  if (!isAddress(normalizedAddress)) {
    console.error(`[TokenDetail] Invalid token address format: ${tokenAddress}`);
    return renderErrorState(`Invalid token address format: ${tokenAddress}`);
  }

  // Use the RedisSubscriber context for real-time updates
  const { tokenLastUpdated, refreshData } = useRedisSubscriber();
  
  // Subscribe to this token if it's not already subscribed
  React.useEffect(() => {
    console.log(`[TokenDetail] Setup for real-time updates for token: ${normalizedAddress}`);
    
    // For testing, we can manually refresh data
    const interval = setInterval(() => {
      refreshData();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [normalizedAddress, refreshData]);

  return (
    <View direction="column" gap={6}>
      <Suspense fallback={<TokenDetailSkeleton />}>
        <TokenDetailContentWithRelay tokenAddress={normalizedAddress} />
      </Suspense>
      <TokenMetaDataContainers tokenAddress={normalizedAddress} />
    </View>
  )
}

// Separate component to handle the token metadata sections
function TokenMetaDataContainers({ tokenAddress }: { tokenAddress: string }) {
  // Extra validation to ensure tokenAddress is valid before using in child components
  if (!tokenAddress || !isAddress(tokenAddress)) {
    return null;
  }
  
  return (
    <>
      {/* Suspense for pairs list */}
      <Suspense fallback={<TokenPairsSkeleton />}>
        <TokenPairListContainer tokenAddress={tokenAddress} />
      </Suspense>

      {/* Suspense for transaction history */}
      <Suspense fallback={<TokenTxSkeleton />}>
        <TokenTxHistoryContainer tokenAddress={tokenAddress} />
      </Suspense>
    </>
  )
}

// Placeholder loading skeletons
function TokenDetailSkeleton() {
  return (
    <View
      height={400}
      width="100%"
      attributes={{
        style: {
          backgroundColor: 'rgba(30, 30, 30, 0.6)',
          borderRadius: 4,
        },
      }}
    />
  )
}

function TokenPairsSkeleton() {
  return (
    <View
      height={200}
      width="100%"
      attributes={{
        style: {
          backgroundColor: 'rgba(30, 30, 30, 0.6)',
          borderRadius: 4,
        },
      }}
    />
  )
}

function TokenTxSkeleton() {
  return (
    <View
      height={200}
      width="100%"
      attributes={{
        style: {
          backgroundColor: 'rgba(30, 30, 30, 0.6)',
          borderRadius: 4,
        },
      }}
    />
  )
}

// Helper function to render error states
function renderErrorState(message: string) {
  return (
    <View direction="column" gap={6}>
      <View height={400} align="center" justify="center">
        <Text variant="featured-1" weight="medium" color="critical">Error</Text>
        <Text>{message}</Text>
      </View>
    </View>
  );
}
