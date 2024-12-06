'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={32}>
        <SwapInterface
          defaultTokenIn="0x83140338c917690Ad94Da099aC4BFCf2Cf9c5291"
          defaultTokenOut="0x3b9656251F82a40118E08210823Fff1A97F60C2D"
        />
      </View>
    </View>
  )
}
