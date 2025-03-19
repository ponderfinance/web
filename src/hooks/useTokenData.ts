// src/hooks/useTokenData.ts
import { Address } from 'viem'
import { useEffect, useState, useMemo } from 'react'
import { fetchQuery, graphql, useRelayEnvironment } from 'react-relay'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'
import { useTokenDataQuery } from '@/src/__generated__/useTokenDataQuery.graphql'

// Updated query to use address parameter directly
const tokenDataQuery = graphql`
  query useTokenDataQuery($address: String!) {
    token(address: $address) {
      ...TokenPairFragment
    }
  }
`

// Token data cache (to avoid duplicate requests)
const tokenCache: Record<string, TokenPairFragment$key> = {}

// Create a synthetic native token object that matches the TokenPairFragment structure
const createNativeTokenFragment = (): TokenPairFragment$key => {
  return {
    __fragments: {
      TokenPairFragment: {
        id: 'native-token',
        address: '0x0000000000000000000000000000000000000000',
        name: 'Native KUB',
        symbol: 'KUB',
        decimals: 18,
        imageURI: '/tokens/bitkub.png',
      },
    },
    __id: 'native-token',
  } as unknown as TokenPairFragment$key
}

// Cache the native token object
const NATIVE_TOKEN_FRAGMENT = createNativeTokenFragment()

export function useTokenData(tokenAddress?: Address | null) {
  const [tokenData, setTokenData] = useState<TokenPairFragment$key | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const environment = useRelayEnvironment()

  useEffect(() => {
    let isMounted = true

    // Handle null or undefined address
    if (!tokenAddress) {
      setTokenData(null)
      return
    }

    // Handle native token (zero address)
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      setTokenData(NATIVE_TOKEN_FRAGMENT)
      return
    }

    // Check the cache first
    const normalizedAddress = tokenAddress.toLowerCase()
    if (tokenCache[normalizedAddress]) {
      setTokenData(tokenCache[normalizedAddress])
      return
    }

    // Fetch token data if not in cache
    setIsLoading(true)

    fetchQuery<useTokenDataQuery>(environment, tokenDataQuery, {
      address: normalizedAddress,
    }).subscribe({
      next: (data) => {
        if (!isMounted) return

        if (data.token) {
          // Store in cache and update state
          tokenCache[normalizedAddress] = data.token
          setTokenData(data.token)
        } else {
          // If token not found, create a placeholder fragment with the address
          const placeholderToken = {
            __fragments: {
              TokenPairFragment: {
                id: normalizedAddress,
                address: normalizedAddress,
                name: null,
                symbol: null,
                decimals: 18,
                imageURI: null,
              },
            },
            __id: normalizedAddress,
          } as unknown as TokenPairFragment$key

          tokenCache[normalizedAddress] = placeholderToken
          setTokenData(placeholderToken)
        }
        setIsLoading(false)
      },
      error: (error: any) => {
        if (!isMounted) return
        console.error('Error fetching token data:', error)

        // On error, still create a placeholder token
        const placeholderToken = {
          __fragments: {
            TokenPairFragment: {
              id: normalizedAddress,
              address: normalizedAddress,
              name: null,
              symbol: null,
              decimals: 18,
              imageURI: null,
            },
          },
          __id: normalizedAddress,
        } as unknown as TokenPairFragment$key

        tokenCache[normalizedAddress] = placeholderToken
        setTokenData(placeholderToken)
        setIsLoading(false)
      },
    })

    return () => {
      isMounted = false
    }
  }, [tokenAddress, environment])

  return { tokenData, isLoading }
}
