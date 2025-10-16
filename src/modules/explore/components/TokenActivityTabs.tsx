'use client'

import React, { useState } from 'react'
import { View, Tabs, Text } from 'reshaped'
import { TokenPoolsTab } from './TokenPoolsTab'
import { TokenTransactionsTab } from './TokenTransactionsTab'

interface TokenActivityTabsProps {
  tokenAddress: string
}

export function TokenActivityTabs({ tokenAddress }: TokenActivityTabsProps) {
  const [activeTab, setActiveTab] = useState('transactions')

  const tabs = [
    { value: 'transactions', label: 'Transactions' },
    { value: 'pools', label: 'Pools' }
  ]

  const handleTabChange = (args: { value: string }) => {
    setActiveTab(args.value)
  }

  // Get the label for the current active tab
  const activeTabLabel = tabs.find(tab => tab.value === activeTab)?.label || 'Transactions'

  return (
    <View direction="column" gap={4} width="100%" paddingBottom={6}>
      {/* Section Header that shows active tab */}
      <Text variant="featured-2" weight="regular">
        {activeTabLabel}
      </Text>

      {/* Tab headers */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        items={tabs}
      />

      {/* Tab content */}
      <View width="100%">
        {activeTab === 'transactions' && (
          <TokenTransactionsTab tokenAddress={tokenAddress} />
        )}
        {activeTab === 'pools' && (
          <TokenPoolsTab tokenAddress={tokenAddress} />
        )}
      </View>
    </View>
  )
}