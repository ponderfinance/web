import React, { createContext, useContext, useState, useEffect } from 'react'
import { useLazyLoadQuery, graphql } from 'react-relay'
import { type Address } from 'viem'
import { TokenDataContextQuery } from '@/src/__generated__/TokenDataContextQuery.graphql'

// GraphQL query to fetch single token data
const tokenDataQuery = graphql`
  query TokenDataContextQuery($address: String!) {
    token: tokenByAddress(address: $address) {
      id
      address
      name
      symbol
      decimals
      imageURI
    }
  }
`

interface TokenData {
  id: string
  address: string
  name: string | null
  symbol: string | null
  decimals: number | null
  imageURI: string | null
}

interface TokenDataContextType {
  getTokenData: (address: Address) => TokenData | null
  prefetchTokens: (addresses: Address[]) => void
}

const TokenDataContext = createContext<TokenDataContextType | null>(null)

export const useTokenData = () => {
  const context = useContext(TokenDataContext)
  if (!context) {
    throw new Error('useTokenData must be used within a TokenDataProvider')
  }
  return context
}

interface TokenDataProviderProps {
  children: React.ReactNode
}

export const TokenDataProvider: React.FC<TokenDataProviderProps> = ({ children }) => {
  const [tokenCache, setTokenCache] = useState<Map<string, TokenData>>(new Map())
  const [addressesToFetch, setAddressesToFetch] = useState<Address[]>([])

  // Native KUB data
  const nativeKubData: TokenData = {
    id: 'native-kub',
    address: '0x0000000000000000000000000000000000000000',
    name: 'Native KUB',
    symbol: 'KUB',
    decimals: 18,
    imageURI: '/tokens/bitkub.png'
  }

  const getTokenData = (address: Address): TokenData | null => {
    // Handle native KUB
    if (address.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      return nativeKubData
    }

    // Return cached data if available
    return tokenCache.get(address.toLowerCase()) || null
  }

  const prefetchTokens = (addresses: Address[]) => {
    const uncachedAddresses = addresses.filter(addr => {
      const normalized = addr.toLowerCase()
      return normalized !== '0x0000000000000000000000000000000000000000' && 
             !tokenCache.has(normalized)
    })

    if (uncachedAddresses.length > 0) {
      setAddressesToFetch(prev => {
        const newAddresses = uncachedAddresses.filter(addr => !prev.includes(addr))
        return newAddresses.length > 0 ? [...prev, ...newAddresses] : prev
      })
    }
  }

  const value: TokenDataContextType = {
    getTokenData,
    prefetchTokens
  }

  return (
    <TokenDataContext.Provider value={value}>
      {addressesToFetch.map(address => (
        <TokenDataFetcher 
          key={address}
          address={address} 
          onDataFetched={(token) => {
            if (token) {
              setTokenCache(prev => new Map(prev).set(token.address.toLowerCase(), token))
            }
            setAddressesToFetch(prev => prev.filter(addr => addr !== address))
          }}
        />
      ))}
      {children}
    </TokenDataContext.Provider>
  )
}

// Separate component to handle the Relay query for individual tokens
const TokenDataFetcher: React.FC<{
  address: Address
  onDataFetched: (data: TokenData | null) => void
}> = ({ address, onDataFetched }) => {
  const data = useLazyLoadQuery<TokenDataContextQuery>(tokenDataQuery, {
    address: address.toLowerCase()
  }, { fetchPolicy: 'store-or-network' })

  useEffect(() => {
    onDataFetched(data.token as TokenData | null)
  }, [data.token, onDataFetched])

  return null // This component doesn't render anything
} 