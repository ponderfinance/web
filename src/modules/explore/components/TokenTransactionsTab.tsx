'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { View, Text, Skeleton, Image } from 'reshaped'
import { graphql, useLazyLoadQuery, useFragment } from 'react-relay'
import { TokenTransactionsTabQuery } from '@/src/__generated__/TokenTransactionsTabQuery.graphql'
import { formatCryptoVal } from '@/src/utils/numbers'
import { getIpfsGateway } from '@/src/utils/ipfs'
import ScrollableTable from '@/src/components/ScrollableTable'
import { LoadMore } from '@/src/components/LoadMore'
import { tokenFragment } from '@/src/components/TokenPair'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'

// Main query - get token with all its pairs and their swaps
export const tokenSwapsQuery = graphql`
  query TokenTransactionsTabQuery($tokenAddress: String!, $swapsPerPair: Int!) {
    tokenByAddress(address: $tokenAddress) {
      id
      address
      symbol
      imageUri
      decimals
      pairsAsToken0 {
        id
        address
        token0 {
          ...TokenPairFragment
        }
        token1 {
          ...TokenPairFragment
        }
        swaps(first: $swapsPerPair) {
          edges {
            node {
              id
              txHash
              timestamp
              userAddress
              amountIn0
              amountIn1
              amountOut0
              amountOut1
              valueUSD
            }
          }
        }
      }
      pairsAsToken1 {
        id
        address
        token0 {
          ...TokenPairFragment
        }
        token1 {
          ...TokenPairFragment
        }
        swaps(first: $swapsPerPair) {
          edges {
            node {
              id
              txHash
              timestamp
              userAddress
              amountIn0
              amountIn1
              amountOut0
              amountOut1
              valueUSD
            }
          }
        }
      }
    }
  }
`

// Helper functions
const formatCurrency = (value: string | null | undefined): string => {
  if (!value) return '$0'

  const numValue = parseFloat(value)
  if (isNaN(numValue) || numValue === 0) return '$0'

  if (numValue < 0.01) return '<$0.01'
  if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`
  if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`
  if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`

  return `$${numValue.toFixed(2)}`
}

const formatTokenAmount = (amount: string, symbol: string | null | undefined, decimals: number): string => {
  if (!amount || amount === '0') return '0'

  try {
    const numAmount = formatCryptoVal(BigInt(amount), decimals)
    return `${numAmount} ${symbol || ''}`
  } catch {
    return `0 ${symbol || ''}`
  }
}

const formatTimeAgo = (timestamp: any): string => {
  const now = Math.floor(Date.now() / 1000)
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : Number(timestamp)
  const seconds = now - ts

  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

const abbreviateAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Helper to get token icon (with native KUB special handling)
const getTokenIcon = (token: any): string => {
  // Check if it's native KUB
  const isNativeKub = token.address === '0x0000000000000000000000000000000000000000'

  if (isNativeKub) {
    return '/tokens/bitkub.png'
  }

  // Try to use the token's imageUri
  if (token.imageUri) {
    const ipfsUrl = getIpfsGateway(token.imageUri)
    if (ipfsUrl) return ipfsUrl
  }

  // Fallback to default coin icon
  return '/tokens/coin.svg'
}

// Transaction row component that properly uses hooks
function TransactionRow({
  swap,
  pair,
  targetIsToken0
}: {
  swap: any
  pair: any
  targetIsToken0: boolean
}) {
  // Use useFragment to properly extract token data
  const targetTokenData = useFragment<TokenPairFragment$key>(
    tokenFragment,
    targetIsToken0 ? pair.token0 : pair.token1
  )
  const otherTokenData = useFragment<TokenPairFragment$key>(
    tokenFragment,
    targetIsToken0 ? pair.token1 : pair.token0
  )

  // Determine buy/sell and amounts
  let isBuy = false
  let targetAmount = '0'
  let otherAmount = '0'

  if (targetIsToken0) {
    // Target is token0
    if (parseFloat(swap.amountOut0) > 0) {
      // Receiving token0 = Buy
      isBuy = true
      targetAmount = swap.amountOut0
      otherAmount = swap.amountIn1
    } else {
      // Giving token0 = Sell
      isBuy = false
      targetAmount = swap.amountIn0
      otherAmount = swap.amountOut1
    }
  } else {
    // Target is token1
    if (parseFloat(swap.amountOut1) > 0) {
      // Receiving token1 = Buy
      isBuy = true
      targetAmount = swap.amountOut1
      otherAmount = swap.amountIn0
    } else {
      // Giving token1 = Sell
      isBuy = false
      targetAmount = swap.amountIn1
      otherAmount = swap.amountOut0
    }
  }

  return (
    <View
      direction="row"
      gap={0}
      padding={4}
      className={'border-0 border-neutral-faded'}
      align="center"
      width="100%"
    >
      <View.Item columns={2}>
        <Text variant="body-3" color="primary">
          <a href={`https://kubscan.com/tx/${swap.txHash}`} target="_blank" rel="noreferrer">
            {formatTimeAgo(swap.timestamp)}
          </a>
        </Text>
      </View.Item>

      <View.Item columns={1}>
        <Text variant="body-3" color={isBuy ? 'positive' : 'critical'}>
          {isBuy ? 'Buy' : 'Sell'}
        </Text>
      </View.Item>

      <View.Item columns={3}>
        <View direction="row" align="center" gap={2}>
          <Image
            src={getTokenIcon(otherTokenData)}
            height={6}
            width={6}
            alt={otherTokenData.symbol || 'Token'}
            attributes={{ style: { borderRadius: '50%' } }}
          />
          <Text variant="body-3">
            {formatTokenAmount(otherAmount, otherTokenData.symbol, otherTokenData.decimals)}
          </Text>
        </View>
      </View.Item>

      <View.Item columns={2}>
        <Text variant="body-3">
          {formatTokenAmount(targetAmount, targetTokenData.symbol, targetTokenData.decimals)}
        </Text>
      </View.Item>

      <View.Item columns={2}>
        <Text variant="body-3">{formatCurrency(swap.valueUSD)}</Text>
      </View.Item>

      <View.Item columns={2}>
        <Text variant="body-3">{abbreviateAddress(swap.userAddress)}</Text>
      </View.Item>
    </View>
  )
}

// Loading skeleton component
function TransactionsLoading() {
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
          <Text color="neutral-faded" weight="medium">Time</Text>
        </View.Item>
        <View.Item columns={1}>
          <Text color="neutral-faded" weight="medium">Type</Text>
        </View.Item>
        <View.Item columns={3}>
          <Text color="neutral-faded" weight="medium">For</Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">Token Amount</Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">USD</Text>
        </View.Item>
        <View.Item columns={2}>
          <Text color="neutral-faded" weight="medium">Wallet</Text>
        </View.Item>
      </View>

      {/* Skeleton Rows */}
      <View direction="column" gap={0} width="100%">
        {[...Array(10)].map((_, index) => (
          <View
            key={index}
            direction="row"
            gap={0}
            padding={4}
            align="center"
            width="100%"
          >
            <View.Item columns={2}>
              <Skeleton width="80px" height="24px" />
            </View.Item>
            <View.Item columns={1}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
            <View.Item columns={3}>
              <View direction="row" gap={2} align="center">
                <Skeleton width={8} height={8} borderRadius="circular" />
                <Skeleton width="80px" height="24px" />
              </View>
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="90px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="60px" height="24px" />
            </View.Item>
            <View.Item columns={2}>
              <Skeleton width="100px" height="24px" />
            </View.Item>
          </View>
        ))}
      </View>
    </ScrollableTable>
  )
}

// Component that renders transactions
function TransactionsQueryRenderer({ tokenAddress }: { tokenAddress: string }) {
  const [displayCount, setDisplayCount] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const data = useLazyLoadQuery<TokenTransactionsTabQuery>(
    tokenSwapsQuery,
    {
      tokenAddress,
      swapsPerPair: 100 // Get more swaps from each pair for progressive loading
    },
    { fetchPolicy: 'store-or-network' }
  )

  // Merge and sort swaps from all pairs
  const allSwaps = useMemo(() => {
    if (!data.tokenByAddress) return []

    const swapsWithPairInfo: any[] = []

    // Collect swaps from pairsAsToken0
    data.tokenByAddress.pairsAsToken0?.forEach(pair => {
      pair.swaps?.edges?.forEach(edge => {
        swapsWithPairInfo.push({
          swap: edge.node,
          pair: pair,
          targetIsToken0: true
        })
      })
    })

    // Collect swaps from pairsAsToken1
    data.tokenByAddress.pairsAsToken1?.forEach(pair => {
      pair.swaps?.edges?.forEach(edge => {
        swapsWithPairInfo.push({
          swap: edge.node,
          pair: pair,
          targetIsToken0: false
        })
      })
    })

    // Sort by timestamp descending (no slicing here)
    return swapsWithPairInfo.sort((a, b) => {
      const tsA = typeof a.swap.timestamp === 'string' ? parseInt(a.swap.timestamp) : Number(a.swap.timestamp)
      const tsB = typeof b.swap.timestamp === 'string' ? parseInt(b.swap.timestamp) : Number(b.swap.timestamp)
      return tsB - tsA
    })
  }, [data])

  // Slice to show only the current display count
  const displayedSwaps = useMemo(() => {
    return allSwaps.slice(0, displayCount)
  }, [allSwaps, displayCount])

  // Check if there are more swaps to load
  const hasMore = displayCount < allSwaps.length

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true)
      // Simulate a small delay for smooth UX
      setTimeout(() => {
        setDisplayCount(prev => prev + 20)
        setIsLoadingMore(false)
      }, 300)
    }
  }, [hasMore, isLoadingMore])

  if (!data.tokenByAddress) {
    return (
      <View padding={4} align="center">
        <Text>Token not found</Text>
      </View>
    )
  }

  if (allSwaps.length === 0) {
    return (
      <View padding={4} align="center">
        <Text>No transactions found for this token</Text>
      </View>
    )
  }

  const normalizedTargetAddress = tokenAddress.toLowerCase()

  return (
    <>
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
            <Text color="neutral-faded" weight="medium">Time</Text>
          </View.Item>
          <View.Item columns={1}>
            <Text color="neutral-faded" weight="medium">Type</Text>
          </View.Item>
          <View.Item columns={3}>
            <Text color="neutral-faded" weight="medium">For</Text>
          </View.Item>
          <View.Item columns={2}>
            <Text color="neutral-faded" weight="medium">Token Amount</Text>
          </View.Item>
          <View.Item columns={2}>
            <Text color="neutral-faded" weight="medium">USD</Text>
          </View.Item>
          <View.Item columns={2}>
            <Text color="neutral-faded" weight="medium">Wallet</Text>
          </View.Item>
        </View>

        {/* Table Body */}
        <View direction="column" gap={0} width="100%">
          {displayedSwaps.map(({ swap, pair, targetIsToken0 }) => (
            <TransactionRow
              key={swap.id}
              swap={swap}
              pair={pair}
              targetIsToken0={targetIsToken0}
            />
          ))}
        </View>
      </ScrollableTable>

      {/* Load More Component */}
      {displayedSwaps.length > 0 && (
        <LoadMore
          hasMore={hasMore}
          isLoading={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      )}
    </>
  )
}

// Main export component
export function TokenTransactionsTab({ tokenAddress }: { tokenAddress: string }) {
  return (
    <React.Suspense fallback={<TransactionsLoading />}>
      <TransactionsQueryRenderer tokenAddress={tokenAddress} />
    </React.Suspense>
  )
}