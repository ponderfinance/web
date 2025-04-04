import React from 'react'
import { Image, Text, View } from 'reshaped'
import { useFragment, graphql } from 'react-relay'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

export interface TokenPairProps {
  tokenA: TokenPairFragment$key
  tokenB: TokenPairFragment$key
  size?: 'small' | 'large'
  showSymbols?: boolean
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
  size = 'small',
  showSymbols = true,
}) => {
  // Use the fragments to get token data
  const tokenAData = useFragment<TokenPairFragment$key>(tokenFragment, tokenA)
  const tokenBData = useFragment<TokenPairFragment$key>(tokenFragment, tokenB)

  // Check if the tokens are native KUB (address 0x0...)
  const isTokenANative = tokenAData.address === '0x0000000000000000000000000000000000000000'
  const isTokenBNative = tokenBData.address === '0x0000000000000000000000000000000000000000'

  // Determine first token display information
  const firstTokenDisplay = {
    symbol: isTokenANative ? 'KUB' : tokenAData.symbol || 'Unknown',
    icon: isTokenANative
      ? NATIVE_KUB_ICON
      : getIpfsGateway(tokenAData.imageURI || '') || DEFAULT_TOKEN_ICON,
    name: isTokenANative ? 'Native KUB' : tokenAData.name || 'Unknown Token',
  }

  // Determine second token display information
  const secondTokenDisplay = {
    symbol: isTokenBNative ? 'KUB' : tokenBData.symbol || 'Unknown',
    icon: isTokenBNative
      ? NATIVE_KUB_ICON
      : getIpfsGateway(tokenBData.imageURI || '') || DEFAULT_TOKEN_ICON,
    name: isTokenBNative ? 'Native KUB' : tokenBData.name || 'Unknown Token',
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
        {showSymbols && (
          <Text variant={size === 'small' ? 'body-2' : 'body-1'}>
            {firstTokenDisplay.symbol} / {secondTokenDisplay.symbol}
          </Text>
        )}
      </View>
    </View>
  )
}
