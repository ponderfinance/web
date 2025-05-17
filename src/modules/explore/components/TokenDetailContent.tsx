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
    if (price < 0.001) return formatCurrency(price, { maximumFractionDigits: 10 })
    if (price < 0.01) return formatCurrency(price, { maximumFractionDigits: 6 })
    if (price < 1) return formatCurrency(price, { maximumFractionDigits: 4 })
    return formatCurrency(price)
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

// Component with proper hooks that will be wrapped with boundary
function TokenDetailContentWrapper({ tokenAddress, initialTimeframe = '1m' }: { tokenAddress: string, initialTimeframe?: string }) {
  const [queryRef, loadQuery] = useQueryLoader<TokenDetailContentQuery>(TokenDetailQuery)
  const [currentTimeframe, setCurrentTimeframe] = useState(initialTimeframe)
  const [isRefetching, setIsRefetching] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const retryCountRef = useRef(0)
  
  // Load data with the current timeframe - with proper error handling
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`[TokenDetailContent] Loading token data for ${tokenAddress}`)
      
      // Perform the query load
      loadQuery({
        tokenAddress,
        timeframe: currentTimeframe,
        limit: 100
      }, { fetchPolicy: 'network-only' }); // Force network fetch to ensure fresh data
      
      // Since Relay's loadQuery doesn't have callbacks, we'll use a timeout to check for success
      // This isn't ideal but works as a basic error detection
      const successTimer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      
      return () => clearTimeout(successTimer);
    } catch (err) {
      console.error(`[TokenDetailContent] Exception during query setup:`, err);
      setError(err instanceof Error ? err : new Error('Failed to load token data'));
      setIsLoading(false);
    }
  }, [loadQuery, tokenAddress, currentTimeframe]);

  // Add an error listener effect to detect fetch errors
  useEffect(() => {
    // Helper function to check if we have a network error
    const checkForErrors = () => {
      // Only run the check if we're loading and don't already have an error
      if (!isLoading || error) return;
      
      // If we don't have a queryRef after a reasonable time, assume there was an error
      if (!queryRef && retryCountRef.current < 3) {
        console.error(`[TokenDetailContent] Query failed to load - retry attempt ${retryCountRef.current + 1}`);
        
        // Implement retry logic with exponential backoff
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        retryCountRef.current++;
        
        setTimeout(() => {
          try {
            loadQuery({
              tokenAddress,
              timeframe: currentTimeframe,
              limit: 100
            }, { fetchPolicy: 'network-only' });
          } catch (err) {
            console.error(`[TokenDetailContent] Retry attempt failed:`, err);
            setError(err instanceof Error ? err : new Error('Failed to load token data'));
            setIsLoading(false);
          }
        }, delay);
      } else if (!queryRef && retryCountRef.current >= 3) {
        // After 3 retries, give up and show error
        setError(new Error('Failed to load token data after multiple attempts'));
        setIsLoading(false);
      }
    };
    
    // Run the error check after a delay
    const errorTimer = setTimeout(checkForErrors, 3000);
    return () => clearTimeout(errorTimer);
  }, [queryRef, isLoading, error, loadQuery, tokenAddress, currentTimeframe]);

  const everHadDataRef = useRef(false)

  // Function to update timeframe that can be passed to child components
  const handleTimeframeChange = useCallback((newTimeframe: string) => {
    console.log(`[TokenDetailContent] Changing timeframe to ${newTimeframe}`)
    setCurrentTimeframe(newTimeframe)
  }, [])

  // Handle refreshing when token data updates - with simplified error handling
  const handleTokenUpdate = useCallback(() => {
    if (isRefetching) return; // Prevent concurrent refreshes
    
    console.log(`[TokenDetailContent] Refreshing token data for ${tokenAddress}`)
    setIsRefetching(true);
    
    try {
      loadQuery({
        tokenAddress,
        timeframe: currentTimeframe,
        limit: 100
      }, { fetchPolicy: 'store-and-network' });
      
      // Reset refetching state after a delay
      setTimeout(() => setIsRefetching(false), 1000);
    } catch (err) {
      console.error(`[TokenDetailContent] Exception during refresh:`, err);
      setIsRefetching(false);
    }
  }, [loadQuery, tokenAddress, currentTimeframe, isRefetching]);
  
  // Use our custom hook for real-time updates
  useRefreshOnUpdate({
    entityType: 'token',
    entityId: tokenAddress.toLowerCase(),
    onUpdate: handleTokenUpdate,
    minRefreshInterval: 10000, // 10 seconds minimum between updates
    shouldRefetch: false // Let handleTokenUpdate handle the refresh
  });

  // Error state - render an error view with link back to tokens list
  if (error) {
    return (
      <View padding={8} direction="column" gap={4} align="center">
        <Text variant="featured-1" weight="medium" color="critical">Error</Text>
        <Text>Failed to load token details. Please try again later.</Text>
        <Link href="/explore/tokens">
          <Text color="primary">Return to tokens list</Text>
        </Link>
        <Button 
          variant="outline" 
          color="primary" 
          onClick={() => {
            setError(null);
            setIsLoading(true);
            retryCountRef.current = 0;
            loadQuery({
              tokenAddress,
              timeframe: currentTimeframe,
              limit: 100
            });
          }}
        >
          Retry
        </Button>
      </View>
    );
  }

  // Loading state
  if (isLoading || !queryRef) {
    return <TokenDetailSkeleton />
  }

  // Success state with data
  return (
    <TokenDetailContent 
      queryRef={queryRef} 
      everHadDataRef={everHadDataRef}
      currentTimeframe={currentTimeframe}
      onTimeframeChange={handleTimeframeChange}
      isRefetching={isRefetching}
      tokenAddress={tokenAddress}
    />
  );
}

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

// Wrap the component with RelayBoundary and export
export const TokenDetailContentWithRelay = withRelayBoundary(
  TokenDetailContentWrapper, 
  TokenDetailSkeleton
);

// Main content component
function TokenDetailContent({ 
  queryRef, 
  everHadDataRef,
  currentTimeframe,
  onTimeframeChange,
  isRefetching,
  tokenAddress
}: { 
  queryRef: PreloadedQuery<TokenDetailContentQuery>, 
  everHadDataRef: React.MutableRefObject<boolean>,
  currentTimeframe: string,
  onTimeframeChange: (newTimeframe: string) => void,
  isRefetching: boolean,
  tokenAddress: string
}) {
  // Check for mobile view
  const [isMobile, setIsMobile] = useState(false)
  const brandColor = '#94E0FE'
  
  const checkIfMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])
  
  useEffect(() => {
    checkIfMobile()
    window.addEventListener('resize', checkIfMobile)
    return () => window.removeEventListener('resize', checkIfMobile)
  }, [checkIfMobile])
  
  const data = usePreloadedQuery(
      TokenDetailQuery,
    queryRef
  )
    
    // Mark that we've had data
  if (data.tokenByAddress) {
    everHadDataRef.current = true
  }
  
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

  // Format tooltip for price chart
  const formatTooltip = (value: number) => {
    if (value < 0.001) {
      return `$${value.toFixed(8)}`
    }
    if (value < 0.01) {
      return `$${value.toFixed(6)}`
    }
    if (value < 1) {
      return `$${value.toFixed(4)}`
    }
    return formatCurrency(value)
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
  // Only need one loading state for chart data
  const [isChartLoading, setIsChartLoading] = useState(false)
  const brandColor = '#94E0FE'
  
  // Load chart data on mount and when timeframe changes
  useEffect(() => {
    setIsChartLoading(true)
    loadChartQuery({
      tokenAddress,
      timeframe: currentTimeframe,
      limit: 100
    })
    
    // Reset loading state after a delay
    const timer = setTimeout(() => setIsChartLoading(false), 300)
    return () => clearTimeout(timer)
  }, [tokenAddress, currentTimeframe, loadChartQuery])
  
  // Handle timeframe button clicks
  const handleTimeframeChange = (newTimeframe: string, event?: React.SyntheticEvent) => {
    if (event) {
      // Ensure we're properly preventing the default behavior
      event.preventDefault()
      event.stopPropagation()
    }
    
    // Update the local timeframe state
    setCurrentTimeframe(newTimeframe)
    
    // Also notify the parent component
    onTimeframeChange(newTimeframe)
  }
  
  return (
    <View direction="column">
      {/* Chart with Suspense boundary */}
      <View height={100}>
        {isChartLoading ? (
          <View height="100%" width="100%">
            <ChartSkeleton />
          </View>
        ) : chartQueryRef ? (
            <Suspense fallback={
            <View height="100%" width="100%">
              <ChartSkeleton />
            </View>
          }>
            <ChartContent
              queryRef={chartQueryRef}
              tokenRef={tokenRef}
              />
            </Suspense>
        ) : (
          <View height="100%" width="100%" align="center" justify="center">
            <Text>No chart data available</Text>
          </View>
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
                      backgroundColor:
                    currentTimeframe === tf
                          ? 'rgba(148, 224, 254, 0.2)'
                          : 'transparent',
                  color: currentTimeframe === tf ? brandColor : '#999999',
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
            {/* Y-axis labels */}
            <View direction="row" width="100%" justify="space-between">
              <Skeleton width={15} height={4} borderRadius="circular" />
              <Skeleton width={10} height={4} borderRadius="circular" />
            </View>
              
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
