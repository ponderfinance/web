'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View paddingInline={16} maxWidth={'1280px'}>
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0xa6980c964b43B9bAfA521f39ac5Bd084F94F59D5"
          defaultTokenB="0x94AD416281f9Cbce05D0776b9d22a79A39d9f5F6"
        />
      </View>
    </View>
  )
}
