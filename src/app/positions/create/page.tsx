'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View paddingInline={16} maxWidth={'1280px'}>
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0x66Ecc3cbFAb2c9Eb8bFe91b4fE65F57129F4d164"
          defaultTokenB="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>
    </View>
  )
}
