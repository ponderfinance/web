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


export default function TokenDetailPage({ params }: TokenDetailPageProps) {
  const { address } = params
  

  return (
    <View direction="column" gap={6}>
      {/* Two column layout */}
      <View direction={{ s: 'column', m: 'row' }} gap={8}>
        {/* Chart container */}
        <View.Item columns={{ s: 12, m: 7 }}>
          <Suspense>
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
