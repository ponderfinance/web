'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View paddingInline={16} maxWidth={'1280px'}>
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0x6B9bE16431ce145060F296aC54F3e6F7E59AE6ae"
          defaultTokenB="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
