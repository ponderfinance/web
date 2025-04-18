'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { View } from 'reshaped'
import TokenDetailContent from './TokenDetailContent'
import SwapInterface from '@/src/components/Swap'
import { KKUB_ADDRESS } from '@ponderfinance/sdk'
import { CURRENT_CHAIN } from '@/src/constants/chains'

interface TokenDetailPageProps {
  params: {
    address: string
  }
}

// Lightweight loading component for TokenDetailContent
const TokenDetailLoader = () => (
  <View 
    height={{ s: 400, m: 500 }}
    width="100%"
    borderRadius="large"
    backgroundColor="elevation-base"
  />
)

export default function TokenDetailPage({ params }: TokenDetailPageProps) {
  const { address } = params
  
  // Only render client-side data after component is mounted
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    
    // Prioritize critical rendering
    return () => {
      // Cleanup if needed
    }
  }, [])

  if (!isMounted) {
    return (
      <View direction="column" gap={6}>
        <View direction={{ s: 'column', m: 'row' }} gap={8}>
          <View.Item columns={{ s: 12, m: 7 }}>
            <TokenDetailLoader />
          </View.Item>
          <View.Item columns={{ s: 12, m: 5 }}>
            {/* Empty placeholder for swap interface */}
            <View 
              height={400}
              width="100%"
              borderRadius="large"
              backgroundColor="elevation-base"
            />
          </View.Item>
        </View>
      </View>
    )
  }

  return (
    <View direction="column" gap={6}>
      {/* Two column layout */}
      <View direction={{ s: 'column', m: 'row' }} gap={8}>
        {/* Chart container */}
        <View.Item columns={{ s: 12, m: 7 }}>
          <Suspense fallback={<TokenDetailLoader />}>
            <TokenDetailContent tokenAddress={address} />
          </Suspense>
        </View.Item>
        
        {/* Swap interface - render immediately */}
        <View.Item columns={{ s: 12, m: 5 }}>
          <SwapInterface
            defaultTokenIn={
              KKUB_ADDRESS[CURRENT_CHAIN.id].toLowerCase() === address.toLowerCase()
                ? '0x0000000000000000000000000000000000000000'
                : KKUB_ADDRESS[CURRENT_CHAIN.id]
            }
            defaultTokenOut={address as `0x${string}`}
            defaultWidth="100%"
          />
        </View.Item>
      </View>
    </View>
  )
}
