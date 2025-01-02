'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
import FarmingPage from '@/app/modules/farm/components/FarmPage'
import CreateFarm from '@/app/modules/farm/components/CreateFarm'
import StakingPage from '@/app/modules/stake/components/PonderStaking'
import FeesPage from '@/app/modules/stake/components/FeeManagement'
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
