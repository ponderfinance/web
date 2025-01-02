'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        <SwapInterface
          defaultTokenIn="0xfCf1899E63De93dE288379A264A19003c526a9c5"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
