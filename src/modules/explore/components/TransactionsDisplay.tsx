'use client'

import React from 'react'
import { View, Text, Loader } from 'reshaped'
import { TokenPair } from '@/src/components/TokenPair'
import { formatCryptoVal } from '@/src/utils/numbers'
import Link from 'next/link'
import ScrollableTable from '@/src/components/ScrollableTable'
import { TransactionsPageQuery } from '@/src/__generated__/TransactionsPageQuery.graphql'

// Helper to format currency values
const formatCurrency = (value: string | null | undefined): string => {
  if (!value || value === '0') return '$0'

  const numValue = parseFloat(value)

  if (numValue < 0.01) return '<$0.01'
  if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`
  if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`
  if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`

  return `$${numValue.toFixed(2)}`
}

// Helper to format token amount
const formatTokenAmount = (amount: string, symbol: string | null | undefined): string => {
  if (!amount || amount === '0') return '0'

  const numAmount = formatCryptoVal(BigInt(amount))

  // For normal amounts, format with 3 significant digits max
  return `${numAmount} ${symbol || ''}`
}

// Helper to format time ago
const formatTimeAgo = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000)
  const seconds = now - timestamp

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Helper to abbreviate address
const abbreviateAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Define the component props with proper types from Relay
interface TransactionsDisplayProps {
  data: {
    recentTransactions: {
      edges: ReadonlyArray<{
        readonly node: {
          readonly id: string;
          readonly txHash: string;
          readonly timestamp: number;
          readonly userAddress: string;
          readonly token0: {
            readonly id: string;
            readonly address: string;
            readonly symbol: string | null;
            readonly " $fragmentSpreads": any;
          } | null;
          readonly token1: {
            readonly id: string;
            readonly address: string;
            readonly symbol: string | null;
            readonly " $fragmentSpreads": any;
          } | null;
          readonly amountIn0: string;
          readonly amountIn1: string;
          readonly amountOut0: string;
          readonly amountOut1: string;
          readonly valueUSD: string | null;
        };
      }>;
      pageInfo: {
        readonly hasNextPage: boolean;
        readonly endCursor: string | null;
      };
      totalCount: number;
    };
  } | null;
  hasMore?: boolean;
  isLoading?: boolean;
  loaderRef?: React.RefObject<HTMLDivElement>;
}

export const TransactionsDisplay: React.FC<TransactionsDisplayProps> = ({ 
  data, 
  hasMore = false, 
  isLoading = false, 
  loaderRef 
}) => {
  // Early return if there's no data
  if (!data || !data.recentTransactions || !data.recentTransactions.edges) {
    return (
      <View padding={4} align="center">
        <Text>No transactions found</Text>
      </View>
    );
  }

  return (
    <ScrollableTable minWidth="1000px">
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
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Time
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Type
          </Text>
        </View.Item>

        <View.Item columns={4}>
          <Text color="neutral-faded" weight="medium">
            Token Pair
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Token Amount
          </Text>
        </View.Item>

        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">
            Token Amount
          </Text>
        </View.Item>

        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">
            Value
          </Text>
        </View.Item>
      </View>

      {/* Table Body */}
      <View direction="column" gap={0} width="100%">
        {data.recentTransactions.edges.map(({ node }) => {
          // Determine the direction of the swap
          const isExactIn0 =
            parseFloat(node.amountIn0) > 0 && parseFloat(node.amountOut1) > 0
          const token0Symbol = node.token0?.symbol || '?'
          const token1Symbol = node.token1?.symbol || '?'

          let swapDescription = ''
          let fromTokenAmount = ''
          let toTokenAmount = ''

          if (isExactIn0) {
            // Swap from token0 to token1
            swapDescription = `Swap ${token0Symbol} for ${token1Symbol}`
            fromTokenAmount = formatTokenAmount(node.amountIn0, token0Symbol)
            toTokenAmount = formatTokenAmount(node.amountOut1, token1Symbol)
          } else {
            // Swap from token1 to token0
            swapDescription = `Swap ${token1Symbol} for ${token0Symbol}`
            fromTokenAmount = formatTokenAmount(node.amountIn1, token1Symbol)
            toTokenAmount = formatTokenAmount(node.amountOut0, token0Symbol)
          }

          return (
            <View
              key={node.id}
              direction="row"
              gap={0}
              padding={4}
              className={'border-0 border-neutral-faded'}
              align="center"
              width="100%"
            >
              <View.Item columns={2}>
                <Text variant="body-3" color="primary">
                  <a href={`https://kubscan.com/tx/${node.txHash}`} target="_blank">
                    {formatTimeAgo(node.timestamp)}
                  </a>
                </Text>
              </View.Item>

              <View.Item columns={1}>
                <Text variant="body-3">Swap</Text>
              </View.Item>

              <View.Item columns={4}>
                <View direction="row" align="center" gap={2}>
                  {node.token0 && node.token1 && (
                    <TokenPair tokenA={node.token0} tokenB={node.token1} size="small" />
                  )}
                  <Text variant="body-3">{swapDescription}</Text>
                </View>
              </View.Item>

              <View.Item columns={2}>
                <Text variant="body-3">{fromTokenAmount}</Text>
              </View.Item>

              <View.Item columns={2}>
                <Text variant="body-3">{toTokenAmount}</Text>
              </View.Item>

              <View.Item columns={1}>
                <Text variant="body-3">{formatCurrency(node.valueUSD)}</Text>
              </View.Item>
            </View>
          )
        })}
        
        {/* Loading indicator row */}
        {hasMore && (
          <View
            direction="row"
            gap={0}
            padding={4}
            className={'border-0 border-neutral-faded'}
            align="center"
            width="100%"
          >
            <View.Item columns={12}>
              <View align="center" width="100%">
                <div ref={loaderRef}>
                  <Loader size="medium" />
                </div>
              </View>
            </View.Item>
          </View>
        )}
      </View>
    </ScrollableTable>
  )
}
