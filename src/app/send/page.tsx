'use client'
import { View } from 'reshaped'
import Send from '@/src/modules/send/components/Send'
import { KOI_ADDRESS } from '@/src/constants/addresses'
import { CURRENT_CHAIN } from '@/src/constants/chains'

export default function Swap() {
  return (
    <View direction="column">
      <Send defaultTokenToSend={KOI_ADDRESS[CURRENT_CHAIN.id]} />
    </View>
  )
}
