'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <SwapInterface
          defaultTokenIn="0xC85689A776d8178e952bd0E58675d274bb62A797"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
