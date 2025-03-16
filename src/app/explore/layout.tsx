'use client'

import React from 'react'
import { View, Text } from 'reshaped'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Determine if each tab is active
  const isTokensActive = pathname === '/explore/tokens' || pathname === '/explore'
  const isPoolsActive = pathname === '/explore/pools'
  const isTransactionsActive = pathname === '/explore/transactions'

  return (
    <View gap={6} padding={4}>
      <View direction="row" gap={6}>
        <Link href="/explore/tokens">
          <Text variant="featured-2" color={isTokensActive ? 'neutral' : 'neutral-faded'}>
            Tokens
          </Text>
        </Link>

        <Link href="/explore/pools">
          <Text variant="featured-2" color={isPoolsActive ? 'neutral' : 'neutral-faded'}>
            Pools
          </Text>
        </Link>

        <Link href="/explore/transactions">
          <Text
            variant="featured-2"
            color={isTransactionsActive ? 'neutral' : 'neutral-faded'}
          >
            Transactions
          </Text>
        </Link>
      </View>

      {children}
    </View>
  )
}
