'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        <SwapInterface
          defaultTokenIn="0xFccD21D36D2C06837C8e43db3169592BB042E256"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
