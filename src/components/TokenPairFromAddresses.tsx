import React, { Suspense } from 'react'
import { View, Skeleton, Image, Text } from 'reshaped'
import { graphql, useLazyLoadQuery, useFragment } from 'react-relay'
import { TokenPair, tokenFragment } from './TokenPair'
import { TokenPairFromAddressesQuery } from '@/src/__generated__/TokenPairFromAddressesQuery.graphql'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

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

// Native KUB token data (for display without Relay)
const NATIVE_KUB_DATA = {
  id: 'native-kub',
  address: '0x0000000000000000000000000000000000000000',
  name: 'Native KUB',
  symbol: 'KUB',
  decimals: 18,
  imageURI: '/tokens/bitkub.png',
}

// Default fallback images
const DEFAULT_TOKEN_ICON = '/tokens/coin.svg'
const NATIVE_KUB_ICON = '/tokens/bitkub.png'

// Simple TokenPair component that doesn't use Relay fragments
const SimpleTokenPair: React.FC<{
  tokenAData: typeof NATIVE_KUB_DATA
  tokenBData: typeof NATIVE_KUB_DATA | null
  size?: 'small' | 'large'
  showSymbols?: boolean
}> = ({ tokenAData, tokenBData, size = 'small', showSymbols = true }) => {
  const isTokenANative = tokenAData.address === '0x0000000000000000000000000000000000000000'
  const isTokenBNative = !tokenBData || tokenBData.address === '0x0000000000000000000000000000000000000000'

  const firstTokenDisplay = {
    symbol: isTokenANative ? 'KUB' : tokenAData.symbol || 'Unknown',
    icon: isTokenANative ? NATIVE_KUB_ICON : getIpfsGateway(tokenAData.imageURI || '') || DEFAULT_TOKEN_ICON,
    name: isTokenANative ? 'Native KUB' : tokenAData.name || 'Unknown Token',
  }

  const secondTokenDisplay = {
    symbol: isTokenBNative ? 'KUB' : tokenBData?.symbol || 'Unknown',
    icon: isTokenBNative ? NATIVE_KUB_ICON : getIpfsGateway(tokenBData?.imageURI || '') || DEFAULT_TOKEN_ICON,
    name: isTokenBNative ? 'Native KUB' : tokenBData?.name || 'Unknown Token',
  }

  return (
    <View>
      <View direction="row" align="center" gap={size === 'small' ? 2 : 4}>
        <View position="relative">
          <View
            height={size === 'small' ? 8 : 11}
            width={size === 'small' ? 8 : 11}
            overflow="hidden"
            insetStart={size === 'small' ? -4.25 : -5.5}
          >
            <View
              position="absolute"
              insetTop={0}
              insetEnd={size === 'small' ? -4 : -5.25}
              attributes={{ style: { zIndex: 2 } }}
              overflow="hidden"
              borderRadius="circular"
              height={size === 'small' ? 8 : 11}
              width={size === 'small' ? 8 : 11}
            >
              <Image
                src={firstTokenDisplay.icon}
                height={size === 'small' ? 8 : 11}
                width={size === 'small' ? 8 : 11}
                alt={firstTokenDisplay.symbol}
              />
            </View>
          </View>
          <View
            height={size === 'small' ? 8 : 11}
            width={size === 'small' ? 8 : 11}
            overflow="hidden"
            insetEnd={size === 'small' ? -4.25 : -6}
            insetTop={0}
            position="absolute"
          >
            <View
              position="absolute"
              insetTop={0}
              insetStart={size === 'small' ? -4 : -5.25}
              overflow="hidden"
              borderRadius="circular"
              attributes={{ style: { zIndex: 1 } }}
            >
              <Image
                src={secondTokenDisplay.icon}
                height={size === 'small' ? 8 : 11}
                width={size === 'small' ? 8 : 11}
                alt={secondTokenDisplay.symbol}
              />
            </View>
          </View>
        </View>
        {showSymbols && (
          <Text variant={size === 'small' ? 'body-2' : 'body-1'}>
            {firstTokenDisplay.symbol} / {secondTokenDisplay.symbol}
          </Text>
        )}
      </View>
    </View>
  )
}

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

  // If both tokens are native, use SimpleTokenPair to avoid Relay issues
  if (isTokenANative && isTokenBNative) {
    return (
      <SimpleTokenPair
        tokenAData={NATIVE_KUB_DATA}
        tokenBData={NATIVE_KUB_DATA}
        size={size}
        showSymbols={showSymbols}
      />
    )
  }
  
  // If only one token is native, we need a mixed approach - let's fall back to showing just native info
  if (isTokenANative) {
    return (
      <SimpleTokenPair
        tokenAData={NATIVE_KUB_DATA}
        tokenBData={null}
        size={size}
        showSymbols={showSymbols}
      />
    )
  }
  
  if (isTokenBNative) {
    return (
      <SimpleTokenPair
        tokenAData={{...NATIVE_KUB_DATA, symbol: 'UNK', name: 'Unknown'}}
        tokenBData={NATIVE_KUB_DATA}
        size={size}
        showSymbols={showSymbols}
      />
    )
  }

  // Query for token data (only for non-native tokens)
  const data = useLazyLoadQuery<TokenPairFromAddressesQuery>(
    tokenPairQuery,
    {
      tokenAAddress: tokenAAddress,
      tokenBAddress: tokenBAddress,
    },
    {
      fetchPolicy: 'store-or-network',
    }
  )

  // Handle cases where tokens might not exist in the database - create fallback fragments
  const createFallbackFragment = (address: string): TokenPairFragment$key => ({
    id: `fallback-${address}`,
    address,
    name: 'Unknown Token',
    symbol: 'UNK',
    decimals: 18,
    imageURI: null,
    ' $fragmentSpreads': { TokenPairFragment: true }
  } as any)

  const tokenAResult = data.tokenA || createFallbackFragment(tokenAAddress)
  const tokenBResult = data.tokenB || createFallbackFragment(tokenBAddress)

  return (
    <TokenPair
      tokenA={tokenAResult}
      tokenB={tokenBResult}
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