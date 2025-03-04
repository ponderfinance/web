'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <Send defaultTokenToSend="0xe0432224871917fb5a137f4a153a51ecf9f74f57" />
    </View>
  )
}
