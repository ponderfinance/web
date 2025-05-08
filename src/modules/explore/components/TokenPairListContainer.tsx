'use client'

import React from 'react'
import { View, Text } from 'reshaped'
import Link from 'next/link'

interface TokenPairListContainerProps {
  tokenAddress: string
}

export default function TokenPairListContainer({ tokenAddress }: TokenPairListContainerProps) {
  // In a real implementation, this would fetch pair data using Relay
  // For our demo purposes, we'll just display a placeholder
  
  return (
    <View direction="column" gap={4}>
      <Text variant="featured-2" weight="medium" color="neutral">
        Pools
      </Text>
      <View padding={6} align="center" justify="center">
        <Text color="neutral-faded">
          Real-time pool data will appear here when you perform swaps
        </Text>
      </View>
      <View align="center">
        <Link href={`/explore/tokens/${tokenAddress}/pools`} style={{ textDecoration: 'none' }}>
          <Text color="primary">View all pools</Text>
        </Link>
      </View>
    </View>
  )
} 