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
          defaultTokenB="0xFccD21D36D2C06837C8e43db3169592BB042E256"
        />
        {/*<RemoveLiquidityForm />*/}
        <LiquidityPositionsList />
      </View>
    </View>
  )
}
