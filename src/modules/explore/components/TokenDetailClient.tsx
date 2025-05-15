'use client'

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Image,
  Button,
  Link,
  Skeleton,
} from 'reshaped'
import { isAddress, formatUnits } from 'viem'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'
import { getClientEnvironment } from '@/src/lib/relay/environment'
import dynamic from 'next/dynamic'
import { formatCurrency } from '@/src/lib/utils/tokenPriceUtils'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { KKUB_ADDRESS, KOI_ADDRESS } from '@/src/constants/addresses'

// Constants
const NATIVE_KUB_ADDRESS = '0x0000000000000000000000000000000000000000' // Native KUB address

// Dynamic imports with their own loading states
const PriceChart = dynamic(() => import('../../../modules/explore/components/PriceChart'), { 
  ssr: false,
  loading: () => (
    <View attributes={{ style: { height: '400px', width: '100%' } }}>
      <Skeleton height="100%" width="100%" borderRadius="small" />
    </View>
  )
})

const SwapInterface = dynamic(() => import('../../../components/Swap'), { 
  ssr: false,
  loading: () => (
    <View height={100} width="100%">
      <Skeleton height="100%" width="100%" borderRadius="medium" />
    </View>
  )
})

// CSS for shimmer animation (to be used in components)
const ShimmerCSS = () => (
  <style jsx global>{`
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .shimmer-effect {
      background: linear-gradient(90deg, rgba(30,30,30,0.6) 0%, rgba(60,60,60,0.6) 50%, rgba(30,30,30,0.6) 100%);
      background-size: 200% 100%;
      animation: shimmer 3s ease-in-out infinite;
    }
  `}</style>
)

// Function to check if a value needs decimal formatting (used in chart data processing)
function needsDecimalFormatting(value: any, symbol?: string | null): boolean {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return false;
  }
  
  // Parse to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // If value is not a valid number, it doesn't need formatting
  if (isNaN(numValue)) {
    return false;
  }
  
  // Special case for KOI token - always apply decimal formatting if value is large
  if (symbol === 'KOI' && numValue > 1e6) {
    return true;
  }
  
  // General case: check for large values likely to be unformatted blockchain values
  return numValue > 1e10 || 
    (typeof value === 'string' && value.length > 10 && /^[0-9]+$/.test(value));
}

// Function to safely format blockchain values with the appropriate decimals
function formatBlockchainValue(value: any, decimals: number = 18): number {
  try {
    // Convert to string if it's a number (to handle scientific notation properly)
    const valueStr = typeof value === 'number' ? value.toString() : String(value);
    
    // Try to use BigInt for precise formatting
    try {
      const valueBigInt = BigInt(valueStr.split('.')[0]); // Remove any decimal part for BigInt
      return Number(formatUnits(valueBigInt, decimals));
    } catch (err) {
      // Fallback to simple division if BigInt conversion fails
      console.warn(`[Chart] BigInt conversion failed, using fallback division: ${err}`);
      return Number(value) / Math.pow(10, decimals);
    }
  } catch (err) {
    console.error(`[Chart] Error formatting blockchain value: ${err}`);
    return Number(value);
  }
}

// Helper function for formatting token prices
const formatTokenPrice = (price: number): string => {
  if (price < 0.001) return price.toFixed(6);
  if (price < 0.01) return price.toFixed(5);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
};

// Props for the token detail component
interface TokenDetailClientProps {
  tokenAddress: string
}

// Define token type
interface TokenData {
  id?: string;
  address: string;
  name?: string | null;
  symbol?: string | null;
  imageURI?: string | null;
  priceUSD?: string | null;
  priceChange24h?: number | null;
  decimals?: number | null;
  volumeUSD24h?: string | null;
  tvl?: string | null;
  marketCap?: string | null;
  fdv?: string | null;
}

// Helper component for token icon with loading state
function TokenIcon({ imageURI, name, isLoading }: { imageURI?: string | null, name?: string | null, isLoading: boolean }) {
  if (isLoading) {
    return (
      <View width={8} height={8} overflow="hidden" borderRadius="large">
        <Skeleton width="100%" height="100%" />
      </View>
    )
  }
  
  return (
    <Image
      src={getIpfsGateway(imageURI ?? '/tokens/coin.svg')}
      height={8}
      width={8}
      alt={`${name || 'Token'} Image`}
    />
  )
}

// Helper component for token name/symbol with progressive loading
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
  const displaySymbol = symbol || (isLoadingBasic ? '...' : address.slice(0, 6))
  const displayName = name || (isLoadingBasic ? 'Loading...' : address.slice(0, 10))
  
  if (isLoadingBasic) {
    return (
      <Skeleton width={24} height={4} borderRadius="medium" />
    )
  }
  
  return (
    <Text variant="featured-2" weight="medium" color="neutral">
      {displayName} <Text as="span" color="neutral-faded">{displaySymbol}</Text>
    </Text>
  )
}

// Helper component for price display with progressive loading
function PriceDisplay({ 
  price, 
  priceChange, 
  isLoadingPrice
}: { 
  price?: string | null, 
  priceChange?: number | null,
  isLoadingPrice: boolean
}) {
  // Format values
  const priceUSD = parseFloat(price || '0')
  const formattedPrice = formatTokenPrice(priceUSD)
  const priceChangeColor = (priceChange || 0) >= 0 ? 'positive' : 'critical'
  const priceChangePrefix = (priceChange || 0) >= 0 ? '+' : ''
  const priceChangeDisplay = `${priceChangePrefix}${(priceChange || 0).toFixed(2)}%`
  
  if (isLoadingPrice) {
    return (
      <View direction="row" align="center" gap={2}>
        <Skeleton width={20} height={10} borderRadius="medium" />
        <Skeleton width={12} height={10} borderRadius="medium" />
      </View>
    )
  }
  
  return (
    <View direction="row" gap={2} align="center">
      <Text variant="title-6" weight="regular" color="neutral">
        ${formattedPrice}
      </Text>
      <Text color={priceChangeColor} variant="body-3">
        {priceChangeDisplay}
      </Text>
    </View>
  )
}

// Main component
export default function TokenDetailClient({ tokenAddress }: TokenDetailClientProps) {
  // Loading states for different parts of the UI
  const [isLoadingEnvironment, setIsLoadingEnvironment] = useState(true)
  const [isLoadingBasicInfo, setIsLoadingBasicInfo] = useState(true)
  const [isLoadingPrice, setIsLoadingPrice] = useState(true)
  const [isLoadingChart, setIsLoadingChart] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  
  // Error state
  const [error, setError] = useState<string | null>(null)
  
  // Environment state
  const [environment, setEnvironment] = useState<any>(null)
  
  // Token data state with default/placeholder values
  const [token, setToken] = useState<TokenData>({
    address: tokenAddress,
    // No default values for name/symbol to avoid showing placeholders
  })
  
  const [priceData, setPriceData] = useState<any[]>([])
  const [activeTimeframe, setActiveTimeframe] = useState('1m')
  const brandColor = '#94e0fe'
  
  // Responsive state
  const [isMobile, setIsMobile] = useState(false)
  
  // Get Redis subscriber for real-time updates
  const { refreshData } = useRedisSubscriber()
  
  // Handle responsive layout
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Check on mount
    checkIfMobile()
    
    // Listen for resize events
    window.addEventListener('resize', checkIfMobile)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile)
  }, [])
  
  // Initialize environment on mount
  useEffect(() => {
    try {
      // Get the Relay environment
      const relayEnv = getClientEnvironment()
      setEnvironment(relayEnv)
      setIsLoadingEnvironment(false)
      
      // Set up refresh interval
      const interval = setInterval(() => {
        refreshData()
      }, 30000)
      
      return () => clearInterval(interval)
    } catch (err) {
      console.error('Error initializing environment:', err)
      setError('Failed to initialize data environment')
      setIsLoadingEnvironment(false)
    }
  }, [refreshData])
  
  // Fetch basic token data (name, symbol) first - high priority
  useEffect(() => {
    if (isLoadingEnvironment || !environment) return
    
    console.log('[TokenDetail] Loading basic token info...')
    
    // Make a request for basic token info
    fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query TokenBasicInfoQuery($tokenAddress: String!) {
            tokenByAddress(address: $tokenAddress) {
              name
              symbol
              imageURI
            }
          }
        `,
        variables: { tokenAddress },
      }),
    })
    .then(response => response.json())
    .then(result => {
      if (result.errors) {
        console.error('GraphQL errors fetching basic token info:', result.errors)
        return
      }
      
      if (result.data?.tokenByAddress) {
        // Update with basic info
        setToken(prevState => ({
          ...prevState,
          name: result.data.tokenByAddress.name || null,
          symbol: result.data.tokenByAddress.symbol || null,
          imageURI: result.data.tokenByAddress.imageURI || null,
        } as TokenData));
      }
    })
    .catch(err => {
      console.error('Error fetching basic token info:', err)
    })
    .finally(() => {
      setIsLoadingBasicInfo(false)
      
      // Immediately fetch price data next
      fetchPriceData()
    })
  }, [environment, isLoadingEnvironment, tokenAddress])
  
  // Function to fetch price data - medium priority
  const fetchPriceData = () => {
    if (!environment) return
    
    console.log('[TokenDetail] Loading price data...')
    
    // Make a request for price data
    fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query TokenPriceQuery($tokenAddress: String!) {
            tokenByAddress(address: $tokenAddress) {
              priceUSD
              priceChange24h
              decimals
            }
          }
        `,
        variables: { tokenAddress },
      }),
    })
    .then(response => response.json())
    .then(result => {
      if (result.errors) {
        console.error('GraphQL errors fetching price data:', result.errors)
        return
      }
      
      if (result.data?.tokenByAddress) {
        // Update with price info
        setToken(prevState => ({
          ...prevState,
          priceUSD: result.data.tokenByAddress.priceUSD || null,
          priceChange24h: result.data.tokenByAddress.priceChange24h || null,
          decimals: result.data.tokenByAddress.decimals || null,
        } as TokenData))
      }
    })
    .catch(err => {
      console.error('Error fetching price data:', err)
    })
    .finally(() => {
      setIsLoadingPrice(false)
      
      // Fetch full token data next
      fetchFullTokenData()
    })
  }
  
  // Function to fetch full token data - low priority
  const fetchFullTokenData = () => {
    if (!environment) return
    
    console.log('[TokenDetail] Loading full token data...')
    
    // Make a request for full token data
    fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query TokenFullDataQuery($tokenAddress: String!) {
            tokenByAddress(address: $tokenAddress) {
              id
              volumeUSD24h
              tvl
              marketCap
              fdv
            }
          }
        `,
        variables: { tokenAddress },
      }),
    })
    .then(response => response.json())
    .then(result => {
      if (result.errors) {
        console.error('GraphQL errors fetching full token data:', result.errors)
        return
      }
      
      if (result.data?.tokenByAddress) {
        // Update with full token data
        setToken(prevState => ({
          ...prevState,
          id: result.data.tokenByAddress.id || undefined,
          volumeUSD24h: result.data.tokenByAddress.volumeUSD24h || null,
          tvl: result.data.tokenByAddress.tvl || null,
          marketCap: result.data.tokenByAddress.marketCap || null,
          fdv: result.data.tokenByAddress.fdv || null,
        } as TokenData))
      }
    })
    .catch(err => {
      console.error('Error fetching full token data:', err)
    })
    .finally(() => {
      setIsLoadingStats(false)
      
      // Fetch chart data in parallel
      fetchChartData()
    })
  }
  
  // Function to fetch chart data - can run in parallel
  const fetchChartData = () => {
    if (!environment) return
    
    console.log('[TokenDetail] Loading chart data...')
    
    // Make a direct fetch request to get price chart data
    fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query TokenPriceChartQuery($tokenAddress: String!, $timeframe: String!, $limit: Int!) {
            tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {
              time
              value
            }
          }
        `,
        variables: { 
          tokenAddress,
          timeframe: activeTimeframe,
          limit: 100
        },
      }),
    })
    .then(response => response.json())
    .then(result => {
      if (result.errors) {
        console.error('GraphQL errors fetching chart data:', result.errors)
        return
      }
      
      // Use the token decimals, default to 18 if not available
      const tokenDecimals = token?.decimals || 18
      
      if (result.data?.tokenPriceChart) {
        // Process the data for the chart
        const chartData = result.data.tokenPriceChart.map((point: any) => {
          let formattedValue = Number(point.value)
          const rawValue = point.value.toString()
          let timeVal = Number(point.time)
          
          // Safely handle the token symbol for decimal formatting
          const safeSymbol = token?.symbol || undefined
          
          // Check if we need decimal formatting
          if (needsDecimalFormatting(rawValue, safeSymbol)) {
            formattedValue = formatBlockchainValue(rawValue, tokenDecimals)
          }
          
          // Handle invalid values
          if (isNaN(formattedValue) || !isFinite(formattedValue)) {
            formattedValue = 0
          }
          
          // Cap extremely large values
          const MAX_CHART_VALUE = 1e9
          if (formattedValue > MAX_CHART_VALUE) {
            formattedValue = MAX_CHART_VALUE
          }
          
          return {
            time: timeVal,
            value: formattedValue
          }
        })
        
        if (chartData.length > 0) {
          setPriceData(chartData)
        }
      }
    })
    .catch(err => {
      console.error('Error fetching chart data:', err)
    })
    .finally(() => {
      setIsLoadingChart(false)
    })
  }
  
  // Handle timeframe change
  const handleTimeframeChange = (tf: string) => {
    setActiveTimeframe(tf)
    // Refresh chart data when timeframe changes
    setIsLoadingChart(true)
    setTimeout(() => fetchChartData(), 0)
  }
  
  // Helper functions for formatting
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
  
  // Format metrics
  const metrics = {
    tvl: formatLargeNumber(token.tvl),
    marketCap: formatLargeNumber(token.marketCap),
    fdv: formatLargeNumber(token.fdv),
    dayVolume: formatLargeNumber(token.volumeUSD24h)
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
  const isKKUBPage = tokenAddress.toLowerCase() === KKUB_ADDRESS[CURRENT_CHAIN.id].toLowerCase()
  
  // Input token is KKUB unless on KKUB page, then use native KUB
  const swapInAddress = isKKUBPage 
    ? NATIVE_KUB_ADDRESS 
    : KKUB_ADDRESS[CURRENT_CHAIN.id]
    
  // Output token is always the current token
  const swapOutAddress = tokenAddress.toLowerCase() as `0x${string}`

  // Render the token detail UI
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
        {isLoadingBasicInfo ? (
          <Skeleton width={4} height={0.75} borderRadius="medium" />
        ) : (
          <Text variant="body-2" color="neutral">
            {token.symbol || token.address.slice(0, 6)}
          </Text>
        )}
      </View>

      {/* Token header with logo and name */}
      <View direction="row" justify="space-between" align="center">
        <View direction="row" gap={3} align="center">
          <TokenIcon 
            imageURI={token.imageURI} 
            name={token.name}
            isLoading={isLoadingBasicInfo} 
          />
          <View direction="column" gap={2}>
            <TokenNameDisplay 
              name={token.name}
              symbol={token.symbol}
              address={token.address}
              isLoadingBasic={isLoadingBasicInfo}
            />
          </View>
        </View>
      </View>

      {/* Price and percent change */}
      <PriceDisplay 
        price={token.priceUSD}
        priceChange={token.priceChange24h}
        isLoadingPrice={isLoadingPrice}
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
          <View position="relative">
            {isLoadingChart ? (
              <View attributes={{ style: { height: '400px', width: '100%' } }}>
                <Skeleton height="100%" width="100%" borderRadius="small" />
              </View>
            ) : priceData.length > 0 ? (
              <View attributes={{ style: { height: '400px', width: '100%' } }}>
                <PriceChart
                  data={priceData}
                  type="area"
                  title={`${token.symbol || 'Token'} Price (USD)`}
                  height={400}
                  autoSize={false}
                  yAxisLabel="Price (USD)"
                  formatTooltip={formatTooltip}
                  brandColor={brandColor}
                />
              </View>
            ) : (
              <View attributes={{ style: { height: '400px', width: '100%' } }}>
                <Text>No price data available for this timeframe</Text>
              </View>
            )}

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
            {isLoadingStats ? (
              <View direction="row" wrap={true} gap={8} justify="space-between">
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} direction="column" gap={2}>
                    <Skeleton width={16} height={3} borderRadius="medium" />
                    <Skeleton width={24} height={5} borderRadius="medium" />
                  </View>
                ))}
              </View>
            ) : (
              <View direction="row" wrap={true} gap={8} justify="space-between">
                <View direction="column" gap={1}>
                  <Text variant="body-2" color="neutral-faded">
                    TVL
                  </Text>
                  <Text variant="featured-3" weight="medium" color="neutral">
                    {metrics.tvl}
                  </Text>
                </View>
                <View direction="column" gap={1}>
                  <Text variant="body-2" color="neutral-faded">
                    Market cap
                  </Text>
                  <Text variant="featured-3" weight="medium" color="neutral">
                    {metrics.marketCap}
                  </Text>
                </View>
                <View direction="column" gap={1}>
                  <Text variant="body-2" color="neutral-faded">
                    FDV
                  </Text>
                  <Text variant="featured-3" weight="medium" color="neutral">
                    {metrics.fdv}
                  </Text>
                </View>
                <View direction="column" gap={1}>
                  <Text variant="body-2" color="neutral-faded">
                    24h volume
                  </Text>
                  <Text variant="featured-3" weight="medium" color="neutral">
                    {metrics.dayVolume}
                  </Text>
                </View>
              </View>
            )}
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
            defaultTokenIn={swapInAddress as `0x${string}`}
            defaultTokenOut={swapOutAddress}
            defaultWidth="100%"
          />
        </View>
      </View>
    </View>
  )
} 