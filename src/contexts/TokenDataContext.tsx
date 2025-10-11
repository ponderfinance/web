import React, { createContext, useContext, useState } from 'react'
import { type Address } from 'viem'

interface TokenData {
  id: string
  address: string
  name: string | null
  symbol: string | null
  decimals: number | null
  imageUri: string | null
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

  // Native KUB data
  const nativeKubData: TokenData = {
    id: 'native-kub',
    address: '0x0000000000000000000000000000000000000000',
    name: 'Native KUB',
    symbol: 'KUB',
    decimals: 18,
    imageUri: '/tokens/bitkub.png'
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
    // For now, just store in cache as null to avoid blocking
    // We can implement actual prefetching later if needed
    addresses.forEach(address => {
      const normalized = address.toLowerCase()
      if (normalized !== '0x0000000000000000000000000000000000000000' && 
          !tokenCache.has(normalized)) {
        // Mark as "will fetch" but don't actually fetch yet
        setTokenCache(prev => new Map(prev).set(normalized, null as any))
      }
    })
  }

  const value: TokenDataContextType = {
    getTokenData,
    prefetchTokens
  }

  return (
    <TokenDataContext.Provider value={value}>
      {children}
    </TokenDataContext.Provider>
  )
} 