'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        <SwapInterface
          defaultTokenIn="0x174859cF3Baef0d65F854398CD949447eccc5b5f"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
