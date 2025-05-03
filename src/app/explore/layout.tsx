'use client'

import React, { Suspense } from 'react'
import { View, Text } from 'reshaped'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import GlobalProtocolMetrics, { GlobalProtocolMetricsSkeleton } from '@/src/modules/explore/components/GlobalProtocolMetrics'

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Determine if each tab is active
  const isTokensActive = pathname === '/explore/tokens' || pathname === '/explore'
  const isPoolsActive = pathname === '/explore/pools'
  const isTransactionsActive = pathname === '/explore/transactions'
  
  // Check if we're on a token detail page (matches /explore/tokens/[address])
  const isTokenDetailPage = pathname.match(/^\/explore\/tokens\/0x[a-fA-F0-9]+$/) !== null

  return (
    <View gap={6} padding={4}>
      {/* Global protocol metrics */}
      {!isTokenDetailPage && (
        <Suspense fallback={<GlobalProtocolMetricsSkeleton />}>
          <GlobalProtocolMetrics />
        </Suspense>
      )}
      
      {/* Only show tabs navigation if not on a token detail page */}
      {!isTokenDetailPage && (
        <View direction="row" gap={{ s: 4, m: 6 }}>
          <Link href="/explore/tokens">
            <Text
              variant={{ s: 'featured-3', m: 'featured-2' }}
              color={isTokensActive ? 'neutral' : 'neutral-faded'}
            >
              Tokens
            </Text>
          </Link>

          <Link href="/explore/pools">
            <Text
              variant={{ s: 'featured-3', m: 'featured-2' }}
              color={isPoolsActive ? 'neutral' : 'neutral-faded'}
            >
              Pools
            </Text>
          </Link>

          <Link href="/explore/transactions">
            <Text
              variant={{ s: 'featured-3', m: 'featured-2' }}
              color={isTransactionsActive ? 'neutral' : 'neutral-faded'}
            >
              Transactions
            </Text>
          </Link>
        </View>
      )}

      {children}
    </View>
  )
}
