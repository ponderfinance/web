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
          defaultTokenA="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
          defaultTokenB="0xFccD21D36D2C06837C8e43db3169592BB042E256"
        />
        {/*<RemoveLiquidityForm />*/}
        <LiquidityPositionsList />
      </View>
    </View>
  )
}
