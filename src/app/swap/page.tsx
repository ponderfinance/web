'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
import { KOI_ADDRESS } from '@/src/app/constants/addresses'
import { CURRENT_CHAIN } from '@/src/app/constants/chains'
export default function Swap() {
  return (
    <View direction="column">
      <SwapInterface
        defaultTokenIn={KOI_ADDRESS[CURRENT_CHAIN.id]}
        defaultTokenOut="0x0000000000000000000000000000000000000000"
      />
    </View>
  )
}
