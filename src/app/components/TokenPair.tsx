import React from 'react'
import { View, Text } from 'reshaped'
import Image from 'next/image'
import { CURRENT_CHAIN } from '@/src/app/constants/chains'
import { KKUB_ADDRESS, KOI_ADDRESS } from '@/src/app/constants/addresses'
import { shortenAddress } from '@/src/app/utils/numbers'
import { useTokenInfo } from '@ponderfinance/sdk'

// Token interfaces
interface Token {
  name: string
  symbol: string
  address: `0x${string}`
  icon: string
  isNative?: boolean
}

// Component props interface
interface TokenPairProps {
  tokenAddressA?: `0x${string}`
  tokenAddressB?: `0x${string}`
  size?: 'small' | 'large'
}

// Default token list with chain-specific addresses
const tokenData: Token[] = [
  {
    name: 'KOI',
    symbol: 'KOI',
    address: KOI_ADDRESS[CURRENT_CHAIN.id],
    icon: '/tokens/xkoi.png',
  },
  {
    name: 'Bitkub Coin',
    symbol: 'KUB',
    address: '0x0000000000000000000000000000000000000000',
    icon: '/tokens/bitkub.png',
    isNative: true,
  },
  {
    name: 'Wrapped Bitkub Coin',
    symbol: 'KKUB',
    address: KKUB_ADDRESS[CURRENT_CHAIN.id],
    icon: '/tokens/bitkub.png',
  },
  {
    name: 'Bitkub-Peg USDT',
    symbol: 'USDT',
    address: "0x7d984C24d2499D840eB3b7016077164e15E5faA6",
    icon: '/tokens/usdt.png',
  },
]

// Function to find token in our predefined list
const findTokenInList = (address?: `0x${string}`): Token | null => {
  if (!address) return null

  // Normalize addresses for comparison (case-insensitive)
  const normalizedAddress = address.toLowerCase()
  const token = tokenData.find(
    (token) => token.address.toLowerCase() === normalizedAddress
  )

  return token || null
}

// Default addresses if none provided
const DEFAULT_TOKEN_A = KOI_ADDRESS[CURRENT_CHAIN.id]
const DEFAULT_TOKEN_B = KKUB_ADDRESS[CURRENT_CHAIN.id]

export const TokenPair: React.FC<TokenPairProps> = ({
  tokenAddressA,
  tokenAddressB,
  size = 'small',
}) => {
  // For native KUB handling
  const isTokenANative = tokenAddressA === '0x0000000000000000000000000000000000000000'
  const isTokenBNative = tokenAddressB === '0x0000000000000000000000000000000000000000'

  // Use token info hooks for non-native tokens
  const { data: tokenAInfo } = useTokenInfo(
    isTokenANative ? (null as unknown as `0x${string}`) : (tokenAddressA as `0x${string}`)
  )
  const { data: tokenBInfo } = useTokenInfo(
    isTokenBNative ? (null as unknown as `0x${string}`) : (tokenAddressB as `0x${string}`)
  )

  // Find predefined tokens by address
  const firstListToken = findTokenInList(tokenAddressA || DEFAULT_TOKEN_A)
  const secondListToken = findTokenInList(tokenAddressB || DEFAULT_TOKEN_B)

  // Determine final token display info by combining predefined list and token info from hook
  const firstTokenDisplay = {
    symbol: isTokenANative
      ? 'KUB'
      : tokenAInfo?.symbol ||
        firstListToken?.symbol ||
        (tokenAddressA ? shortenAddress(tokenAddressA) : 'Token A'),
    icon: firstListToken?.icon || '/tokens/coin.svg',
  }

  const secondTokenDisplay = {
    symbol: isTokenBNative
      ? 'KUB'
      : tokenBInfo?.symbol ||
        secondListToken?.symbol ||
        (tokenAddressB ? shortenAddress(tokenAddressB) : 'Token B'),
    icon: secondListToken?.icon || '/tokens/coin.svg',
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
                height={size === 'small' ? 32 : 44}
                width={size === 'small' ? 32 : 44}
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
                height={size === 'small' ? 32 : 44}
                width={size === 'small' ? 32 : 44}
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

export default TokenPair
