'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={32}>
        <SwapInterface
          defaultTokenIn="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
          defaultTokenOut="0x4d26358485B4261956532D3c4816b753842bb9Ce"
        />
      </View>
    </View>
  )
}
