'use client'

import React, { useState, Suspense, useEffect } from 'react'
import {
  View,
  Text,
  Image,
  Button,
  Link,
} from 'reshaped'
import { graphql, useLazyLoadQuery, PreloadedQuery, useQueryLoader } from 'react-relay'
import TokenPriceChartContainer from './TokenPriceChartContainer'
import { TokenDetailContentQuery } from '@/src/__generated__/TokenDetailContentQuery.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { FragmentRefs } from 'relay-runtime'
import { isAddress } from 'viem'

// Define the query for the token detail page
export const TokenDetailQuery = graphql`
  query TokenDetailContentQuery($tokenAddress: String!) {
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
  }
`

// Define token type based on the GraphQL schema
interface TokenType {
  id: string;
  name?: string | null;
  symbol?: string | null;
  address: string;
  decimals?: number | null;
  priceUSD?: string | null;
  priceChange24h?: number | null;
  volumeUSD24h?: string | null;
  tvl?: string | null;
  marketCap?: string | null;
  fdv?: string | null;
  imageURI?: string | null;
  // Fragment references for Relay
  " $fragmentSpreads": FragmentRefs<"TokenPriceChartContainer_token">;
}

interface TokenDetailContentProps {
  tokenAddress: string;
}

// Create a separate error boundary component to handle any render errors
function ErrorFallback({ message }: { message: string }) {
  return (
    <View height={400} align="center" justify="center" direction="column" gap={4}>
      <Text variant="featured-1" weight="medium" color="critical">Error</Text>
      <Text>{message}</Text>
    </View>
  );
}

// Loader component to handle loading state
function TokenDetailSkeleton() {
  return (
    <View height={400} align="center" justify="center">
      <Text>Loading token details...</Text>
    </View>
  );
}

// Split the component: one wrapper to load the query and one to render the data
export default function TokenDetailContent({ tokenAddress }: TokenDetailContentProps) {
  // Validate tokenAddress is a proper Ethereum address
  if (!tokenAddress || !isAddress(tokenAddress)) {
    console.error(`[TokenDetail] Invalid token address format: ${tokenAddress}`);
    return <ErrorFallback message={`Invalid token address: ${tokenAddress}`} />;
  }

  // Use query loader pattern instead of direct query
  const [queryRef, loadQuery] = useQueryLoader<TokenDetailContentQuery>(TokenDetailQuery);
  
  // Load the query on component mount or address change
  useEffect(() => {
    console.log('[TokenDetail] Loading token data for address:', tokenAddress);
    try {
      loadQuery({ tokenAddress });
    } catch (error) {
      console.error('[TokenDetail] Error loading query:', error);
    }
  }, [tokenAddress, loadQuery]);
  
  // Show loading state if query hasn't been loaded yet
  if (!queryRef) {
    return <TokenDetailSkeleton />;
  }
  
  // Render the content component with the query reference
  return (
    <Suspense fallback={<TokenDetailSkeleton />}>
      <TokenDetailContentRenderer queryRef={queryRef} />
    </Suspense>
  );
}

// Content renderer component that uses the preloaded query
function TokenDetailContentRenderer({ queryRef }: { queryRef: PreloadedQuery<TokenDetailContentQuery> }) {
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const brandColor = '#94e0fe';
  
  try {
    // Use the preloaded query reference
    const data = useLazyLoadQuery<TokenDetailContentQuery>(
      TokenDetailQuery,
      { tokenAddress: queryRef.variables.tokenAddress as string },
      { fetchPolicy: 'store-or-network' }
    );
    
    // Check if we have valid data
    if (!data || !data.tokenByAddress) {
      return <ErrorFallback message="Token not found" />;
    }
    
    // Get token data
    const token = data.tokenByAddress as unknown as TokenType;
    
    // Validate token has all required data before using it
    if (!token.address) {
      return <ErrorFallback message="Token details unavailable" />;
    }

    // Format values for display
    const priceUSD = parseFloat(token.priceUSD || '0')
    const priceChangeColor = (token.priceChange24h || 0) >= 0 ? 'positive' : 'critical'
    const priceChangePrefix = (token.priceChange24h || 0) >= 0 ? '+' : ''
    const priceChangeDisplay = `${priceChangePrefix}${(token.priceChange24h || 0).toFixed(2)}%`

    // Format token metrics for display - memoized for performance
    const formatLargeNumber = React.useCallback((value: string | null | undefined): string => {
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
    }, [])

    // Get formatted metrics - memoized values
    const metrics = React.useMemo(() => ({
      tvl: formatLargeNumber(token?.tvl),
      marketCap: formatLargeNumber(token?.marketCap),
      fdv: formatLargeNumber(token?.fdv),
      dayVolume: formatLargeNumber(token?.volumeUSD24h)
    }), [token?.tvl, token?.marketCap, token?.fdv, token?.volumeUSD24h, formatLargeNumber])

    // Handle timeframe change
    const handleTimeframeChange = (tf: string) => {
      setActiveTimeframe(tf);
    };

    // Get price format based on value - memoized for performance
    const formatTokenPrice = React.useCallback((price: number) => {
      if (price < 0.001) {
        return price.toFixed(8)
      }
      if (price < 0.01) {
        return price.toFixed(6)
      }
      if (price < 1) {
        return price.toFixed(4)
      }
      return price.toFixed(2)
    }, [])

    // Map UI timeframe format to API timeframe format
    const getChartTimeframe = React.useCallback(() => {
      switch (activeTimeframe) {
        case '1H': return '1h';  // 1 hour
        case '1D': return '1d';  // 1 day (24 hours)
        case '1W': return '1w';  // 1 week (7 days)
        case '1M': return '1m';  // 1 month (30 days)
        case '1Y': return '1y';  // 1 year (365 days)
        default: return '1m';    // Default to 1 month
      }
    }, [activeTimeframe]);

    // Memoize the chart component to prevent unnecessary re-renders
    const timeframeForChart = getChartTimeframe();
    
    // Wrap the chart component in an error boundary to prevent rendering errors
    const chartComponent = React.useMemo(() => {
      try {
        if (!token || !token.address) {
          console.warn('[TokenDetail] Cannot render chart: token or address missing');
          return (
            <View height={400} align="center" justify="center">
              <Text>Chart data unavailable</Text>
            </View>
          );
        }
        
        return (
          <TokenPriceChartContainer
            tokenRef={token}
            initialTimeframe={timeframeForChart}
            initialDisplayType="area"
          />
        );
      } catch (error) {
        console.error('[TokenDetail] Error rendering chart:', error);
        return (
          <View height={400} align="center" justify="center">
            <Text>Error loading chart data</Text>
          </View>
        );
      }
    }, [token, timeframeForChart]);

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
            {token.symbol || token.address.slice(0, 8)}
          </Text>
        </View>

        <View direction="column" position="relative">
          {/* Token header with logo and name */}
          <View direction="row" justify="space-between" align="center">
            <View direction="row" gap={3} align="center">
              <Image
                src={getIpfsGateway(token.imageURI ?? '/tokens/coin.svg')}
                height={8}
                width={8}
                alt={`${token.name || token.address.slice(0, 10)} Token Image`}
              />
              <Text variant="featured-2" weight="medium" color="neutral">
                {token.name ? `${token.name}` : token.address.slice(0, 8)}
              </Text>
              <Text variant="featured-2" weight="medium" color="neutral-faded">
                {token.symbol}
              </Text>
            </View>
          </View>

          {/* Price and percent change */}
          <View
            direction="column"
            padding={0}
            gap={1}
            position="absolute"
            insetTop={12}
            zIndex={10}
          >
            <Text variant="title-6" weight="regular" color="neutral">
              ${formatTokenPrice(priceUSD)}
            </Text>
            <Text color={priceChangeColor} variant="body-3">
              {priceChangeDisplay}
            </Text>
          </View>

          {/* Chart section */}
          <View>
            <Suspense fallback={
              <View height={400} width="100%" attributes={{
                style: {
                  backgroundColor: 'rgba(30, 30, 30, 0.6)',
                  borderRadius: 4
                }
              }} />
            }>
              {chartComponent}
            </Suspense>
          </View>

          {/* Timeframe controls */}
          <View direction="row" justify="space-between" padding={4} gap={2}>
            <View direction="row" gap={2}>
              {['1H', '1D', '1W', '1M', '1Y'].map((timeframe) => (
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
                  {timeframe}
                </Button>
              ))}
            </View>
          </View>
        </View>

        {/* Stats Section */}
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
    )
  } catch (error) {
    // Handle query errors gracefully
    console.error(`[TokenDetail] Error loading token data:`, error);
    return (
      <ErrorFallback message={`Error loading token data. Please try again later.`} />
    );
  }
}
