'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View paddingInline={16} maxWidth={'1280px'}>
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0x9F181EB556Afb162002604bA2dC7c83bc11D6cbE"
          defaultTokenB="0x9c3ae329a6BcCd5d18c45a80d01f8f149a73D3a9"
        />
      </View>
    </View>
  )
}
