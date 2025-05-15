'use client'

import React, { useEffect } from 'react'
import { View, Text, Actionable } from 'reshaped'
import { PoolsPageQuery } from '@/src/__generated__/PoolsPageQuery.graphql'
import { TokenPair } from '@/src/components/TokenPair'
import Link from 'next/link'
import ScrollableTable from '@/src/components/ScrollableTable'

// Helper to format currency values
const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '$0'

  const numValue = typeof value === 'string' ? parseFloat(value) : value

  if (numValue === 0) return '$0'
  if (numValue < 0.01) return '<$0.01'
  if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`
  if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`
  if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`

  return `$${numValue.toFixed(2)}`
}

// Helper to format percentage values
const formatPercentage = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '0%'

  const numValue = typeof value === 'string' ? parseFloat(value) : value

  if (numValue === 0) return '0%'
  
  return `${numValue.toFixed(2)}%`
}

// Define the component props
interface PoolsDisplayProps {
  data: PoolsPageQuery['response']
  orderBy: string
  orderDirection: string
  setOrderBy: (value: string) => void
  setOrderDirection: (value: string) => void
}

export const PoolsDisplay: React.FC<PoolsDisplayProps> = ({
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

  useEffect(() => {
    if (data?.pairs?.edges?.length > 0) {
      // Log detailed data about the first few pairs for debugging
      data.pairs.edges.slice(0, 3).forEach((edge, index) => {
        const pair = edge.node;
      });
    }
  }, [data]);

  return (
    <ScrollableTable minWidth="900px">
      <View
        direction="row"
        gap={0}
        padding={4}
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
          <Text color="neutral-faded" weight="medium">
            Pool
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <Actionable onClick={() => handleSort('reserveUSD')}>
            <View direction="row" align="center" gap={1}>
              <Text color="neutral-faded" weight="medium">
                TVL {orderBy === 'reserveUSD' && (orderDirection === 'asc' ? '↑' : '↓')}
              </Text>
            </View>
          </Actionable>
        </View.Item>
        
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Pool APR
          </Text>
        </View.Item>
        
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Reward APR
          </Text>
        </View.Item>
        
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            1D vol
          </Text>
        </View.Item>
        
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            30D vol
          </Text>
        </View.Item>
      </View>

      {/* Table Body */}
      <View direction="column" gap={0} width="100%">
        {data.pairs.edges.map(({ node }, index) => (
          <View
            key={node.id}
            direction="row"
            gap={0}
            padding={4}
            className={'border-0 border-neutral-faded hover:bg-neutral-faded'}
            align="center"
            width="100%"
          >
            <View.Item columns={1}>
              <Text color="neutral-faded">{index + 1}</Text>
            </View.Item>

            <View.Item columns={3}>
              <View direction="row" align="center" gap={2}>
                <TokenPair tokenA={node.token0} tokenB={node.token1} size="small" />
              </View>
            </View.Item>
            
            <View.Item columns={2}>
              <Text variant="body-2">{formatCurrency(node.tvl || node.reserveUSD)}</Text>
            </View.Item>
            
            <View.Item columns={1}>
              <Text variant="body-2" color={node.poolAPR && node.poolAPR > 0 ? "positive" : "neutral"}>
                {formatPercentage(node.poolAPR)}
              </Text>
            </View.Item>
            
            <View.Item columns={2}>
              <Text variant="body-2" color={node.rewardAPR && node.rewardAPR > 0 ? "positive" : "neutral"}>
                {formatPercentage(node.rewardAPR)}
              </Text>
            </View.Item>
            
            <View.Item columns={1}>
              <Text variant="body-2">{formatCurrency(node.volume24h)}</Text>
            </View.Item>
            
            <View.Item columns={2}>
              <Text variant="body-2">{formatCurrency(node.volume30d)}</Text>
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
}
