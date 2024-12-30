'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        <SwapInterface
          defaultTokenIn="0x174859cF3Baef0d65F854398CD949447eccc5b5f"
          defaultTokenOut="0x72a79851059a4DF3A6f64B942b227af7cd39165a"
        />
      </View>
    </View>
  )
}
