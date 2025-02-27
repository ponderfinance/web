'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0x33C9B02596d7b1CB4066cC2CeEdd37f3A7c7Aa07" />
      </View>
    </View>
  )
}
