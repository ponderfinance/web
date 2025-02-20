'use client'
import { View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
import FarmingPage from '@/src/app/modules/farm/components/FarmPage'
import CreateFarm from '@/src/app/modules/farm/components/CreateFarm'
import FeesPage from '@/src/app/modules/stake/components/FeeManagement'
export default function Farm() {
  return (
    <View direction="column">
      <View align="center" paddingInline={4} paddingBottom={12} insetTop={28}>
        {/*<CreateFarm />*/}
        <FeesPage />
        <FarmingPage />
      </View>
    </View>
  )
}
