'use client'

import React, { Suspense } from 'react'
import { View, Text, Skeleton } from 'reshaped'
import Link from 'next/link'
import TokenMetaDataContainers from './TokenMetaDataContainers'
import { isAddress } from 'viem'
import { TokenDetailContentWithRelay } from './TokenDetailContent'

type TokenDetailPageProps = {
  tokenAddress: string
}

// Loading skeleton for the token detail page
const TokenDetailSkeleton = () => (
  <View direction="column" gap={6}>
    {/* Header Skeleton */}
    <View direction="row" align="center" gap={1.5}>
      <Skeleton width={80} height={24} />
    </View>
    
    {/* Token Info Skeleton */}
    <View direction="row" justify="space-between" align="center">
      <View direction="row" gap={3} align="center">
        <Skeleton width={48} height={48} attributes={{ style: { borderRadius: '50%' } }} />
        <View direction="column" gap={1}>
          <Skeleton width={120} height={24} />
          <Skeleton width={80} height={16} />
        </View>
      </View>
    </View>
    
    {/* Price Skeleton */}
    <View direction="row" align="center" gap={2}>
      <Skeleton width={80} height={24} />
      <Skeleton width={60} height={16} />
    </View>
    
    {/* Chart Skeleton */}
    <Skeleton width="100%" height={400} />
  </View>
)

// Error display component
const renderErrorState = (message: string) => (
  <View direction="column" gap={4} align="center" justify="center" padding={6}>
    <Text variant="title-3" color="critical">Error</Text>
    <Text>{message}</Text>
    <Link href="/explore/tokens">
      <Text color="primary">Return to tokens list</Text>
    </Link>
  </View>
)

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

  return (
    <View direction="column" gap={6}>
      <Suspense fallback={<TokenDetailSkeleton />}>
        <TokenDetailContentWithRelay tokenAddress={normalizedAddress} />
      </Suspense>
      <TokenMetaDataContainers tokenAddress={normalizedAddress} />
    </View>
  )
}
