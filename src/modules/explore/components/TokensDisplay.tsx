'use client'

import React, { useEffect } from 'react'
import { View, Text, Actionable, Image, Skeleton } from 'reshaped'
import { TokensPageQuery } from '@/src/__generated__/TokensPageQuery.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { roundDecimal } from '@/src/utils/numbers'
import Link from 'next/link'
import { TokenPair } from '@/src/components/TokenPair'
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider'
import { useQueryLoader } from 'react-relay'
import { tokensPageQuery } from './TokensPage'
import ScrollableTable from '@/src/components/ScrollableTable'

// Helper to format currency values
const formatCurrency = (value: string | null | undefined): string => {
  if (!value || value === '0' || value === 'null') return '$0'

  const numValue = parseFloat(value)
  if (isNaN(numValue)) return '$0'

  // Handle very small numbers with more precision
  if (numValue < 0.01) return `$${numValue.toFixed(6)}`
  if (numValue < 1) return `$${numValue.toFixed(4)}`
  
  // Handle larger numbers with appropriate suffixes
  if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(2)}B`
  if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(2)}M`
  if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(2)}K`

  // Regular numbers get 2 decimal places
  return `$${numValue.toFixed(2)}`
}

// Helper to format percentage change
const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0.00%'

  const fixedValue = value.toFixed(2)
  return value > 0 ? `+${fixedValue}%` : `${fixedValue}%`
}

// Define the component props
interface TokensDisplayProps {
  data: TokensPageQuery['response']
  orderBy: string
  orderDirection: string
  setOrderBy: (value: string) => void
  setOrderDirection: (value: string) => void
}

export const TokensDisplay: React.FC<TokensDisplayProps> = ({
  data,
  orderBy,
  orderDirection,
  setOrderBy,
  setOrderDirection,
}) => {
  // Get Redis subscriber context
  const { tokenLastUpdated } = useRedisSubscriber();
  
  // Get query loader
  const [queryRef, loadQuery] = useQueryLoader<TokensPageQuery>(tokensPageQuery);
  
  // Handle token updates from Redis
  useEffect(() => {
    if (Object.keys(tokenLastUpdated).length > 0) {
      console.log('Tokens updated, refreshing tokens list');
      loadQuery({
        first: 20,
        orderBy: orderBy as any,
        orderDirection: orderDirection as any,
      }, { fetchPolicy: 'network-only' });
    }
  }, [tokenLastUpdated, orderBy, orderDirection, loadQuery]);
  
  // Handle sorting
  const handleSort = (column: string) => {
    if (orderBy === column) {
      setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(column)
      setOrderDirection('desc')
    }
  }

  return (
    <ScrollableTable minWidth="900px">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        paddingInline={4}
        paddingBlock={2}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
        width="100%"
      >
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            #
          </Text>
        </View.Item>
        <View.Item columns={3}>
          <Actionable onClick={() => handleSort('symbol')}>
            <Text color="neutral-faded" weight="medium">
              Token name {orderBy === 'symbol' && (orderDirection === 'asc' ? '↑' : '↓')}
            </Text>
          </Actionable>
        </View.Item>

        <View.Item columns={2}>
          <Actionable onClick={() => handleSort('priceUSD')}>
            <Text color="neutral-faded" weight="medium">
              Price {orderBy === 'priceUSD' && (orderDirection === 'asc' ? '↑' : '↓')}
            </Text>
          </Actionable>
        </View.Item>

        <View.Item columns={1}>
          <Actionable onClick={() => handleSort('priceChange1h')}>
            <Text color="neutral-faded" weight="medium">
              1H {orderBy === 'priceChange1h' && (orderDirection === 'asc' ? '↑' : '↓')}
            </Text>
          </Actionable>
        </View.Item>

        <View.Item columns={1}>
          <Actionable onClick={() => handleSort('priceChange24h')}>
            <Text color="neutral-faded" weight="medium">
              1D {orderBy === 'priceChange24h' && (orderDirection === 'asc' ? '↑' : '↓')}
            </Text>
          </Actionable>
        </View.Item>

        <View.Item columns={2}>
          <Actionable onClick={() => handleSort('fdv')}>
            <Text color="neutral-faded" weight="medium">
              FDV {orderBy === 'fdv' && (orderDirection === 'asc' ? '↑' : '↓')}
            </Text>
          </Actionable>
        </View.Item>

        <View.Item columns={2}>
          <Actionable onClick={() => handleSort('volumeUSD24h')}>
            <Text color="neutral-faded" weight="medium">
              Volume {orderBy === 'volumeUSD24h' && (orderDirection === 'asc' ? '↑' : '↓')}
            </Text>
          </Actionable>
        </View.Item>
      </View>
      {/* Table Body */}
      <View direction="column" gap={0} width="100%">
        {data.tokens.edges.map(({ node }, index) => (
          <Link href={`/explore/tokens/${node.address}`} key={node.id}>
            <View
              direction="row"
              gap={0}
              padding={4}
              className={'border-0 border-neutral-faded hover:bg-neutral-faded'}
              align="center"
              width="100%"
            >
              <View.Item columns={1}>
                <Text color="neutral-faded" weight="medium">
                  {index + 1}
                </Text>
              </View.Item>
              <View.Item columns={3}>
                <View direction="row" gap={2} align="center">
                  <div className="flex items-center">
                    <Image
                      src={getIpfsGateway(node.imageURI ?? '/tokens/coin.svg')}
                      height={7}
                      width={7}
                      alt={node.symbol || 'Token'}
                    />
                  </div>
                  <View direction="row" gap={1} align="center">
                    <Text>{node.name || (node.symbol ? node.symbol : <Skeleton width={80} height={24} />)}</Text>
                    <Text variant="caption-1" color="neutral-faded">
                      {node.symbol ? node.symbol : ''}
                    </Text>
                  </View>
                </View>
              </View.Item>

              <View.Item columns={2}>
                <Text>{formatCurrency(node.priceUSD)}</Text>
              </View.Item>

              <View.Item columns={1}>
                <Text
                  color={
                    !node.priceChange1h
                      ? 'neutral'
                      : node.priceChange1h > 0
                        ? 'positive'
                        : 'critical'
                  }
                >
                  {formatPercent(node.priceChange1h)}
                </Text>
              </View.Item>

              <View.Item columns={1}>
                <Text
                  color={
                    !node.priceChange24h
                      ? 'neutral'
                      : node.priceChange24h > 0
                        ? 'positive'
                        : 'critical'
                  }
                >
                  {formatPercent(node.priceChange24h)}
                </Text>
              </View.Item>

              <View.Item columns={2}>
                <Text>{formatCurrency(node.fdv)}</Text>
              </View.Item>

              <View.Item columns={2}>
                <Text>{formatCurrency(node.volumeUSD24h)}</Text>
              </View.Item>
            </View>
          </Link>
        ))}
      </View>
    </ScrollableTable>
  )
}
