'use client'

import React from 'react'
import { View, Text } from 'reshaped'
import Link from 'next/link'
import { useFragment, graphql } from 'react-relay'
import { InlineTokenSwapFragment$key } from '@/src/__generated__/InlineTokenSwapFragment.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

export const inlineTokenSwapFragment = graphql`
  fragment InlineTokenSwapFragment on Token {
    id
    address
    symbol
    imageUri
  }
`

interface InlineTokenSwapProps {
  fromToken: InlineTokenSwapFragment$key;
  toToken: InlineTokenSwapFragment$key;
  variant?: 'body-1' | 'body-2' | 'body-3';
}

const DEFAULT_TOKEN_ICON = '/tokens/coin.svg'
const NATIVE_KUB_ICON = '/tokens/bitkub.png'

/**
 * Displays an inline swap description with token symbols and icons
 * Format: "Swap [TOKEN0] [icon] for [TOKEN1] [icon]"
 */
export const InlineTokenSwap: React.FC<InlineTokenSwapProps> = ({
  fromToken,
  toToken,
  variant = 'body-3'
}) => {
  const fromTokenData = useFragment<InlineTokenSwapFragment$key>(inlineTokenSwapFragment, fromToken)
  const toTokenData = useFragment<InlineTokenSwapFragment$key>(inlineTokenSwapFragment, toToken)

  const fromSymbol = fromTokenData.symbol || '?'
  const toSymbol = toTokenData.symbol || '?'

  // Check if tokens are native KUB
  const isFromNative = fromTokenData.address === '0x0000000000000000000000000000000000000000'
  const isToNative = toTokenData.address === '0x0000000000000000000000000000000000000000'

  // Get token icon URLs
  const fromIcon = isFromNative
    ? NATIVE_KUB_ICON
    : getIpfsGateway(fromTokenData.imageUri || '') || DEFAULT_TOKEN_ICON

  const toIcon = isToNative
    ? NATIVE_KUB_ICON
    : getIpfsGateway(toTokenData.imageUri || '') || DEFAULT_TOKEN_ICON

  return (
    <View direction="row" align="center" gap={1} style={{ flexWrap: 'wrap' }}>
      <Text variant={variant}>Swap</Text>

      <Link href={`/explore/tokens/${fromTokenData.address}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'inherit' }}>
        <Text variant={variant} weight="bold">{fromSymbol}</Text>
        <img
          src={fromIcon}
          alt={fromSymbol}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_TOKEN_ICON
          }}
        />
      </Link>

      <Text variant={variant}>for</Text>

      <Link href={`/explore/tokens/${toTokenData.address}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'inherit' }}>
        <Text variant={variant} weight="bold">{toSymbol}</Text>
        <img
          src={toIcon}
          alt={toSymbol}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_TOKEN_ICON
          }}
        />
      </Link>
    </View>
  )
}