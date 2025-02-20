'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0xcFfC775E261d26595C9ec17Ad36cc2783785DD84" />
      </View>
    </View>
  )
}
