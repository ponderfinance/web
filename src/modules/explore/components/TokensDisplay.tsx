'use client'

import React from 'react'
import { View, Text, Actionable, Image } from 'reshaped'
import { TokensPageQuery } from '@/src/__generated__/TokensPageQuery.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { roundDecimal } from '@/src/utils/numbers'
import Link from 'next/link'

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
    <View borderRadius="medium" borderColor="neutral-faded" overflow="auto" width="100%">
      {/* Table Header */}
      <View
        direction="row"
        gap={0}
        padding={4}
        className={'border-0 border-b border-neutral-faded'}
        backgroundColor="elevation-base"
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

        {/*<View.Item columns={2}>*/}
        {/*  <Actionable onClick={() => handleSort('priceChange24h')}>*/}
        {/*    <Text color="neutral-faded" weight="medium">*/}
        {/*      24h {orderBy === 'priceChange24h' && (orderDirection === 'asc' ? '↑' : '↓')}*/}
        {/*    </Text>*/}
        {/*  </Actionable>*/}
        {/*</View.Item>*/}

        {/*<View.Item columns={2}>*/}
        {/*  <Actionable onClick={() => handleSort('volumeUSD24h')}>*/}
        {/*    <Text color="neutral-faded" weight="medium">*/}
        {/*      Volume 24h{' '}*/}
        {/*      {orderBy === 'volumeUSD24h' && (orderDirection === 'asc' ? '↑' : '↓')}*/}
        {/*    </Text>*/}
        {/*  </Actionable>*/}
        {/*</View.Item>*/}
      </View>

      {/* Table Body */}
      <View direction="column" gap={0}>
        {data.tokens.edges.map(({ node }, index) => (
          <Link href={`/explore/tokens/${node.address}`}>
            <View
              key={node.id}
              direction="row"
              gap={0}
              padding={4}
              className={'border-0 border-neutral-faded hover:bg-neutral-faded'}
              align="center"
            >
              <View.Item columns={1}>
                <Text color="neutral-faded" weight="medium">
                  {index + 1}
                </Text>
              </View.Item>
              <View.Item columns={3}>
                <View direction="row" gap={2} align="center">
                  <Image
                    src={getIpfsGateway(node.imageURI ?? '/tokens/coin.svg')}
                    height={7}
                    width={7}
                    alt={'Selected Token Icon'}
                  />
                  <View direction="row" gap={1} align="center">
                    <Text>{node.name || node.address.slice(0, 10) + '...'}</Text>
                    <Text variant="caption-1" color="neutral-faded">
                      {node.symbol || '—'}
                    </Text>
                  </View>
                </View>
              </View.Item>

              <View.Item columns={2}>
                <Text>{formatCurrency(node.priceUSD)}</Text>
              </View.Item>

              {/*<View.Item columns={2}>*/}
              {/*  <Text*/}
              {/*    color={*/}
              {/*      !node.priceChange24h*/}
              {/*        ? 'neutral'*/}
              {/*        : node.priceChange24h > 0*/}
              {/*          ? 'positive'*/}
              {/*          : 'critical'*/}
              {/*    }*/}
              {/*  >*/}
              {/*    {formatPercent(node.priceChange24h)}*/}
              {/*  </Text>*/}
              {/*</View.Item>*/}

              {/*<View.Item columns={2}>*/}
              {/*  <Text>{formatCurrency(node.volumeUSD24h)}</Text>*/}
              {/*</View.Item>*/}
            </View>
          </Link>
        ))}
      </View>
    </View>
  )
}
