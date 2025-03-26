// src/modules/explore/components/ExplorePage.tsx
'use client'

import React, { Suspense, useState } from 'react'
import { View, Text, Actionable } from 'reshaped'
import { TokensPage } from '@/src/modules/explore/components/TokensPage'
import { PoolsPage } from '@/src/modules/explore/components/PoolsPage'
import { TransactionsPage } from '@/src/modules/explore/components/TransactionsPage'

// Loading component for suspense
function ExploreLoading() {
  return <View align="center" justify="center" height="40vh"></View>
}

// Exported page component
export const ExplorePage = () => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'pools' | 'transactions'>('tokens')

  // Handle tab switching
  const handleTabChange = (tab: 'tokens' | 'pools' | 'transactions') => {
    setActiveTab(tab)
  }

  return (
    <View gap={6}>
      <View direction="row" gap={6}>
        <Actionable onClick={() => handleTabChange('tokens')}>
          <Text
            variant="featured-2"
            color={activeTab === 'tokens' ? 'neutral' : 'neutral-faded'}
          >
            Tokens
          </Text>
        </Actionable>
        <Actionable onClick={() => handleTabChange('pools')}>
          <Text
            variant="featured-2"
            color={activeTab === 'pools' ? 'neutral' : 'neutral-faded'}
          >
            Pools
          </Text>
        </Actionable>
        <Actionable onClick={() => handleTabChange('transactions')}>
          <Text
            variant="featured-2"
            color={activeTab === 'transactions' ? 'neutral' : 'neutral-faded'}
          >
            Transactions
          </Text>
        </Actionable>
      </View>

      <Suspense fallback={<ExploreLoading />}>
        {activeTab === 'tokens' && <TokensPage />}
        {activeTab === 'pools' && <PoolsPage />}
        {activeTab === 'transactions' && <TransactionsPage />}
      </Suspense>
    </View>
  )
}
