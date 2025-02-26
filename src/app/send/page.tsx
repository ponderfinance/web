'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0xFB0b0CBFd8b2750e5a8db76aeCEA327DCc2687D6" />
      </View>
    </View>
  )
}
