'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0x53Fc2AD8F36BCeFE7a933E1237B45c7A70AD80a5" />
      </View>
    </View>
  )
}
