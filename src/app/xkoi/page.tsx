'use client'
import { View } from 'reshaped'
import FarmingPage from '@/src/app/modules/farm/components/FarmPage'
import FeesPage from '@/src/app/modules/stake/components/FeeManagement'
export default function Farm() {
  return (
    <View direction="column">
      <View
        align="center"
        gap={6}
        paddingBottom={12}
        insetTop={{ s: 16, m: 28 }}
      >
        <FeesPage />
        <FarmingPage />
      </View>
    </View>
  )
}
