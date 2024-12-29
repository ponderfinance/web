'use client'
import { View } from 'reshaped'
import AddLiquidityForm from '@/app/components/AddLiquidityForm'
import LiquidityPositionsList from '@/app/components/LiqudityPositionsList'
import RemoveLiquidityForm from '@/app/components/RemoveLiquidityForm'
import CreatePair from '@/app/components/CreatePair'
export default function Pool() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        <CreatePair />
        <AddLiquidityForm
          defaultTokenA="0x174859cF3Baef0d65F854398CD949447eccc5b5f"
          defaultTokenB="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
        <RemoveLiquidityForm />
        <LiquidityPositionsList />
      </View>
    </View>
  )
}
