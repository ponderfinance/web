'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
import FarmingPage from '@/src/app/modules/farm/components/FarmPage'
import CreateFarm from '@/src/app/modules/farm/components/CreateFarm'
import StakingPage from '@/src/app/modules/stake/components/PonderStaking'
import FeesPage from '@/src/app/modules/stake/components/FeeManagement'
export default function Farm() {
  return (
    <View direction="column">
      <View paddingTop={32}>
        <CreateFarm />
        <FeesPage />
        <StakingPage />
        <FarmingPage />
      </View>
    </View>
  )
}
