import React from 'react'
import { View } from 'reshaped'
import { useLazyLoadQuery, useFragment } from 'react-relay'
import { graphql } from 'relay-runtime'
import LaunchToken from './LaunchToken'
import LaunchContributionCard from './LaunchContributionCard'
import type { LaunchDetailViewQuery } from '@/src/__generated__/LaunchDetailViewQuery.graphql'
import type { LaunchDetailView_launch$key } from '@/src/__generated__/LaunchDetailView_launch.graphql'

const LaunchDetailFragment = graphql`
  fragment LaunchDetailView_launch on Launch {
    id
    launchId
    ...LaunchToken_launch
  }
`

const LaunchDetailQuery = graphql`
  query LaunchDetailViewQuery($launchId: Int!) {
    launch(launchId: $launchId) {
      ...LaunchDetailView_launch
      ...LaunchToken_launch
    }
  }
`

interface LaunchDetailViewProps {
  launchId: number
}

export default function LaunchDetailView({ launchId }: LaunchDetailViewProps) {
  const data = useLazyLoadQuery<LaunchDetailViewQuery>(LaunchDetailQuery, { launchId })
  
  if (!data.launch) {
    return <View>Launch not found</View>
  }

  const launch = useFragment<LaunchDetailView_launch$key>(
    LaunchDetailFragment,
    data.launch
  )

  return (
    <View direction="column" gap={4}>
      <LaunchToken launch={data.launch} />
      <LaunchContributionCard launchId={BigInt(launch.launchId)} />
    </View>
  )
} 