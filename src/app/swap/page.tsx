'use client'
import { View } from 'reshaped'
import { ClientSwapInterface } from '@/src/components/Swap'
import { KOI_ADDRESS } from '@/src/constants/addresses'
import { CURRENT_CHAIN } from '@/src/constants/chains'

export default function Swap() {
  return (
    <View direction="column">
      <ClientSwapInterface
        defaultTokenIn="0x0000000000000000000000000000000000000000"
        defaultTokenOut={KOI_ADDRESS[CURRENT_CHAIN.id]}
      />
    </View>
  )
}
