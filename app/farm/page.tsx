'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
import FarmingPage from '@/app/components/FarmPage'
import CreateFarm from '@/app/components/CreateFarm'
export default function Farm() {
  return (
    <View direction="column">
      <View insetTop={32}>
        {/*<CreateFarm />*/}
        <FarmingPage />
      </View>
    </View>
  )
}
