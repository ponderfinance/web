'use client'

import React, { useState, Suspense } from 'react'
import {
  View,
  Text,
  Image,
  Button,
  Link,
} from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import TokenPriceChartContainer from './TokenPriceChartContainer'
import { TokenDetailContentQuery } from '@/src/__generated__/TokenDetailContentQuery.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

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

export default function TokenDetailContent({ tokenAddress }: { tokenAddress: string }) {
  const [activeTimeframe, setActiveTimeframe] = useState('1M')
  const brandColor = '#94e0fe'

  // Fetch token data with proper typing
  const data = useLazyLoadQuery<TokenDetailContentQuery>(
    TokenDetailQuery,
    { tokenAddress },
    { fetchPolicy: 'store-and-network' }
  )

  // Get token data
  const token = data.tokenByAddress

  // Show error if token not found
  if (!token) {
    return null
  }

  // Format values for display
  const priceUSD = parseFloat(token.priceUSD || '0')
  const priceChangeColor = (token.priceChange24h || 0) >= 0 ? 'positive' : 'critical'
  const priceChangePrefix = (token.priceChange24h || 0) >= 0 ? '+' : ''
  const priceChangeDisplay = `${priceChangePrefix}${(token.priceChange24h || 0).toFixed(2)}%`

  // Format token metrics for display
  const formatLargeNumber = (value: string | null | undefined): string => {
    if (!value) return '$0'
    const num = parseFloat(value)

    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(1)}B`
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(1)}M`
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(1)}K`
    } else {
      return `$${num.toFixed(2)}`
    }
  }

  // Get formatted metrics
  const tvl = formatLargeNumber(token.tvl)
  const marketCap = formatLargeNumber(token.marketCap)
  const fdv = formatLargeNumber(token.fdv)
  const dayVolume = formatLargeNumber(token.volumeUSD24h)

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe: string) => {
    setActiveTimeframe(newTimeframe);
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

  // Memoize the chart component to prevent unnecessary re-renders
  const timeframeForChart = getChartTimeframe();
  const chartComponent = React.useMemo(() => (
    <TokenPriceChartContainer
      tokenRef={token}
      initialTimeframe={timeframeForChart}
      initialDisplayType="area"
    />
  ), [token, timeframeForChart]);

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
              {tvl}
            </Text>
          </View>
          <View direction="column" gap={1}>
            <Text variant="body-2" color="neutral-faded">
              Market cap
            </Text>
            <Text variant="featured-3" weight="medium" color="neutral">
              {marketCap}
            </Text>
          </View>
          <View direction="column" gap={1}>
            <Text variant="body-2" color="neutral-faded">
              FDV
            </Text>
            <Text variant="featured-3" weight="medium" color="neutral">
              {fdv}
            </Text>
          </View>
          <View direction="column" gap={1}>
            <Text variant="body-2" color="neutral-faded">
              1 day volume
            </Text>
            <Text variant="featured-3" weight="medium" color="neutral">
              {dayVolume}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
