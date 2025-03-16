import React, { Suspense } from 'react'
import { ExplorePage } from '@/src/modules/explore/components/ExplorePage'
import { View, Text } from 'reshaped'

// Loading component
function ExploreLoading(): React.ReactElement {
  return (
    <View align="center" justify="center" height="60vh">
      <View gap={4} align="center">
        <Text>Loading pools...</Text>
      </View>
    </View>
  )
}

export default function Explore(): React.ReactElement {
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExplorePage />
    </Suspense>
  )
}
