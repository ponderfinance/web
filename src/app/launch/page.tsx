'use client'

import { View } from 'reshaped'
import LaunchListView from '@/src/components/launch/LaunchListView'
import RelayProvider from '@/src/lib/relay/RelayProvider'

export default function LaunchPage() {
  return (
    <RelayProvider>
      <View padding={4}>
        <LaunchListView />
      </View>
    </RelayProvider>
  )
}
