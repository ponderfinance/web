'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0x9c3ae329a6BcCd5d18c45a80d01f8f149a73D3a9" />
      </View>
    </View>
  )
}
