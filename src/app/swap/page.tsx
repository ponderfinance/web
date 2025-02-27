'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <SwapInterface
          defaultTokenIn="0x33C9B02596d7b1CB4066cC2CeEdd37f3A7c7Aa07"
          defaultTokenOut="0x0000000000000000000000000000000000000000"
        />
      </View>
    </View>
  )
}
