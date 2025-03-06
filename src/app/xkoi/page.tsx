'use client'
import { View } from 'reshaped'
// import KoiPond from '@/src/app/modules/farm/components/KoiPond'
import FeesPage from '@/src/app/modules/stake/components/FeeManagement'
export default function Farm() {
  return (
    <View direction="column">
      <View
        align="center"
        gap={6}
        paddingBottom={12}
      >
        <FeesPage />
        {/*<KoiPond />*/}
      </View>
    </View>
  )
}
