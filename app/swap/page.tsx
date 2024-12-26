'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={32}>
        <SwapInterface
          defaultTokenIn="0x96C5A82c5DE603AeB973F0fef40e8C46A86cb01f"
          defaultTokenOut="0x4d26358485B4261956532D3c4816b753842bb9Ce"
        />
      </View>
    </View>
  )
}
