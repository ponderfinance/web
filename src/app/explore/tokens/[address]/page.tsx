'use client'

import { Suspense } from 'react'
import { View, Text } from 'reshaped'
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

// Loading skeleton for better UX
function TokenDetailSkeleton() {
  return (
    <View direction="column" gap={6} width="100%">
      {/* Header skeleton */}
      <View direction="row" align="center" gap={3} height={4}>
        <View width={12} height={2} attributes={{
          style: { backgroundColor: 'rgba(120, 120, 120, 0.2)', borderRadius: 4 }
        }} />
      </View>
      
      {/* Token info skeleton */}
      <View direction="row" align="center" gap={3} height={10}>
        <View width={10} height={10} attributes={{
          style: { backgroundColor: 'rgba(120, 120, 120, 0.2)', borderRadius: '50%' }
        }} />
        <View width={20} height={4} attributes={{
          style: { backgroundColor: 'rgba(120, 120, 120, 0.2)', borderRadius: 4 }
        }} />
      </View>
      
      {/* Chart skeleton */}
      <View height={400} width="100%" attributes={{
        style: {
          backgroundColor: 'rgba(120, 120, 120, 0.1)',
          borderRadius: 4
        }
      }} />
      
      {/* Stats skeleton */}
      <View direction="column" gap={4}>
        <View width={12} height={4} attributes={{
          style: { backgroundColor: 'rgba(120, 120, 120, 0.2)', borderRadius: 4 }
        }} />
        <View direction="row" wrap={true} gap={6} justify="space-between">
          {[1, 2, 3, 4].map((i) => (
            <View key={i} direction="column" gap={2} width={80}>
              <View width={12} height={2} attributes={{
                style: { backgroundColor: 'rgba(120, 120, 120, 0.2)', borderRadius: 4 }
              }} />
              <View width={20} height={3} attributes={{
                style: { backgroundColor: 'rgba(120, 120, 120, 0.2)', borderRadius: 4 }
              }} />
            </View>
          ))}
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


