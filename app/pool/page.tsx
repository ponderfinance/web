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
          defaultTokenA="0xfCf1899E63De93dE288379A264A19003c526a9c5"
          defaultTokenB="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
        <RemoveLiquidityForm />
        <LiquidityPositionsList />
      </View>
    </View>
  )
}
