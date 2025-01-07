'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0xbBf29f5b04d2469E9ebB12caBa0D902Ae59699Ff" />
      </View>
    </View>
  )
}
