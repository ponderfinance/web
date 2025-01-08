'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0x223f1397e9D1250C291a568E2F82601c62c14560" />
      </View>
    </View>
  )
}
