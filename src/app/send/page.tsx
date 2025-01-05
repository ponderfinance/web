'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        <SwapInterface
          defaultTokenIn="0x3473fbe6123806d8Cc03ea4Ebc8bD35bdDEA3c0B"
          defaultTokenOut="0xFccD21D36D2C06837C8e43db3169592BB042E256"
        />
      </View>
    </View>
  )
}
