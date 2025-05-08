'use client'

import React from 'react'
import { View, Text } from 'reshaped'
import Link from 'next/link'

interface TokenTxHistoryContainerProps {
  tokenAddress: string
}

export default function TokenTxHistoryContainer({ tokenAddress }: TokenTxHistoryContainerProps) {
  // In a real implementation, this would fetch transaction data using Relay
  // For our demo purposes, we'll just display a placeholder
  
  return (
    <View direction="column" gap={4}>
      <Text variant="featured-2" weight="medium" color="neutral">
        Recent Transactions
      </Text>
      <View padding={6} align="center" justify="center">
        <Text color="neutral-faded">
          Real-time transaction updates will appear here when available
        </Text>
      </View>
      <View align="center">
        <Link href={`/explore/tokens/${tokenAddress}/transactions`} style={{ textDecoration: 'none' }}>
          <Text color="primary">View all transactions</Text>
        </Link>
      </View>
    </View>
  )
} 