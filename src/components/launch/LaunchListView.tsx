import React from 'react'
import { View, Text, Card, Image } from 'reshaped'
import { useLazyLoadQuery, useFragment } from 'react-relay'
import { graphql } from 'relay-runtime'
import Link from 'next/link'
import type { LaunchListViewQuery } from '@/src/__generated__/LaunchListViewQuery.graphql'
import type { LaunchListView_launch$key } from '@/src/__generated__/LaunchListView_launch.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

const LaunchListFragment = graphql`
  fragment LaunchListView_launch on Launch {
    id
    launchId
    imageURI
    status
    kubRaised
    ponderRaised
  }
`

const LaunchListQuery = graphql`
  query LaunchListViewQuery {
    activeLaunches {
      edges {
        node {
          id
          ...LaunchListView_launch
        }
      }
    }
  }
`

interface LaunchCardProps {
  launch: LaunchListView_launch$key
}

function LaunchCard({ launch }: LaunchCardProps) {
  const data = useFragment(LaunchListFragment, launch)

  return (
    <Link href={`/launch/${data.launchId}`}>
      <Card padding={4}>
        <View direction="column" gap={4}>
          <View position="relative" height={200}>
            <Image
              src={getIpfsGateway(data.imageURI ?? '')}
              alt={`Launch #${data.launchId}`}
              width="100%"
              height="100%"
            />
          </View>
          <View direction="column" gap={2}>
            <Text variant="title-2">Launch #{data.launchId}</Text>
            <Text>Status: {data.status}</Text>
            <Text>KUB Raised: {data.kubRaised}</Text>
            <Text>PONDER Raised: {data.ponderRaised}</Text>
          </View>
        </View>
      </Card>
    </Link>
  )
}

export default function LaunchListView() {
  const data = useLazyLoadQuery<LaunchListViewQuery>(LaunchListQuery, {})

  if (!data.activeLaunches?.edges?.length) {
    return (
      <View>
        <Text>No active launches found</Text>
      </View>
    )
  }

  return (
    <View direction="column" gap={4}>
      {data.activeLaunches.edges.map(edge => (
        edge?.node && <LaunchCard key={edge.node.id} launch={edge.node} />
      ))}
    </View>
  )
} 