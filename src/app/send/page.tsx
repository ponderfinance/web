'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0x66Ecc3cbFAb2c9Eb8bFe91b4fE65F57129F4d164" />
      </View>
    </View>
  )
}
