'use client'

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Image,
  Button,
  Link,
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

// Function to check if a value needs decimal formatting (used in chart data processing)
function needsDecimalFormatting(value: any, symbol?: string): boolean {
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

// Dynamically import the PriceChart and SwapInterface to avoid SSR issues
const PriceChart = dynamic(() => import('../../../modules/explore/components/PriceChart'), { 
  ssr: false,
  loading: () => (
    <View height={400} align="center" justify="center">
      <Text>Loading price chart...</Text>
    </View>
  )
})

const SwapInterface = dynamic(() => import('../../../components/Swap'), { 
  ssr: false,
  loading: () => (
    <View height={200} align="center" justify="center">
      {/* Remove loading text */}
    </View>
  )
})

// Props for the token detail component
interface TokenDetailClientProps {
  tokenAddress: string
}

// Error component
function ErrorView({ message }: { message: string }) {
  return (
    <View height={400} align="center" justify="center" direction="column" gap={4}>
      <Text variant="featured-1" weight="medium" color="critical">Error</Text>
      <Text>{message}</Text>
    </View>
  );
}

// Loading component
function LoadingView() {
  return (
    <View height={400} align="center" justify="center">
      <Text>Loading token details...</Text>
    </View>
  );
}

// Main component
export default function TokenDetailClient({ tokenAddress }: TokenDetailClientProps) {
  // Environment state
  const [environment, setEnvironment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Token data state
  const [token, setToken] = useState<any>(null);
  const [priceData, setPriceData] = useState<any[]>([]);
  const [activeTimeframe, setActiveTimeframe] = useState('1m');
  const brandColor = '#94e0fe';
  
  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  
  // Get Redis subscriber for real-time updates
  const { refreshData } = useRedisSubscriber();
  
  // Handle responsive layout
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check on mount
    checkIfMobile();
    
    // Listen for resize events
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // Initialize environment on mount
  useEffect(() => {
    try {
      // Get the Relay environment
      const relayEnv = getClientEnvironment();
      setEnvironment(relayEnv);
      
      // Set up refresh interval
      const interval = setInterval(() => {
        refreshData();
      }, 30000);
      
      return () => clearInterval(interval);
    } catch (err) {
      console.error('Error initializing environment:', err);
      setError('Failed to initialize data environment');
    }
  }, [refreshData]);
  
  // Fetch token data 
  useEffect(() => {
    if (!environment || !tokenAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    // Make a direct fetch request rather than using Relay
    fetch('/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query TokenDetailQuery($tokenAddress: String!) {
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
            }
          }
        `,
        variables: { tokenAddress },
      }),
    })
    .then(response => response.json())
    .then(result => {
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        setError(result.errors[0].message || 'Failed to load token data');
        return;
      }
      
      setToken(result.data?.tokenByAddress || null);
      
      if (!result.data?.tokenByAddress) {
        setError(`Token not found: ${tokenAddress}`);
      }
    })
    .catch(err => {
      console.error('Error fetching token data:', err);
      setError('Error loading token data. Please try again later.');
    })
    .finally(() => {
      setIsLoading(false);
    });
  }, [environment, tokenAddress]);
  
  // Fetch price chart data based on the selected timeframe
  useEffect(() => {
    if (!environment || !tokenAddress) return;
    
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
            tokenByAddress(address: $tokenAddress) {
              decimals
              symbol
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
        console.error('GraphQL errors fetching price data:', result.errors);
        return;
      }
      
      // Get fresh decimals info directly from the query
      const queryDecimals = result.data?.tokenByAddress?.decimals;
      const querySymbol = result.data?.tokenByAddress?.symbol;
      
      // Use the most reliable decimals source, default to 18 if not available
      const tokenDecimals = (token?.decimals !== undefined) ? token.decimals : 
                           (queryDecimals !== undefined) ? queryDecimals : 18;
      
      if (result.data?.tokenPriceChart) {
        // Process the data for the chart component with comprehensive formatting
        const chartData = result.data.tokenPriceChart.map((point: any) => {
          // Parse both as number and string to handle different formats
          let formattedValue = Number(point.value);
          const rawValue = point.value.toString();
          let timeVal = Number(point.time);
          
          // Use the token symbol to detect KOI specifically
          const tokenSymbol = token?.symbol || result.data?.tokenByAddress?.symbol;
          
          // Use the improved detection and formatting functions
          if (needsDecimalFormatting(rawValue, tokenSymbol)) {
            // Apply decimal formatting using token-specific decimals
            formattedValue = formatBlockchainValue(rawValue, tokenDecimals);
            console.log(`[Chart] Formatted blockchain value: ${rawValue} → ${formattedValue}`);
          }
          
          // Ensure we don't have invalid values
          if (isNaN(formattedValue) || !isFinite(formattedValue)) {
            console.warn(`[Chart] Invalid value detected: ${rawValue}, using 0`);
            formattedValue = 0;
          }
          
          // Cap extremely large values that would distort the chart
          const MAX_CHART_VALUE = 1e9;
          if (formattedValue > MAX_CHART_VALUE) {
            console.warn(`[Chart] Capping extremely large value: ${formattedValue} → ${MAX_CHART_VALUE}`);
            formattedValue = MAX_CHART_VALUE;
          }
          
          // Ensure the value is not too small to be visible
          const MIN_CHART_VALUE = 1e-10;
          if (formattedValue > 0 && formattedValue < MIN_CHART_VALUE) {
            console.warn(`[Chart] Value too small, adjusting: ${formattedValue} → ${MIN_CHART_VALUE}`);
            formattedValue = MIN_CHART_VALUE;
          }
          
          return {
            time: timeVal,
            value: formattedValue
          };
        });
        
        // Log the processed data 
        console.log(`[Chart] First few processed data points:`, chartData.slice(0, 3));
        
        // Only update chart if we have valid data
        if (chartData.length > 0) {
          setPriceData(chartData);
        } else {
          console.warn(`[Chart] No valid price data points`);
        }
      }
    })
    .catch(err => {
      console.error('Error fetching price chart data:', err);
    });
  }, [environment, tokenAddress, activeTimeframe]);

  // Handle timeframe change
  const handleTimeframeChange = (tf: string) => {
    setActiveTimeframe(tf);
  };
  
  // Handle loading state
  if (!environment) {
    return (
      <View direction="column" gap={6}>
        <View height={400} align="center" justify="center">
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }
  
  // Set default values for token if missing
  const tokenData = token || { 
    symbol: tokenAddress.slice(0, 6),
    address: tokenAddress,
    priceUSD: '0',
    priceChange24h: 0,
    imageURI: '/tokens/coin.svg'
  };
  
  // Helper functions for formatting
  const formatLargeNumber = (value: string | null | undefined): string => {
    if (!value) return '$0';
    const formattedNum = parseFloat(value);

    if (formattedNum >= 1e9) {
      return `$${(formattedNum / 1e9).toFixed(1)}B`;
    } else if (formattedNum >= 1e6) {
      return `$${(formattedNum / 1e6).toFixed(1)}M`;
    } else if (formattedNum >= 1e3) {
      return `$${(formattedNum / 1e3).toFixed(1)}K`;
    } else {
      return `$${formattedNum.toFixed(2)}`;
    }
  };

  const formatTokenPrice = (price: number): string => {
    if (price < 0.001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };
  
  // Parse and format token data
  const priceUSD = parseFloat(tokenData.priceUSD || '0');
  const priceChangeColor = (tokenData.priceChange24h || 0) >= 0 ? 'positive' : 'critical';
  const priceChangePrefix = (tokenData.priceChange24h || 0) >= 0 ? '+' : '';
  const priceChangeDisplay = `${priceChangePrefix}${(tokenData.priceChange24h || 0).toFixed(2)}%`;
  
  // Format metrics
  const metrics = {
    tvl: formatLargeNumber(tokenData.tvl),
    marketCap: formatLargeNumber(tokenData.marketCap),
    fdv: formatLargeNumber(tokenData.fdv),
    dayVolume: formatLargeNumber(tokenData.volumeUSD24h)
  };

  // Format tooltip for price chart
  const formatTooltip = (value: number) => {
    if (value < 0.001) {
      return `$${value.toFixed(8)}`;
    }
    if (value < 0.01) {
      return `$${value.toFixed(6)}`;
    }
    if (value < 1) {
      return `$${value.toFixed(4)}`;
    }
    return formatCurrency(value);
  };
  
  // Determine swap tokens
  const isKKUBPage = tokenAddress.toLowerCase() === KKUB_ADDRESS[CURRENT_CHAIN.id].toLowerCase();
  
  // Input token is KKUB unless on KKUB page, then use native KUB
  const swapInAddress = isKKUBPage 
    ? NATIVE_KUB_ADDRESS 
    : KKUB_ADDRESS[CURRENT_CHAIN.id];
    
  // Output token is always the current token
  const swapOutAddress = tokenAddress.toLowerCase() as `0x${string}`;

  // Render the token detail UI
  return (
    <View direction="column" gap={6}>
      {/* Breadcrumb Navigation */}
      <View direction="row" align="center" gap={3}>
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
          {tokenData.symbol || tokenData.address.slice(0, 8)}
        </Text>
      </View>

      {/* Token header with logo and name */}
      <View direction="row" justify="space-between" align="center">
        <View direction="row" gap={3} align="center">
          <Image
            src={getIpfsGateway(tokenData.imageURI ?? '/tokens/coin.svg')}
            height={8}
            width={8}
            alt={`${tokenData.name || tokenData.address.slice(0, 10)} Token Image`}
          />
          <Text variant="featured-2" weight="medium" color="neutral">
            {tokenData.name ? `${tokenData.name}` : tokenData.address.slice(0, 8)}
          </Text>
          <Text variant="featured-2" weight="medium" color="neutral-faded">
            {tokenData.symbol}
          </Text>
        </View>
      </View>

      {/* Price and percent change */}
      <View direction="row" gap={1} align="center">
        <Text variant="title-6" weight="regular" color="neutral">
          ${formatTokenPrice(priceUSD)}
        </Text>
        <Text color={priceChangeColor} variant="body-3">
          {priceChangeDisplay}
        </Text>
      </View>

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
            {priceData.length > 0 ? (
              <PriceChart
                data={priceData}
                type="area"
                title={`${tokenData.symbol} Price (USD)`}
                height={400}
                autoSize={true}
                yAxisLabel="Price (USD)"
                formatTooltip={formatTooltip}
                brandColor={brandColor}
              />
            ) : (
              <View height={400} align="center" justify="center">
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
  );
} 