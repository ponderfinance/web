'use client'

import { Suspense } from 'react'
import { View, Text, Skeleton } from 'reshaped'
import { isAddress } from 'viem'
import dynamic from 'next/dynamic'

// Force dynamic rendering to prevent errors with static generation
export const dynamicParams = true

// Use dynamic import with no SSR to ensure client-only rendering
// This helps avoid hydration issues with Relay
const TokenDetailPageClient = dynamic(
  () => import('@/src/modules/explore/components/TokenDetailClient'),
  { ssr: false }
)

// Enhanced loading skeleton with Reshaped Skeleton component
function TokenDetailSkeleton() {
  return (
    <View direction="column" gap={6} width="100%">
      {/* Breadcrumb Navigation skeleton */}
      <View direction="row" align="center" gap={1.5}>
        <Skeleton width={4} height={0.75} borderRadius="medium" />
        <Text color="neutral-faded" variant="body-2">›</Text>
        <Skeleton width={4} height={0.75} borderRadius="medium" />
        <Text color="neutral-faded" variant="body-2">›</Text>
        <Skeleton width={4} height={0.75} borderRadius="medium" />
      </View>
      
      {/* Token header with logo and name skeleton */}
      <View direction="row" align="center" gap={3}>
        <View width={8} height={8} overflow="hidden" borderRadius="large">
          <Skeleton width="100%" height="100%" />
        </View>
        <Skeleton width={56} height={4} borderRadius="medium" />
      </View>
      
      {/* Price and percent change skeleton */}
      <View direction="row" align="center" gap={2}>
        <Skeleton width={12} height={4} borderRadius="medium" />
        <Skeleton width={8} height={3} borderRadius="medium" />
      </View>
      
      {/* Main content area - responsive layout skeleton */}
      <View direction="row" gap={6} width="100%" justify="space-between">
        <View direction="column" gap={6} attributes={{ 
          style: { flex: '3', width: '100%' } 
        }}>
          {/* Chart skeleton with fixed 400px height */}
          <View attributes={{ style: { height: '400px', width: '100%' } }}>
            <Skeleton height="100%" width="100%" borderRadius="small" />
          </View>
          
          {/* Timeframe controls skeleton */}
          <View direction="row" gap={2} justify="start">
            {['1H', '1D', '1W', '1M', '1Y'].map((tf) => (
              <Skeleton key={tf} height={6} width={8} borderRadius="small" />
            ))}
          </View>
          
          {/* Stats Section skeleton */}
          <View direction="column" gap={4}>
            <Skeleton width={12} height={4} borderRadius="medium" />
            <View direction="row" wrap={true} gap={8} justify="space-between">
              {[1, 2, 3, 4].map((i) => (
                <View key={i} direction="column" gap={2} width={20}>
                  <Skeleton width={8} height={2} borderRadius="medium" />
                  <Skeleton width={12} height={3} borderRadius="medium" />
                </View>
              ))}
            </View>
          </View>
        </View>
        
        {/* Swap Interface skeleton */}
        <View attributes={{ style: { flex: '2', width: '100%' } }}>
          <View height={100} width="100%">
            <Skeleton height="100%" width="100%" borderRadius="medium" />
          </View>
        </View>
      </View>
    </View>
  )
}

// Helper function to render error views
function ErrorView({ message }: { message: string }) {
  return (
    <View padding={8} direction="column" gap={4} align="center">
      <Text variant="featured-1" weight="medium" color="critical">Invalid Token Address</Text>
      <Text>{message}</Text>
    </View>
  );
}

export default function TokenPage({ params }: { params: { address: string } }) {
  // Basic validation at the page level
  if (!params.address) {
    return <ErrorView message="Token address is missing" />;
  }
  
  // Normalize the address
  const normalizedAddress = params.address.toLowerCase();
  
  // Validate the address format
  if (!isAddress(normalizedAddress)) {
    return <ErrorView message={`The address "${params.address}" is not a valid Ethereum address.`} />;
  }
  
  // Render the client-side component with the validated address
  return (
    <Suspense fallback={<TokenDetailSkeleton />}>
      <TokenDetailPageClient tokenAddress={normalizedAddress} />
    </Suspense>
  );
}


