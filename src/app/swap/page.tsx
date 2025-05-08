'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/components/Swap'
import { KKUB_ADDRESS } from '@/src/constants/addresses'
import { CURRENT_CHAIN } from '@/src/constants/chains'
export default function Swap() {
  return (
    <View direction="column">
      <SwapInterface
        defaultTokenIn={KKUB_ADDRESS[CURRENT_CHAIN.id]}
        defaultTokenOut="0x0000000000000000000000000000000000000000"
      />
    </View>
  )
}
