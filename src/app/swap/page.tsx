'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <SwapInterface
          defaultTokenIn="0x986d56796f3B335B7564097fa1A7A31AEb7B3928"
          defaultTokenOut="0xE6CbEDDfe0FD5444154B3fFCcC9bda92F084a71D"
        />
      </View>
    </View>
  )
}
