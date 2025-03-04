'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <SwapInterface
        defaultTokenIn="0xe0432224871917fb5a137f4a153a51ecf9f74f57"
        defaultTokenOut="0x0000000000000000000000000000000000000000"
      />
    </View>
  )
}
