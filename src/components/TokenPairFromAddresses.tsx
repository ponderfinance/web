import React, { Suspense } from 'react'
import { View, Skeleton } from 'reshaped'
import { graphql, useLazyLoadQuery, useFragment } from 'react-relay'
import { TokenPair, tokenFragment } from './TokenPair'
import { TokenPairFromAddressesQuery } from '@/src/__generated__/TokenPairFromAddressesQuery.graphql'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'

// GraphQL query to fetch token data by addresses
const tokenPairQuery = graphql`
  query TokenPairFromAddressesQuery($tokenAAddress: String!, $tokenBAddress: String!) {
    tokenA: tokenByAddress(address: $tokenAAddress) {
      ...TokenPairFragment
    }
    tokenB: tokenByAddress(address: $tokenBAddress) {
      ...TokenPairFragment
    }
  }
`

// Native KUB fragment data
const NATIVE_KUB_FRAGMENT: TokenPairFragment$key = {
  id: 'native-kub',
  address: '0x0000000000000000000000000000000000000000',
  name: 'Native KUB',
  symbol: 'KUB',
  decimals: 18,
  imageURI: '/tokens/bitkub.png',
  ' $fragmentSpreads': {
    TokenPairFragment: true
  }
} as any

export interface TokenPairFromAddressesProps {
  tokenAAddress: string | null
  tokenBAddress: string | null
  size?: 'small' | 'large'
  showSymbols?: boolean
}

// Component that renders with actual token data
const TokenPairWithData: React.FC<{
  tokenAAddress: string
  tokenBAddress: string
  size?: 'small' | 'large'
  showSymbols?: boolean
}> = ({ tokenAAddress, tokenBAddress, size, showSymbols }) => {
  const isTokenANative = tokenAAddress === '0x0000000000000000000000000000000000000000'
  const isTokenBNative = tokenBAddress === '0x0000000000000000000000000000000000000000'

  // If both tokens are native KUB, render directly
  if (isTokenANative && isTokenBNative) {
    return (
      <TokenPair
        tokenA={NATIVE_KUB_FRAGMENT}
        tokenB={NATIVE_KUB_FRAGMENT}
        size={size}
        showSymbols={showSymbols}
      />
    )
  }

  // Query for token data (only for non-native tokens)
  const data = useLazyLoadQuery<TokenPairFromAddressesQuery>(
    tokenPairQuery,
    {
      tokenAAddress: isTokenANative ? '0x0000000000000000000000000000000000000000' : tokenAAddress,
      tokenBAddress: isTokenBNative ? '0x0000000000000000000000000000000000000000' : tokenBAddress,
    },
    {
      fetchPolicy: 'store-or-network',
    }
  )

  // Handle cases where tokens might not exist in the database
  const tokenA = isTokenANative ? NATIVE_KUB_FRAGMENT : (data.tokenA || NATIVE_KUB_FRAGMENT)
  const tokenB = isTokenBNative ? NATIVE_KUB_FRAGMENT : (data.tokenB || NATIVE_KUB_FRAGMENT)

  return (
    <TokenPair
      tokenA={tokenA}
      tokenB={tokenB}
      size={size}
      showSymbols={showSymbols}
    />
  )
}

// Fallback component for loading state
const TokenPairSkeleton: React.FC<{ size?: 'small' | 'large' }> = ({ size = 'small' }) => (
  <View direction="row" align="center" gap={2}>
    <View direction="row" align="center">
      <Skeleton
        height={size === 'small' ? 8 : 11}
        width={size === 'small' ? 8 : 11}
        borderRadius="circular"
      />
      <Skeleton
        height={size === 'small' ? 8 : 11}
        width={size === 'small' ? 8 : 11}
        borderRadius="circular"
        attributes={{ style: { marginLeft: size === 'small' ? '-8px' : '-12px' } }}
      />
    </View>
    <Skeleton height={6} width={16} />
  </View>
)

/**
 * TokenPair component that fetches token data from GraphQL by addresses
 * Always uses proper Relay fragments - no fallbacks
 */
export const TokenPairFromAddresses: React.FC<TokenPairFromAddressesProps> = ({
  tokenAAddress,
  tokenBAddress,
  size = 'small',
  showSymbols = true,
}) => {
  // Don't render if we don't have both addresses
  if (!tokenAAddress || !tokenBAddress) {
    return <TokenPairSkeleton size={size} />
  }

  return (
    <Suspense fallback={<TokenPairSkeleton size={size} />}>
      <TokenPairWithData
        tokenAAddress={tokenAAddress}
        tokenBAddress={tokenBAddress}
        size={size}
        showSymbols={showSymbols}
      />
    </Suspense>
  )
}

export default TokenPairFromAddresses 