'use client'

import React from 'react'
import { View, Text } from 'reshaped'
import Link from 'next/link'
import { useFragment, graphql } from 'react-relay'
import { TokenAmountFragment$key } from '@/src/__generated__/TokenAmountFragment.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

export const tokenAmountFragment = graphql`
  fragment TokenAmountFragment on Token {
    id
    address
    symbol
    imageUri
  }
`

interface TokenAmountProps {
  token: TokenAmountFragment$key;
  amount: string;
  variant?: 'body-1' | 'body-2' | 'body-3';
}

const DEFAULT_TOKEN_ICON = '/tokens/coin.svg'
const NATIVE_KUB_ICON = '/tokens/bitkub.png'

/**
 * Displays a token amount with icon
 * Format: "[icon] [amount] [SYMBOL]"
 */
export const TokenAmount: React.FC<TokenAmountProps> = ({
  token,
  amount,
  variant = 'body-3'
}) => {
  const tokenData = useFragment<TokenAmountFragment$key>(tokenAmountFragment, token)

  const symbol = tokenData.symbol || '?'

  // Check if token is native KUB
  const isNative = tokenData.address === '0x0000000000000000000000000000000000000000'

  // Get token icon URL
  const icon = isNative
    ? NATIVE_KUB_ICON
    : getIpfsGateway(tokenData.imageUri || '') || DEFAULT_TOKEN_ICON

  return (
    <View direction="row" align="center" gap={1}>
      <Text variant={variant}>{amount}</Text>
      <Link href={`/explore/tokens/${tokenData.address}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'inherit' }}>
        <Text variant={variant} weight="bold">{symbol}</Text>
        <img
          src={icon}
          alt={symbol}
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