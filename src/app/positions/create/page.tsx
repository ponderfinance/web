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
          defaultTokenA="0xE6CbEDDfe0FD5444154B3fFCcC9bda92F084a71D"
          defaultTokenB="0x986d56796f3B335B7564097fa1A7A31AEb7B3928"
        />
      </View>
    </View>
  )
}
