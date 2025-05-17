'use client'

import React, { useState, Suspense, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  Button,
  Link,
  Skeleton,
} from 'reshaped'
import { graphql, useLazyLoadQuery, PreloadedQuery, usePreloadedQuery, useQueryLoader } from 'react-relay'
import TokenPriceChartContainer from './TokenPriceChartContainer'
import { TokenDetailContentQuery } from '@/src/__generated__/TokenDetailContentQuery.graphql'
import { TokenDetailContentChartQuery } from '@/src/__generated__/TokenDetailContentChartQuery.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { isAddress } from 'viem'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'
import PriceChart from './PriceChart'
import { SwapInterface } from '@/src/components/Swap'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { formatNumber } from '@/src/utils/numbers'
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate'
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary'

// For the missing constants and utilities, let's define them here
const NATIVE_KUB_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const KKUB_ADDRESS: { [chainId: number]: string } = {
  96: '0x4D4e595d643dc61EA7FCbF37A4c8fc4f38c77Da9', // Mainnet
  25925: '0x67eBD50C7286ae8115D52C057E8e4C8e2c9735A5', // Testnet
}

// Simple implementation of shouldRefresh
function shouldRefresh(key: string, priority = 'normal') {
  // In a real implementation, this would throttle refreshes
  // For now, just return true to allow refreshes
  return true
}

// Simple formatCurrency implementation
function formatCurrency(value: number, options?: { maximumFractionDigits?: number }) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: options?.maximumFractionDigits || 2
  })
  
  return formatter.format(value)
}

// Helper functions for token value formatting
function needsDecimalFormatting(value: any, symbol?: string | null): boolean {
  if (!value) return false
  
  // For certain tokens known to have odd decimals
  if (symbol === 'USDT' || symbol === 'USDC') return true
  
  // Check if the value is a very large number in string form
  const numValue = typeof value === 'string' ? Number(value) : value
  return !isNaN(numValue) && numValue > 1e15
}

function formatBlockchainValue(value: any, decimals: number = 18): number {
  if (!value) return 0
  
  try {
    // Handle string representation of large numbers
    const numValue = typeof value === 'string' ? value : String(value)
    
    // Simple decimal shift for demonstration
    return Number(numValue) / Math.pow(10, decimals)
  } catch (err) {
    console.error('Error formatting blockchain value:', err)
    return 0
  }
}

// Define the Relay fragment - split into two parts
export const TokenDetailQuery = graphql`
  query TokenDetailContentQuery($tokenAddress: String!, $timeframe: String!, $limit: Int!) {
    tokenByAddress(address: $tokenAddress) {
      id
      name
      symbol
      address
      decimals
      priceUSD
      priceChange24h
      volumeUSD24h
      tvl
      marketCap
      fdv
      imageURI
      ...TokenPriceChartContainer_token
    }
    tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {
      ...TokenPriceChartContainer_priceChart
    }
  }
`

// Define a separate query for just the chart data
const ChartDataQuery = graphql`
  query TokenDetailContentChartQuery($tokenAddress: String!, $timeframe: String!, $limit: Int!) {
    tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {
      ...TokenPriceChartContainer_priceChart
    }
  }
`

// ShimmerCSS for loading states
const ShimmerCSS = () => (
  <style jsx global>{`
    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }
    .shimmer {
      animation: shimmer 2s infinite linear;
      background: linear-gradient(to right, rgba(30, 30, 30, 0.2) 8%, rgba(50, 50, 50, 0.5) 18%, rgba(30, 30, 30, 0.2) 33%);
      background-size: 1000px 100%;
    }
  `}</style>
)

// Component to display token icon with loading state
function TokenIcon({ imageURI, name, isLoading }: { imageURI?: string | null, name?: string | null, isLoading: boolean }) {
  if (isLoading) {
    return (
      <View width={8} height={8} overflow="hidden" borderRadius="large">
        <Skeleton width="100%" height="100%" />
    </View>
    )
  }

  // Handle IPFS URI
  const imageSource = imageURI ? getIpfsGateway(imageURI) : undefined

  return (
    <Image
      src={imageSource || `/images/tokens/placeholder.svg`}
      alt={name || 'Token'}
      width={8}
      height={8}
      attributes={{
        style: { borderRadius: '50%' }
      }}
  />
  )
}

// Component to display token name with loading state
function TokenNameDisplay({ 
  name, 
  symbol, 
  address, 
  isLoadingBasic 
}: { 
  name?: string | null, 
  symbol?: string | null, 
  address: string,
  isLoadingBasic: boolean 
}) {
  if (isLoadingBasic) {
    return (
      <View direction="column" gap={2}>
        <Skeleton width={56} height={4} borderRadius="medium" />
        <Skeleton width={12} height={2} borderRadius="medium" />
      </View>
    )
  }

  return (
    <Text variant="featured-1" weight="medium" color="neutral">
      {name || `Unknown Token`} <Text as="span" color="neutral-faded">{symbol || address.slice(0, 8)}</Text>
    </Text>
  )
}

// Component to display price with loading state
function PriceDisplay({ 
  price, 
  priceChange, 
  isLoadingPrice
}: { 
  price?: string | null, 
  priceChange?: number | null,
  isLoadingPrice: boolean
}) {
  const formatTokenPrice = (price: number): string => {
    if (price < 1.00) return formatCurrency(price, { maximumFractionDigits: 6 })
    return formatCurrency(price, { maximumFractionDigits: 2 })
  }

  if (isLoadingPrice) {
    return (
      <View direction="row" align="center" gap={2}>
        <Skeleton width={12} height={4} borderRadius="medium" />
        <Skeleton width={8} height={3} borderRadius="medium" />
      </View>
    )
  }

  const priceNum = price ? parseFloat(price) : 0
  const isPositive = (priceChange || 0) >= 0
  const absoluteChange = Math.abs(priceChange || 0)
  const changeText = `${isPositive ? '+' : '-'}${absoluteChange.toFixed(2)}%`
  const changeColor = isPositive ? 'positive' : 'critical'

  return (
    <View direction="column" gap={1}>
      <Text variant="featured-1" weight="medium" color="neutral">
        {formatTokenPrice(priceNum)}
      </Text>
      <Text variant="body-1" color={changeColor}>
        {changeText}
      </Text>
    </View>
  )
}

// Wrap the component with RelayBoundary and export
export const TokenDetailContentWithRelay = withRelayBoundary(
  ({ tokenAddress, initialTimeframe = '1m' }: { tokenAddress: string, initialTimeframe?: string }) => {
    const [queryRef, loadQuery] = useQueryLoader<TokenDetailContentQuery>(TokenDetailQuery)
    const [currentTimeframe, setCurrentTimeframe] = useState(initialTimeframe)
  
    // Load initial data - only on mount and tokenAddress change
    useEffect(() => {
      loadQuery({
        tokenAddress,
        timeframe: currentTimeframe,
        limit: 100
      })
    }, [tokenAddress, loadQuery]) // Removed currentTimeframe dependency
  
    // This callback only updates the UI state, not trigger a new query
    const handleTimeframeChange = useCallback((timeframe: string) => {
      // Just update the UI state
      setCurrentTimeframe(timeframe)
      // We don't reload the main query here - each component manages its own data
    }, [])
  
    // Show skeleton while waiting for initial data
    if (!queryRef) {
      return <TokenDetailSkeleton />
    }
  
    // Success state with data
    return (
      <Suspense fallback={<TokenDetailSkeleton />}>
        <TokenDetailContent 
          queryRef={queryRef} 
          currentTimeframe={currentTimeframe}
          onTimeframeChange={handleTimeframeChange}
          tokenAddress={tokenAddress}
        />
      </Suspense>
    )
  },
  TokenDetailSkeleton
)

// Token detail skeleton component for better code reuse
function TokenDetailSkeleton() {
  return (
    <View direction="column" gap={6}>
      <View direction="row" align="center" gap={1.5}>
        <Link href="/explore" attributes={{ style: { textDecoration: 'none' } }}>
          <Text variant="body-2" color="neutral-faded">
            Explore
          </Text>
        </Link>
        <Text color="neutral-faded">›</Text>
        <Link href="/explore/tokens" attributes={{ style: { textDecoration: 'none' } }}>
          <Text variant="body-2" color="neutral-faded">
            Tokens
          </Text>
        </Link>
        <Text color="neutral-faded">›</Text>
        <Skeleton width={4} height={0.75} borderRadius="medium" />
      </View>
      
      <View direction="row" justify="space-between" align="center">
        <View direction="row" gap={3} align="center">
          <View width={8} height={8} overflow="hidden" borderRadius="large">
            <Skeleton width="100%" height="100%" />
          </View>
          <Skeleton width={56} height={4} borderRadius="medium" />
        </View>
      </View>
      
      <View direction="row" align="center" gap={2}>
        <Skeleton width={12} height={4} borderRadius="medium" />
        <Skeleton width={8} height={3} borderRadius="medium" />
      </View>
      
      <View direction="row" gap={6} width="100%" justify="space-between">
        <View direction="column" gap={6} attributes={{ 
          style: { flex: '3', width: '100%' } 
        }}>
          <View attributes={{ style: { height: '400px', width: '100%' } }}>
            <Skeleton height="100%" width="100%" borderRadius="small" />
          </View>
          
          <View direction="row" gap={2} justify="start">
            {['1H', '1D', '1W', '1M', '1Y'].map((tf) => (
              <Skeleton key={tf} height={6} width={8} borderRadius="small" />
            ))}
          </View>
          
          <View direction="column" gap={4}>
            <Skeleton width={12} height={4} borderRadius="medium" />
            <View direction="row" wrap={true} gap={8} justify="space-between">
              {[1, 2, 3, 4].map((i) => (
                <View key={i} direction="column" gap={2}>
                  <Skeleton width={8} height={2} borderRadius="medium" />
                  <Skeleton width={12} height={3} borderRadius="medium" />
                </View>
              ))}
            </View>
          </View>
        </View>
        
        <View attributes={{ style: { flex: '2', width: '100%' } }}>
          <View height={100} width="100%">
            <Skeleton height="100%" width="100%" borderRadius="medium" />
          </View>
        </View>
      </View>
    </View>
  )
}

// Main content component
interface TokenDetailContentProps {
  queryRef: PreloadedQuery<TokenDetailContentQuery>
  currentTimeframe: string
  onTimeframeChange: (timeframe: string) => void
  tokenAddress: string
}

function TokenDetailContent({
  queryRef,
  currentTimeframe,
  onTimeframeChange,
  tokenAddress
}: TokenDetailContentProps): JSX.Element {
  const data = usePreloadedQuery(TokenDetailQuery, queryRef)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Format metrics
  const formatLargeNumber = (value: string | null | undefined): string => {
    if (!value) return '$0'
    const formattedNum = parseFloat(value)

    if (formattedNum >= 1e9) {
      return `$${(formattedNum / 1e9).toFixed(1)}B`
    } else if (formattedNum >= 1e6) {
      return `$${(formattedNum / 1e6).toFixed(1)}M`
    } else if (formattedNum >= 1e3) {
      return `$${(formattedNum / 1e3).toFixed(1)}K`
    } else {
      return `$${formattedNum.toFixed(2)}`
    }
  }

  // Determine swap tokens
  const isKKUBPage = data.tokenByAddress?.address.toLowerCase() === KKUB_ADDRESS[CURRENT_CHAIN.id].toLowerCase()

  // Render the token detail UI with the chart container
  return (
    <View direction="column" gap={6}>
      {/* Breadcrumb Navigation */}
      <View direction="row" align="center" gap={1.5}>
        <Link href="/explore" attributes={{ style: { textDecoration: 'none' } }}>
          <Text variant="body-2" color="neutral-faded">
            Explore
          </Text>
        </Link>
        <Text color="neutral-faded">›</Text>
        <Link href="/explore/tokens" attributes={{ style: { textDecoration: 'none' } }}>
          <Text variant="body-2" color="neutral-faded">
            Tokens
          </Text>
        </Link>
        <Text color="neutral-faded">›</Text>
        <Text variant="body-2" color="neutral">
          {data.tokenByAddress?.symbol || data.tokenByAddress?.address.slice(0, 6) || ''}
        </Text>
      </View>

      {/* Token header with logo and name */}
      <View direction="row" justify="space-between" align="center">
        <View direction="row" gap={3} align="center">
          <TokenIcon 
            imageURI={data.tokenByAddress?.imageURI} 
            name={data.tokenByAddress?.name}
            isLoading={false} 
          />
          <View direction="column" gap={2}>
            <TokenNameDisplay 
              name={data.tokenByAddress?.name}
              symbol={data.tokenByAddress?.symbol}
              address={data.tokenByAddress?.address || ''}
              isLoadingBasic={false}
            />
          </View>
        </View>
      </View>

      {/* Price and percent change */}
      <PriceDisplay 
        price={data.tokenByAddress?.priceUSD}
        priceChange={data.tokenByAddress?.priceChange24h}
        isLoadingPrice={false}
      />

      {/* Main content area - use ChartContainer for the chart section */}
      <View 
        direction={isMobile ? "column" : "row"} 
        gap={6}
        width="100%"
        justify="space-between"
      >
        <View
          direction="column"
          gap={6}
          attributes={{ 
            style: { 
              flex: isMobile ? 'auto' : '3',
              width: '100%'
            } 
          }}
        >
          {/* Use our improved chart container with separate Suspense boundary */}
          {data.tokenByAddress ? (
            <SuspenseChartContainer 
              tokenAddress={data.tokenByAddress.address}
              tokenRef={data.tokenByAddress}
              initialTimeframe={currentTimeframe}
              onTimeframeChange={onTimeframeChange}
            />
          ) : (
            <View height={100} align="center" justify="center">
              <Text>No data available</Text>
            </View>
          )}

          {/* Stats Section - now aligned with chart */}
          <View direction="column" gap={4}>
            <Text variant="featured-2" weight="medium" color="neutral">
              Stats
            </Text>
            <View direction="row" wrap={true} gap={8} justify="space-between">
              <View direction="column" gap={1}>
                <Text variant="body-2" color="neutral-faded">
                  TVL
                </Text>
                <Text variant="featured-3" weight="medium" color="neutral">
                  {formatLargeNumber(data.tokenByAddress?.tvl)}
                </Text>
              </View>
              <View direction="column" gap={1}>
                <Text variant="body-2" color="neutral-faded">
                  Market cap
                </Text>
                <Text variant="featured-3" weight="medium" color="neutral">
                  {formatLargeNumber(data.tokenByAddress?.marketCap)}
                </Text>
              </View>
              <View direction="column" gap={1}>
                <Text variant="body-2" color="neutral-faded">
                  FDV
                </Text>
                <Text variant="featured-3" weight="medium" color="neutral">
                  {formatLargeNumber(data.tokenByAddress?.fdv)}
                </Text>
              </View>
              <View direction="column" gap={1}>
                <Text variant="body-2" color="neutral-faded">
                  24h volume
                </Text>
                <Text variant="featured-3" weight="medium" color="neutral">
                  {formatLargeNumber(data.tokenByAddress?.volumeUSD24h)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Swap Interface - on the right side on desktop */}
        <View
          attributes={{ 
            style: { 
              flex: isMobile ? 'auto' : '2',
              width: '100%'
            } 
          }}
        >
          {/* Swap interface with no heading */}
          <SwapInterface
            defaultTokenIn={NATIVE_KUB_ADDRESS as `0x${string}`}
            defaultTokenOut={(!isKKUBPage
              ? data.tokenByAddress?.address?.toLowerCase()
              : KKUB_ADDRESS[CURRENT_CHAIN.id]) as `0x${string}`}
            defaultWidth="100%"
          />
        </View>
      </View>
    </View>
  )
}

// Improved chart container with proper Suspense boundary
function SuspenseChartContainer({
  tokenAddress,
  tokenRef,
  initialTimeframe,
  onTimeframeChange
}: {
  tokenAddress: string
  tokenRef: any
  initialTimeframe: string
  onTimeframeChange: (timeframe: string) => void
}) {
  // This local state controls the timeframe for this chart
  const [currentTimeframe, setCurrentTimeframe] = useState(initialTimeframe)
  
  // Load chart data query
  const [chartQueryRef, loadChartQuery] = useQueryLoader<TokenDetailContentChartQuery>(ChartDataQuery)
  
  // Load chart data on mount and when timeframe changes
  useEffect(() => {
    loadChartQuery({
      tokenAddress,
      timeframe: currentTimeframe,
      limit: 100
    })
  }, [tokenAddress, currentTimeframe, loadChartQuery])
  
  // Handle timeframe button clicks - IMPORTANT: Only updates the chart, not the whole page
  const handleTimeframeChange = (newTimeframe: string, event?: React.SyntheticEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    // Set loading state by updating the local timeframe
    setCurrentTimeframe(newTimeframe)
    
    // Notify parent for UI state synchronization only
    onTimeframeChange(newTimeframe)
  }
  
  // Define brand color for buttons
  const primaryColor = '#94E0FE'
  
  return (
    <View direction="column">
      {/* Chart with Suspense boundary */}
      <View height={100}>
        {chartQueryRef ? (
          <Suspense fallback={<ChartSkeleton />}>
            <ChartContent
              queryRef={chartQueryRef}
              tokenRef={tokenRef}
            />
          </Suspense>
        ) : (
          <ChartSkeleton />
        )}
      </View>

      {/* Timeframe controls - outside of Suspense boundary */}
      <View direction="row" justify="space-between" padding={2} gap={2} attributes={{ style: { marginTop: '8px' } }}>
        <View direction="row" gap={2}>
          {['1h', '1d', '1w', '1m', '1y'].map((tf) => (
            <Button
              key={tf}
              variant={currentTimeframe === tf ? 'solid' : 'ghost'}
              color={currentTimeframe === tf ? 'primary' : 'neutral'}
              onClick={(event) => handleTimeframeChange(tf, event)}
              size="small"
              attributes={{
                style: {
                  backgroundColor: currentTimeframe === tf
                    ? 'rgba(148, 224, 254, 0.2)'
                    : 'transparent',
                  color: currentTimeframe === tf ? primaryColor : '#999999',
                },
              }}
            >
              {tf.toUpperCase()}
            </Button>
          ))}
        </View>
      </View>
    </View>
  )
}

// Chart content component - handles the actual data rendering
function ChartContent({
  queryRef,
  tokenRef
}: {
  queryRef: PreloadedQuery<TokenDetailContentChartQuery>
  tokenRef: any
}) {
  // Load the data with usePreloadedQuery
  const data = usePreloadedQuery(ChartDataQuery, queryRef)
  
  return (
    <TokenPriceChartContainer 
      tokenRef={tokenRef}
      priceChartRef={data.tokenPriceChart}
      initialDisplayType="area"
    />
  )
}

// Define a chart skeleton for loading states
function ChartSkeleton() {
  return (
    <View direction="column" gap={2} height={100}>
      <View grow={true} position="relative">
        <View position="absolute" width="100%" height="100%">
          <View height="100%" width="100%" direction="column" justify="space-between">
     
              
            {/* Chart lines */}
            <View height={0.25} width="100%" backgroundColor="neutral-faded" />
            <View height={0.25} width="100%" backgroundColor="neutral-faded" />
            <View height={0.25} width="100%" backgroundColor="neutral-faded" />
            <View height={0.25} width="100%" backgroundColor="neutral-faded" />
            
            {/* X-axis labels */}
            <View direction="row" width="100%" justify="space-between">
              <Skeleton width={12} height={4} borderRadius="circular" />
              <Skeleton width={12} height={4} borderRadius="circular" />
              <Skeleton width={12} height={4} borderRadius="circular" />
              <Skeleton width={12} height={4} borderRadius="circular" />
            </View>
            </View>
          </View>
        </View>
      </View>
    );
}

// Add default export at the end
export default TokenDetailContentWithRelay;
