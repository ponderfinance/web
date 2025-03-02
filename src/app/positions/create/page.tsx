'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View padding={2} maxWidth={'1032px'}>
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0x33C9B02596d7b1CB4066cC2CeEdd37f3A7c7Aa07"
          defaultTokenB="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
