'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View
        paddingInline={16}
        maxWidth={'1280px'}
      >
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
          defaultTokenB="0xbBf29f5b04d2469E9ebB12caBa0D902Ae59699Ff"
        />
      </View>
    </View>
  )
}
