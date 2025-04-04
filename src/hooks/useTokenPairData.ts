import { useCallback, useEffect, useState } from 'react'
import { graphql } from 'react-relay'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'

// Default fallback images if token not found
const NATIVE_KUB_ICON = '/tokens/bitkub.png'

// Native KUB address
const NATIVE_KUB_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Creates a synthetic fragment for native KUB token
 */
function createNativeKubFragment(): TokenPairFragment$key {
  return {
    id: 'native-kub',
    address: NATIVE_KUB_ADDRESS,
    name: 'Native KUB',
    symbol: 'KUB',
    decimals: 18,
    imageURI: NATIVE_KUB_ICON,
    ' $fragmentSpreads': {
      TokenPairFragment: true
    }
  } as TokenPairFragment$key
}

/**
 * Hook to prepare token data for TokenPair component
 * This hook can be used at a higher level to fetch token data before rendering the TokenPair
 * 
 * @param tokenAAddress - Address of the first token
 * @param tokenBAddress - Address of the second token
 * @returns Object containing token fragments or null if not loaded
 */
export function useTokenPairData(
  tokenAAddress: string | null,
  tokenBAddress: string | null
) {
  const [tokenAFragment, setTokenAFragment] = useState<TokenPairFragment$key | null>(null)
  const [tokenBFragment, setTokenBFragment] = useState<TokenPairFragment$key | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Function to get token fragment
  const getTokenFragment = useCallback((address: string | null) => {
    if (!address) return null

    // For native KUB, return synthetic fragment
    if (address.toLowerCase() === NATIVE_KUB_ADDRESS) {
      return createNativeKubFragment()
    }

    // For other tokens, we need to fetch the data from the parent component
    // This is a placeholder - the actual implementation would depend on how
    // token data is fetched in your application
    return null
  }, [])

  // Update token fragments when addresses change
  useEffect(() => {
    setIsLoading(true)
    
    const tokenA = getTokenFragment(tokenAAddress)
    const tokenB = getTokenFragment(tokenBAddress)
    
    setTokenAFragment(tokenA)
    setTokenBFragment(tokenB)
    setIsLoading(false)
  }, [tokenAAddress, tokenBAddress, getTokenFragment])

  return {
    tokenAFragment,
    tokenBFragment,
    isLoading
  }
}

/**
 * Hook to prepare token data for multiple TokenPair components
 * This is useful when you need to render multiple TokenPair components with the same tokens
 * 
 * @param tokenPairs - Array of token pair addresses
 * @returns Object containing token fragments for each pair
 */
export function useMultipleTokenPairData(
  tokenPairs: Array<{ tokenA: string | null, tokenB: string | null }>
) {
  const [tokenFragments, setTokenFragments] = useState<Record<string, {
    tokenAFragment: TokenPairFragment$key | null,
    tokenBFragment: TokenPairFragment$key | null
  }>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Function to get token fragment
  const getTokenFragment = useCallback((address: string | null) => {
    if (!address) return null

    // For native KUB, return synthetic fragment
    if (address.toLowerCase() === NATIVE_KUB_ADDRESS) {
      return createNativeKubFragment()
    }

    // For other tokens, we need to fetch the data from the parent component
    // This is a placeholder - the actual implementation would depend on how
    // token data is fetched in your application
    return null
  }, [])

  // Update token fragments when token pairs change
  useEffect(() => {
    setIsLoading(true)
    
    const newTokenFragments: Record<string, {
      tokenAFragment: TokenPairFragment$key | null,
      tokenBFragment: TokenPairFragment$key | null
    }> = {}
    
    tokenPairs.forEach((pair, index) => {
      const pairKey = `pair-${index}`
      const tokenA = getTokenFragment(pair.tokenA)
      const tokenB = getTokenFragment(pair.tokenB)
      
      newTokenFragments[pairKey] = {
        tokenAFragment: tokenA,
        tokenBFragment: tokenB
      }
    })
    
    setTokenFragments(newTokenFragments)
    setIsLoading(false)
  }, [tokenPairs, getTokenFragment])

  return {
    tokenFragments,
    isLoading
  }
} 