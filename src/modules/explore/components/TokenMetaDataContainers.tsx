import React, { Suspense } from 'react'
import { View, Text, Skeleton } from 'reshaped'
import { isAddress } from 'viem'
import TokenPairListContainer from './TokenPairListContainer'
import TokenTxHistoryContainer from './TokenTxHistoryContainer'

type TokenMetaDataContainersProps = {
  tokenAddress: string
}

// Loading skeletons for different sections
const TokenPairsSkeleton = () => (
  <View direction="column" gap={4}>
    <Text variant="title-6">Pairs</Text>
    <Skeleton width="100%" height={200} />
  </View>
)

const TokenTxSkeleton = () => (
  <View direction="column" gap={4}>
    <Text variant="title-6">Transactions</Text>
    <Skeleton width="100%" height={200} />
  </View>
)

// Component to display token metadata sections (pairs and transactions)
export default function TokenMetaDataContainers({ tokenAddress }: TokenMetaDataContainersProps) {
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