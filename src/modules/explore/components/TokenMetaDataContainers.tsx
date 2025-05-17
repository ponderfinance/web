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
    <View 
      direction="column" 
      gap={0} 
      width="100%"
      borderRadius="medium"
      backgroundColor="elevation-base"
      borderColor="neutral-faded"
      overflow="hidden"
    >
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        paddingInline={4}
        paddingBlock={2}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
        width="100%"
      >
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Time
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Type
          </Text>
        </View.Item>

        <View.Item columns={4}>
          <Text color="neutral-faded" weight="medium">
            Token Pair
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Value
          </Text>
        </View.Item>
      </View>

      {/* Skeleton Rows */}
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          direction="row"
          gap={0}
          paddingInline={4}
          paddingBlock={3}
          className={'border-0 border-b border-neutral-faded'}
          align="center"
          width="100%"
        >
          <View.Item columns={2}>
            <Skeleton width={80} height={20} />
          </View.Item>

          <View.Item columns={1}>
            <Skeleton width={60} height={20} />
          </View.Item>

          <View.Item columns={4}>
            <View direction="row" align="center" gap={2}>
              <Skeleton width={24} height={24} borderRadius="circular" />
              <Skeleton width={24} height={24} borderRadius="circular" />
              <Skeleton width={80} height={20} />
            </View>
          </View.Item>

          <View.Item columns={1}>
            <Skeleton width={60} height={20} />
          </View.Item>
        </View>
      ))}
    </View>
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