'use client'

import React, { Suspense, useState, useEffect, Component, ReactNode } from 'react'
import {
  View,
  Text,
  Card,
  Grid,
  Skeleton,
  Button,
  Container,
  Divider,
  Image,
} from 'reshaped'
import { graphql, useLazyLoadQuery } from 'react-relay'
import TokenPriceChartContainer from './TokenPriceChartContainer'
import type { TokenDetailPageQuery } from '@/src/__generated__/TokenDetailPageQuery.graphql'
import { formatCurrency } from '@/src/lib/utils/tokenPriceUtils'
import { getIpfsGateway } from '@/src/utils/ipfs'
import SwapInterface from '@/src/components/Swap'
import { KKUB_ADDRESS } from '@ponderfinance/sdk'
import { CURRENT_CHAIN } from '@/src/constants/chains'

// Define the query for the token detail page
const TokenDetailQuery = graphql`
  query TokenDetailPageQuery($tokenAddress: String!) {
    tokenByAddress(address: $tokenAddress) {
      id
      name
      symbol
      address
      decimals
      priceUSD
      priceChange24h
      volumeUSD24h
      imageURI
      ...TokenPriceChartContainer_token
    }
  }
`

// Custom error boundary component
class TokenErrorBoundary extends Component<
  { children: ReactNode; fallback: (error: Error) => ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback: (error: Error) => ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in TokenDetailPage:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error!)
    }

    return this.props.children
  }
}

interface TokenDetailPageProps {
  params: {
    address: string
  }
}

export default function TokenDetailPage({ params }: TokenDetailPageProps) {
  const { address } = params

  // Only render client-side data after component is mounted
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return (
    <Suspense>
      <TokenDetailContent tokenAddress={address} />
    </Suspense>
  )
}

function TokenDetailContent({ tokenAddress }: { tokenAddress: string }) {
  const [activeTimeframe, setActiveTimeframe] = useState('1D')
  const brandColor = '#94e0fe'

  // Fetch token data with proper typing
  const data = useLazyLoadQuery<TokenDetailPageQuery>(
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
  const volumeUSD = parseFloat(token.volumeUSD24h || '0')

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

  return (
    <View direction={{ s: 'column', m: 'row' }} gap={8}>
      <View.Item columns={{ s: 12, m: 7 }}>
        <View direction="column" position="relative">
          {/* Token header with logo and name */}
          <View direction="row" justify="space-between" align="center">
            <View direction="row" gap={3} align="center">
              <Image
                src={getIpfsGateway(token.imageURI ?? '')}
                height={8}
                width={8}
                alt={`${token.name || token.address.slice(0, 10)} Token Image`}
              />
              <Text variant="featured-2" weight="medium" color="neutral">
                {token.name ? `${token.name}` : ''}
              </Text>
              <Text variant="featured-2" weight="medium" color="neutral-faded">
                {token.symbol}
              </Text>
            </View>

            {/* Action buttons */}
            {/*  <View direction="row" gap={3}>*/}
            {/*    <Button variant="ghost" color="neutral">*/}
            {/*      <i className="fas fa-share-alt"></i>*/}
            {/*    </Button>*/}
            {/*  </View>*/}
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
            <TokenPriceChartContainer
              tokenRef={token}
              initialTimeframe={
                activeTimeframe === '1H'
                  ? '1h'
                  : activeTimeframe === '1D'
                    ? '1d'
                    : activeTimeframe === '1W'
                      ? '1w'
                      : activeTimeframe === '1M'
                        ? '1m'
                        : '1d'
              }
              initialDisplayType="area"
            />
          </View>

          {/* Timeframe controls */}
          <View direction="row" justify="space-between" padding={4} gap={2}>
            <View direction="row" gap={2}>
              {['1H', '1D', '1W', '1M', '1Y'].map((timeframe) => (
                <Button
                  disabled={timeframe !== '1D'}
                  key={timeframe}
                  variant={activeTimeframe === timeframe ? 'solid' : 'ghost'}
                  color={activeTimeframe === timeframe ? 'primary' : 'neutral'}
                  onClick={() => setActiveTimeframe(timeframe)}
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
      </View.Item>
      <View.Item columns={{ s: 12, m: 5 }}>
        <SwapInterface
          defaultTokenIn={KKUB_ADDRESS[CURRENT_CHAIN.id]}
          defaultTokenOut={tokenAddress as `0x${string}`}
          defaultWidth="100%"
        />
      </View.Item>
    </View>
  )
}
