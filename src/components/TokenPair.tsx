import React from 'react'
import { View, Text, Image } from 'reshaped'
import { graphql, useFragment } from 'react-relay'
import { shortenAddress } from '@/src/utils/numbers'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'

interface TokenPairProps {
  tokenA?: TokenPairFragment$key | null
  tokenB?: TokenPairFragment$key | null
  tokenAddressA?: `0x${string}`
  tokenAddressB?: `0x${string}`
  size?: 'small' | 'large'
}

export const getIpfsGateway = (uri: string): string => {
  return uri?.replace('ipfs://', 'https://lucidhaus.infura-ipfs.io/ipfs/')
}

export const tokenFragment = graphql`
  fragment TokenPairFragment on Token {
    id
    address
    name
    symbol
    decimals
    imageURI
  }
`

// Default fallback images if token not found
const DEFAULT_TOKEN_ICON = '/tokens/coin.svg'
const NATIVE_KUB_ICON = '/tokens/bitkub.png'

export const TokenPair: React.FC<TokenPairProps> = ({
  tokenA,
  tokenB,
  tokenAddressA,
  tokenAddressB,
  size = 'small',
}) => {
  // Check if the tokens are native KUB (address 0x0...)
  const isTokenANative = tokenAddressA === '0x0000000000000000000000000000000000000000'
  const isTokenBNative = tokenAddressB === '0x0000000000000000000000000000000000000000'

  // Use the fragment for pre-loaded token data
  const tokenAData = tokenA
    ? useFragment<TokenPairFragment$key>(tokenFragment, tokenA)
    : null
  const tokenBData = tokenB
    ? useFragment<TokenPairFragment$key>(tokenFragment, tokenB)
    : null

  // Determine first token display information
  const firstTokenDisplay = {
    symbol: isTokenANative
      ? 'KUB'
      : tokenAData?.symbol || (tokenAddressA ? shortenAddress(tokenAddressA) : 'Token A'),
    icon: isTokenANative
      ? NATIVE_KUB_ICON
      : getIpfsGateway(tokenAData?.imageURI || '') || DEFAULT_TOKEN_ICON,
  }

  // Determine second token display information
  const secondTokenDisplay = {
    symbol: isTokenBNative
      ? 'KUB'
      : tokenBData?.symbol || (tokenAddressB ? shortenAddress(tokenAddressB) : 'Token B'),
    icon: isTokenBNative
      ? NATIVE_KUB_ICON
      : getIpfsGateway(tokenBData?.imageURI || '') || DEFAULT_TOKEN_ICON,
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
              attributes={{
                style: {
                  zIndex: 1,
                },
              }}
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
        <Text variant="body-1">
          {firstTokenDisplay.symbol} / {secondTokenDisplay.symbol}
        </Text>
      </View>
    </View>
  )
}
