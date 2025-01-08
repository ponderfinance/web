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
          defaultTokenA="0x56deBC624a43c84479b79d2Dfe4Db9612C1AFe61"
          defaultTokenB="0x223f1397e9D1250C291a568E2F82601c62c14560"
        />
      </View>
    </View>
  )
}
