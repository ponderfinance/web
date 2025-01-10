'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <SwapInterface
          defaultTokenIn="0x9F181EB556Afb162002604bA2dC7c83bc11D6cbE"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
