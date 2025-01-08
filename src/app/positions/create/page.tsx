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
          defaultTokenB="0x223f1397e9D1250C291a568E2F82601c62c14560"
        />
      </View>
    </View>
  )
}
