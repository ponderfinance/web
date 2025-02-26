'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <SwapInterface
          defaultTokenIn="0x53Fc2AD8F36BCeFE7a933E1237B45c7A70AD80a5"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
