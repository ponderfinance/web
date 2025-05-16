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
import { isAddress } from 'viem'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'

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

// Error fallback component
const ErrorFallback = ({ message }: { message: string }) => (
  <View direction="column" gap={4} align="center" justify="center" padding={6}>
    <Text variant="title-3" color="critical">Error</Text>
    <Text>{message}</Text>
    <Link href="/explore/tokens">
      <Text color="primary">Return to tokens list</Text>
    </Link>
  </View>
);

// Skeleton helper component
const Skeleton = ({ width, height }: { width: string | number, height: string | number }) => (
  <View 
    width={width} 
    height={height} 
    backgroundColor="elevation-raised" 
    borderRadius="small"
  />
);

// Loading component
const LoadingContentSkeleton = () => (
  <View direction="column" gap={6}>
    <Skeleton width="100%" height={400} />
    <View direction="row" justify="space-between" gap={6}>
      <View width="48%">
        <Skeleton width="100%" height={200} />
      </View>
      <View width="48%">
        <Skeleton width="100%" height={200} />
      </View>
    </View>
  </View>
);

// Wrapper component that loads the query
export function TokenDetailContentWithRelay({ tokenAddress }: { tokenAddress: string }) {
  // Get Redis subscriber hook
  const { tokenLastUpdated } = useRedisSubscriber();
  
  // Get query loader
  const [queryRef, loadQuery] = useQueryLoader<TokenDetailContentQuery>(TokenDetailQuery);
  
  // Load the query when the component mounts
  useEffect(() => {
    if (isAddress(tokenAddress)) {
      loadQuery({ tokenAddress });
    }
  }, [tokenAddress, loadQuery]);
  
  // Refresh the data when Redis updates are received for this token
  useEffect(() => {
    if (tokenLastUpdated[tokenAddress]) {
      console.log(`[TokenDetailContent] Refreshing data for token ${tokenAddress} after Redis update`);
      loadQuery({ tokenAddress }, { fetchPolicy: 'network-only' });
    }
  }, [tokenAddress, tokenLastUpdated, loadQuery]);
  
  // Set up auto-refresh for token price
  useEffect(() => {
    // Refresh data every 30 seconds as a backup
    const interval = setInterval(() => {
      console.log(`[TokenDetailContent] Auto-refreshing token ${tokenAddress} data`);
      loadQuery({ tokenAddress }, { fetchPolicy: 'network-only' });
    }, 30000);
    
    return () => clearInterval(interval);
  }, [tokenAddress, loadQuery]);
  
  // Return loading state if we haven't loaded the query yet
  if (!queryRef) {
    return <LoadingContentSkeleton />;
  }
  
  return <TokenDetailContentRenderer queryRef={queryRef} />;
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
    const token = data.tokenByAddress;
    
    // Validate token has all required data before using it
    if (!token.address) {
      return <ErrorFallback message="Token details unavailable" />;
    }

    // Format values for display
    const priceUSD = parseFloat(token.priceUSD || '0')
    const priceChangeColor = (token.priceChange24h || 0) >= 0 ? 'positive' : 'critical'
    const priceChangePrefix = (token.priceChange24h || 0) >= 0 ? '+' : ''
    const priceChangeDisplay = `${priceChangePrefix}${(token.priceChange24h || 0).toFixed(2)}%`

    // Format token metrics for display
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

    // Get formatted metrics
    const metrics = {
      tvl: formatLargeNumber(token?.tvl),
      marketCap: formatLargeNumber(token?.marketCap),
      fdv: formatLargeNumber(token?.fdv),
      dayVolume: formatLargeNumber(token?.volumeUSD24h)
    }

    // Handle timeframe change
    const handleTimeframeChange = (tf: string) => {
      setActiveTimeframe(tf);
    };

    // Get price format based on value
    const formatTokenPrice = (price: number) => {
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
    }

    // Map UI timeframe format to API timeframe format
    const getChartTimeframe = () => {
      switch (activeTimeframe) {
        case '1H': return '1h';  // 1 hour
        case '1D': return '1d';  // 1 day (24 hours)
        case '1W': return '1w';  // 1 week (7 days)
        case '1M': return '1m';  // 1 month (30 days)
        case '1Y': return '1y';  // 1 year (365 days)
        default: return '1m';    // Default to 1 month
      }
    };

    return (
      <View direction="column" gap={6}>
        {/* Token Metrics cards */}
        <View 
          direction="row" 
          justify="space-between"
          gap={4}
          wrap
        >
          <View direction="column" gap={1} padding={4} backgroundColor="elevation-raised" borderRadius="medium" width={{ s: '100%', m: '23%' }}>
            <Text variant="body-3" color="neutral-faded">TVL</Text>
            <Text variant="title-6">{metrics.tvl}</Text>
          </View>

          <View direction="column" gap={1} padding={4} backgroundColor="elevation-raised" borderRadius="medium" width={{ s: '100%', m: '23%' }}>
            <Text variant="body-3" color="neutral-faded">Market Cap</Text>
            <Text variant="title-6">{metrics.marketCap}</Text>
          </View>

          <View direction="column" gap={1} padding={4} backgroundColor="elevation-raised" borderRadius="medium" width={{ s: '100%', m: '23%' }}>
            <Text variant="body-3" color="neutral-faded">FDV</Text>
            <Text variant="title-6">{metrics.fdv}</Text>
          </View>

          <View direction="column" gap={1} padding={4} backgroundColor="elevation-raised" borderRadius="medium" width={{ s: '100%', m: '23%' }}>
            <Text variant="body-3" color="neutral-faded">24h Volume</Text>
            <Text variant="title-6">{metrics.dayVolume}</Text>
          </View>
        </View>

        {/* Chart with price overlay */}
        <View position="relative" backgroundColor="elevation-raised" borderRadius="medium" overflow="hidden">
          <View
            direction="column"
            padding={4}
            gap={1}
            position="absolute"
            insetTop={0}
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
              <TokenPriceChartContainer 
                tokenRef={token}  
                initialTimeframe={getChartTimeframe()}
                initialDisplayType="area"
              />
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

        {/* Token Information Section */}
        <View direction="column" gap={2}>
          <View direction="column" padding={4} backgroundColor="elevation-raised" borderRadius="medium" gap={4}>
            <Text variant="title-6">Token Information</Text>
            
            <View direction="column" gap={2}>
              <View direction="row" justify="space-between" padding={2}>
                <Text color="neutral-faded">Name</Text>
                <Text>{token.name || '-'}</Text>
              </View>
              
              <View direction="row" justify="space-between" padding={2}>
                <Text color="neutral-faded">Symbol</Text>
                <Text>{token.symbol || '-'}</Text>
              </View>
              
              <View direction="row" justify="space-between" padding={2}>
                <Text color="neutral-faded">Address</Text>
                <Text attributes={{ style: { wordBreak: 'break-all' } }}>{token.address}</Text>
              </View>
              
              <View direction="row" justify="space-between" padding={2}>
                <Text color="neutral-faded">Decimals</Text>
                <Text>{token.decimals || '-'}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  } catch (error) {
    console.error('Error rendering token detail:', error);
    return <ErrorFallback message="Error loading token data" />;
  }
}
