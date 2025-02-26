'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <SwapInterface
          defaultTokenIn="0xFB0b0CBFd8b2750e5a8db76aeCEA327DCc2687D6"
          defaultTokenOut="0x0000000000000000000000000000000000000000"
        />
      </View>
    </View>
  )
}
