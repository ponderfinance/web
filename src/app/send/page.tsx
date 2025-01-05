'use client'
import { View } from 'reshaped'
import Send from '@/src/app/modules/send/components/Send'

export default function Swap() {
  return (
    <View direction="column">
      <View paddingTop={16}>
        <Send defaultTokenToSend="0xBa71efd94be63bD47B78eF458DE982fE29f552f7" />
      </View>
    </View>
  )
}
