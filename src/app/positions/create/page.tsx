'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View paddingInline={16} maxWidth={'1280px'}>
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0x54e75E45842855Df24d96908a229575cD101b914"
          defaultTokenB="0xE24449Af4728ae8147cD6F4d18229405932F1156"
        />
      </View>
    </View>
  )
}
