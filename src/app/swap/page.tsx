'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
export default function Swap() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <SwapInterface
          defaultTokenIn="0xbBf29f5b04d2469E9ebB12caBa0D902Ae59699Ff"
          defaultTokenOut="0x56deBC624a43c84479b79d2Dfe4Db9612C1AFe61"
        />
      </View>
    </View>
  )
}
