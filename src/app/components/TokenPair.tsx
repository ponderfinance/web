import React from 'react'
import { View, Text } from 'reshaped'
import Image from 'next/image'

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
}

// Token data from your original code
const tokenData: Token[] = [
  {
    name: 'KOI',
    symbol: 'KOI',
    address: '0x33C9B02596d7b1CB4066cC2CeEdd37f3A7c7Aa07',
    icon: '/tokens/xkoi.png',
  },
  {
    name: 'Wrapped Bitkub',
    symbol: 'KKUB',
    address: '0xBa71efd94be63bD47B78eF458DE982fE29f552f7',
    icon: '/tokens/bitkub.png',
  },
]

// Function to find token by address
const findTokenByAddress = (address?: `0x${string}`): Token | null => {
  if (!address) return null

  // Normalize addresses for comparison (case-insensitive)
  const normalizedAddress = address.toLowerCase()
  return (
    tokenData.find((token) => token.address.toLowerCase() === normalizedAddress) || null
  )
}

// Default addresses if none provided
const DEFAULT_TOKEN_A = '0x33C9B02596d7b1CB4066cC2CeEdd37f3A7c7Aa07' as `0x${string}` // KOI
const DEFAULT_TOKEN_B = '0xBa71efd94be63bD47B78eF458DE982fE29f552f7' as `0x${string}` // Native KUB

export const TokenPair: React.FC<TokenPairProps> = ({ tokenAddressA, tokenAddressB }) => {
  // Find tokens by address
  const firstToken = findTokenByAddress(tokenAddressA || DEFAULT_TOKEN_A)
  const secondToken = findTokenByAddress(tokenAddressB || DEFAULT_TOKEN_B)

  // Fallbacks if tokens not found
  const firstTokenDisplay = firstToken || {
    symbol: 'KOI',
    icon: '/tokens/xkoi.png',
  }

  const secondTokenDisplay = secondToken || {
    symbol: 'KUB',
    icon: '/tokens/bitkub.png',
  }

  return (
    <View>
      <View direction="row" align="center" gap={2}>
        <View position="relative">
          <View height={8} width={8} overflow="hidden" insetStart={-4.25}>
            <View
              position="absolute"
              insetTop={0}
              insetEnd={-4}
              attributes={{ style: { zIndex: 2 } }}
              overflow="hidden"
              borderRadius="circular"
              height={8}
              width={8}
            >
              <Image
                src={firstTokenDisplay.icon}
                height={32}
                width={32}
                alt={firstTokenDisplay.symbol}
              />
            </View>
          </View>
          <View
            height={8}
            width={8}
            overflow="hidden"
            insetEnd={-4.25}
            insetTop={0}
            position="absolute"
          >
            <View
              position="absolute"
              insetTop={0}
              insetStart={-4}
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
                height={32}
                width={32}
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
