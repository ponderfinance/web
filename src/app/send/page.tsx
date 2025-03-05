'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'
import { KOI_ADDRESS } from '@/src/app/constants/addresses'
import { CURRENT_CHAIN } from '@/src/app/constants/chains'

export default function Swap() {
  return (
    <View direction="column">
      <Send defaultTokenToSend={KOI_ADDRESS[CURRENT_CHAIN.id]} />
    </View>
  )
}
