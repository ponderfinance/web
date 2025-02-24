'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <Send defaultTokenToSend="0xe456B9B279e159842a91375e382804F7980e8Aa7" />
      </View>
    </View>
  )
}
