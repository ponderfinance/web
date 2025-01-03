'use client'
import { View } from 'reshaped'
import AddLiquidityForm from '@/src/app/components/AddLiquidityForm'
import LiquidityPositionsList from '@/src/app/components/LiqudityPositionsList'
import RemoveLiquidityForm from '@/src/app/components/RemoveLiquidityForm'
import CreatePair from '@/src/app/components/CreatePair'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        {/*<CreatePair />*/}
        <AddLiquidityStepper
          defaultTokenA="0x0852465CE1aeD3644bdc629c6acb0BB9F6FB8e46"
          defaultTokenB="0x074282BB91529743C66D5AF429dF1ea1BB0519a0"
        />
        {/*<RemoveLiquidityForm />*/}
        <LiquidityPositionsList />
      </View>
    </View>
  )
}
