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
import { getIpfsGateway } from '@/src/utils/ipfs'
import { isAddress } from 'viem'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'
import PriceChart from './PriceChart'
import { SwapInterface } from '@/src/components/Swap'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { formatNumber } from '@/src/utils/numbers'

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

// Define the Relay fragment
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

// Wrapper component that loads the query
export function TokenDetailContentWithRelay({ tokenAddress, initialTimeframe = '1m' }: { tokenAddress: string, initialTimeframe?: string }) {
  const [queryRef, loadQuery] = useQueryLoader<TokenDetailContentQuery>(TokenDetailQuery)
  const [timeframe, setTimeframe] = useState(initialTimeframe)

  // Convert UI timeframe format to API format
  const getApiTimeframe = (tf: string): string => {
    switch (tf.toUpperCase()) {
      case '1H': return '1h'
      case '1D': return '1d'
      case '1W': return '1w'
      case '1M': return '1m'
      case '1Y': return '1y'
      default: return '1m'
    }
  }

  useEffect(() => {
    loadQuery({
      tokenAddress,
      timeframe: getApiTimeframe(timeframe),
      limit: 100
    })
  }, [loadQuery, tokenAddress, timeframe])

  const everHadDataRef = useRef(false)

  // Listen for Redis token updates
  const { tokenLastUpdated } = useRedisSubscriber()
  
  useEffect(() => {
    // Normalize address for comparison
    const normalizedAddress = tokenAddress.toLowerCase()
    
    // Check if this specific token has been updated
    if (tokenLastUpdated[normalizedAddress]) {
      console.log(`[TokenDetailContent] Detected Redis update for token: ${normalizedAddress}`)
      
      // Use intelligent throttling with high priority for detail page
      if (shouldRefresh(`token-detail-${normalizedAddress}`, 'high')) {
        // Refresh data
        loadQuery({
          tokenAddress,
          timeframe: getApiTimeframe(timeframe),
          limit: 100
        })
      }
    }
  }, [tokenLastUpdated, tokenAddress, loadQuery, timeframe])

  if (!queryRef) {
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

  return (
    <Suspense fallback={
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
    }>
      <TokenDetailContent queryRef={queryRef} onTimeframeChange={setTimeframe} everHadDataRef={everHadDataRef} />
    </Suspense>
  )
}

// Main content component
function TokenDetailContent({ 
  queryRef, 
  onTimeframeChange,
  everHadDataRef
}: { 
  queryRef: PreloadedQuery<TokenDetailContentQuery>, 
  onTimeframeChange: (tf: string) => void,
  everHadDataRef: React.MutableRefObject<boolean>
}) {
  // Check for mobile view
  const [isMobile, setIsMobile] = useState(false)
  const brandColor = '#94E0FE'
  const [activeTimeframe, setActiveTimeframe] = useState<string>('1d')
  
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

    // Handle timeframe change
    const handleTimeframeChange = (tf: string) => {
    setActiveTimeframe(tf)

    // Convert API timeframe format back to UI format
    let uiTimeframe = '1M'
    switch (tf) {
      case '1h': uiTimeframe = '1H'; break;
      case '1d': uiTimeframe = '1D'; break;
      case '1w': uiTimeframe = '1W'; break;
      case '1m': uiTimeframe = '1M'; break;
      case '1y': uiTimeframe = '1Y'; break;
    }
    
    onTimeframeChange(uiTimeframe)
  }
  
  // Determine swap tokens
  const isKKUBPage = data.tokenByAddress?.address.toLowerCase() === KKUB_ADDRESS[CURRENT_CHAIN.id].toLowerCase()
  
  // Render the token detail UI with the exact same layout as before
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

      {/* Main content area - responsive layout */}
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
          {/* Chart section */}
          <View>
            {/* Never show loading state once we have data */}
            <Suspense fallback={
              everHadDataRef.current ? null : (
              <View height={400} width="100%" attributes={{
                style: {
                  backgroundColor: 'rgba(30, 30, 30, 0.6)',
                  borderRadius: 4
                }
              }} />
              )
            }>
              {data.tokenByAddress && data.tokenPriceChart ? (
              <TokenPriceChartContainer 
                  tokenRef={data.tokenByAddress}
                  priceChartRef={data.tokenPriceChart}
                  initialTimeframe={queryRef.variables.timeframe as string}
                initialDisplayType="area"
                  onTimeframeChange={(tf) => {
                    // Convert API timeframe format back to UI format
                    let uiTimeframe = '1M'
                    switch (tf) {
                      case '1h': uiTimeframe = '1H'; break;
                      case '1d': uiTimeframe = '1D'; break;
                      case '1w': uiTimeframe = '1W'; break;
                      case '1m': uiTimeframe = '1M'; break;
                      case '1y': uiTimeframe = '1Y'; break;
                    }
                    
                    onTimeframeChange(uiTimeframe)
                  }}
                />
              ) : (
                <View height={400} align="center" justify="center">
                  <Text>No price data available</Text>
                </View>
              )}
            </Suspense>

          {/* Timeframe controls */}
          <View direction="row" justify="space-between" padding={4} gap={2}>
            <View direction="row" gap={2}>
                {['1h', '1d', '1w', '1m', '1y'].map((timeframe) => (
                <Button
                  key={timeframe}
                  variant={activeTimeframe === timeframe ? 'solid' : 'ghost'}
                  color={activeTimeframe === timeframe ? 'primary' : 'neutral'}
                  onClick={() => handleTimeframeChange(timeframe)}
                  size="small"
                  attributes={{
                    style: {
                      backgroundColor:
                        activeTimeframe === timeframe
                          ? 'rgba(148, 224, 254, 0.2)'
                          : 'transparent',
                      color: activeTimeframe === timeframe ? brandColor : '#999999',
                    },
                  }}
                >
                    {timeframe.toUpperCase()}
                </Button>
              ))}
            </View>
          </View>
        </View>

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
            defaultTokenIn={(isKKUBPage && data.tokenByAddress 
              ? NATIVE_KUB_ADDRESS 
              : KKUB_ADDRESS[CURRENT_CHAIN.id]) as `0x${string}`}
            defaultTokenOut={(data.tokenByAddress?.address?.toLowerCase() || '') as `0x${string}`}
            defaultWidth="100%"
          />
        </View>
      </View>
    </View>
  )
}

export default TokenDetailContentWithRelay
