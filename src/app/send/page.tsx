'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0x30E10c8DcdF21A97C8f95195FCFe52391025c773" />
      </View>
    </View>
  )
}
