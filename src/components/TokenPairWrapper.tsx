import React, { Suspense, useState, useEffect } from 'react'
import { View } from 'reshaped'
import { TokenPair, TokenPairProps } from './TokenPair'
import { useTokenPairData, useMultipleTokenPairData } from '@/src/hooks/useTokenPairData'

export interface TokenPairWrapperProps {
  tokenAAddress: string | null
  tokenBAddress: string | null
  size?: 'small' | 'large'
  showSymbols?: boolean
  fallback?: React.ReactNode
}

/**
 * A wrapper component that prepares token data and renders the TokenPair component
 * This component handles the data fetching and provides a fallback during loading
 */
export const TokenPairWrapper: React.FC<TokenPairWrapperProps> = ({
  tokenAAddress,
  tokenBAddress,
  size = 'small',
  showSymbols = true,
  fallback = <View height={size === 'small' ? 8 : 11} width={size === 'small' ? 8 : 11} />,
}) => {
  const { tokenAFragment, tokenBFragment, isLoading } = useTokenPairData(
    tokenAAddress,
    tokenBAddress
  )
  
  // Track if we've ever successfully loaded the data
  const [hasLoaded, setHasLoaded] = useState(false)
  
  // Update hasLoaded when we successfully get both fragments
  useEffect(() => {
    if (!isLoading && tokenAFragment && tokenBFragment) {
      setHasLoaded(true)
    }
  }, [isLoading, tokenAFragment, tokenBFragment])

  // If we've never successfully loaded the data, show the fallback
  if (!hasLoaded || !tokenAFragment || !tokenBFragment) {
    return <>{fallback}</>
  }

  // Render the TokenPair component with the prepared fragments
  return (
    <Suspense fallback={fallback}>
      <TokenPair
        tokenA={tokenAFragment}
        tokenB={tokenBFragment}
        size={size}
        showSymbols={showSymbols}
      />
    </Suspense>
  )
}

/**
 * A component that renders multiple TokenPair components
 * This is useful when you need to render multiple TokenPair components with the same tokens
 */
export interface MultipleTokenPairWrapperProps {
  tokenPairs: Array<{ tokenA: string | null, tokenB: string | null }>
  size?: 'small' | 'large'
  showSymbols?: boolean
  fallback?: React.ReactNode
  renderItem?: (props: TokenPairProps, index: number) => React.ReactNode
}

export const MultipleTokenPairWrapper: React.FC<MultipleTokenPairWrapperProps> = ({
  tokenPairs,
  size = 'small',
  showSymbols = true,
  fallback = <View height={size === 'small' ? 8 : 11} width={size === 'small' ? 8 : 11} />,
  renderItem,
}) => {
  const { tokenFragments, isLoading } = useMultipleTokenPairData(tokenPairs)
  
  // Track if we've ever successfully loaded the data
  const [hasLoaded, setHasLoaded] = useState(false)
  
  // Update hasLoaded when we successfully get all fragments
  useEffect(() => {
    if (!isLoading) {
      // Check if all pairs have both fragments
      const allPairsLoaded = tokenPairs.every((_, index) => {
        const pairKey = `pair-${index}`
        const { tokenAFragment, tokenBFragment } = tokenFragments[pairKey] || {}
        return tokenAFragment && tokenBFragment
      })
      
      if (allPairsLoaded) {
        setHasLoaded(true)
      }
    }
  }, [isLoading, tokenFragments, tokenPairs])

  // If we've never successfully loaded the data, show the fallback
  if (!hasLoaded) {
    return <>{fallback}</>
  }

  // Render the TokenPair components with the prepared fragments
  return (
    <Suspense fallback={fallback}>
      {tokenPairs.map((_, index) => {
        const pairKey = `pair-${index}`
        const { tokenAFragment, tokenBFragment } = tokenFragments[pairKey] || {}

        // If we don't have both fragments, show the fallback
        if (!tokenAFragment || !tokenBFragment) {
          return <React.Fragment key={pairKey}>{fallback}</React.Fragment>
        }

        // If a custom render function is provided, use it
        if (renderItem) {
          return renderItem(
            {
              tokenA: tokenAFragment,
              tokenB: tokenBFragment,
              size,
              showSymbols,
            },
            index
          )
        }

        // Otherwise, render the default TokenPair component
        return (
          <TokenPair
            key={pairKey}
            tokenA={tokenAFragment}
            tokenB={tokenBFragment}
            size={size}
            showSymbols={showSymbols}
          />
        )
      })}
    </Suspense>
  )
} 