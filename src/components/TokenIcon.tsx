import React from 'react'
import { Image, View } from 'reshaped'
import { useFragment } from 'react-relay'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { tokenFragment } from './TokenPair'

export interface TokenIconProps {
  token: TokenPairFragment$key | any
  size?: 'small' | 'large'
}

// Default fallback images if token not found
const DEFAULT_TOKEN_ICON = '/tokens/coin.svg'
const NATIVE_KUB_ICON = '/tokens/bitkub.png'

// Helper to determine if an object has the proper fragment reference
function hasFragmentReference(obj: any): boolean {
  return obj && 
         typeof obj === 'object' && 
         obj[' $fragmentSpreads'] && 
         obj[' $fragmentSpreads'].TokenPairFragment === true;
}

// Helper to extract data from a token, whether it's a fragment or plain object
function extractTokenData(token: any): { 
  address: string, 
  symbol: string, 
  name: string, 
  imageUri: string 
} {
  if (!token) {
    return { address: '', symbol: 'Unknown', name: 'Unknown Token', imageUri: '' };
  }
  
  // If it's a plain object (not a fragment), extract data directly
  if (!hasFragmentReference(token)) {
    return {
      address: token.address || '',
      symbol: token.symbol || 'Unknown',
      name: token.name || 'Unknown Token',
      imageUri: token.imageUri || ''
    };
  }
  
  // Otherwise return placeholder data that will be overridden by the fragment
  return { address: '', symbol: 'Unknown', name: 'Unknown Token', imageUri: '' };
}

export const TokenIcon: React.FC<TokenIconProps> = ({
  token,
  size = 'small',
}) => {
  // Check if token data has fragment spreads for TokenPairFragment
  const hasTokenFragment = hasFragmentReference(token);
  
  // Extract basic data if fragments aren't available
  const tokenBasicData = extractTokenData(token);

  // Only use the fragment hook if the fragment reference exists
  const tokenData = hasTokenFragment
    ? useFragment<TokenPairFragment$key>(tokenFragment, token)
    : tokenBasicData;

  // Check if the token is native KUB (address 0x0...)
  const isTokenNative = tokenData.address === '0x0000000000000000000000000000000000000000'

  // Determine token display information
  const tokenDisplay = {
    icon: isTokenNative
      ? NATIVE_KUB_ICON
      : getIpfsGateway(tokenData.imageUri || '') || DEFAULT_TOKEN_ICON,
    alt: isTokenNative ? 'Native KUB' : tokenData.symbol || 'Unknown Token',
  }

  return (
    <View>
      <Image
        src={tokenDisplay.icon}
        height={size === 'small' ? 7 : 9}
        width={size === 'small' ? 7 : 9}
        alt={tokenDisplay.alt}
        attributes={{ style: { borderRadius: '50%' } }}
      />
    </View>
  )
} 