'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
import FarmingPage from '@/app/modules/farm/components/FarmPage'
import CreateFarm from '@/app/modules/farm/components/CreateFarm'
export default function Farm() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        {/*<CreateFarm />*/}
        <FarmingPage />
      </View>
    </View>
  )
}
