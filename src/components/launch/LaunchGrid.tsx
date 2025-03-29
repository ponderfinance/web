import { View, Text, Card, Grid } from 'reshaped'
import { useFragment, useLazyLoadQuery } from 'react-relay'
import { graphql } from 'relay-runtime'
import Link from 'next/link'
import Image from 'next/image'

const LaunchGridFragment = graphql`
  fragment LaunchGridFragment on Launch {
    id
    launchId
    tokenAddress
    creatorAddress
    imageURI
    kubRaised
    ponderRaised
    status
    kubPairAddress
    ponderPairAddress
    hasDualPools
    ponderPoolSkipped
    kubLiquidity
    ponderLiquidity
    ponderBurned
    lpWithdrawn
    lpWithdrawnAt
    completedAt
    cancelledAt
    createdAt
    updatedAt
  }
`

const LaunchGridQuery = graphql`
  query LaunchGridQuery {
    activeLaunches(first: 20) {
      edges {
        node {
          ...LaunchGridFragment
        }
      }
    }
  }
`

interface LaunchGridData {
  activeLaunches: {
    edges: Array<{
      node: {
        id: string
        launchId: number
        imageURI: string
        status: string
        kubRaised: string
        ponderRaised: string
      }
    }>
  }
}

function LaunchCard({ launch }: { launch: any }) {
  const data = useFragment(LaunchGridFragment, launch)
  
  return (
    <Link href={`/launch/${data.launchId}`}>
      <Card padding={4}>
        <View direction="column" gap={4}>
          <View position="relative" height={200}>
            <Image
              src={data.imageURI}
              alt={`${data.launchId} Launch`}
              fill
              style={{ objectFit: 'cover' }}
            />
          </View>
          <View direction="column" gap={2}>
            <Text>Launch #{data.launchId}</Text>
            <Text>Status: {data.status}</Text>
            <Text>KUB Raised: {data.kubRaised}</Text>
            <Text>PONDER Raised: {data.ponderRaised}</Text>
          </View>
        </View>
      </Card>
    </Link>
  )
}

export default function LaunchGrid() {
  const data = useLazyLoadQuery<LaunchGridData>(LaunchGridQuery, {})

  return (
    <View direction="column" gap={4}>
      <Text variant="title-1">Active Launches</Text>
      <Grid columns={4} gap={4}>
        {data.activeLaunches.edges.map((edge) => (
          <LaunchCard key={edge.node.id} launch={edge.node} />
        ))}
      </Grid>
    </View>
  )
} 