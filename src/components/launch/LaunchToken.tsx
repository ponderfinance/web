import React from 'react'
import { View, Text, Card, Image } from 'reshaped'
import { useFragment } from 'react-relay'
import { graphql } from 'relay-runtime'
import type { LaunchToken_launch$key } from '@/src/__generated__/LaunchToken_launch.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

const LaunchTokenFragment = graphql`
  fragment LaunchToken_launch on Launch {
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

interface LaunchTokenProps {
  launch: LaunchToken_launch$key
}

export default function LaunchToken({ launch }: LaunchTokenProps) {
  const data = useFragment(LaunchTokenFragment, launch)

  return (
    <Card padding={4}>
      <View direction="column" gap={4}>
        {/* Launch Image */}
        <View position="relative" height={400}>
          <Image
            src={getIpfsGateway(data.imageURI ?? '')}
            alt={`Launch #${data.launchId}`}
            width="100%"
            height="100%"
          />
        </View>

        {/* Launch Info */}
        <View direction="column" gap={2}>
          <Text variant="title-1">Launch #{data.launchId}</Text>
          <Text>Status: {data.status}</Text>
          <Text>Creator: {data.creatorAddress}</Text>
          <Text>Token Address: {data.tokenAddress}</Text>
          <Text>KUB Raised: {data.kubRaised}</Text>
          <Text>PONDER Raised: {data.ponderRaised}</Text>
          
          {data.kubPairAddress && (
            <Text>KUB Pair: {data.kubPairAddress}</Text>
          )}
          {data.ponderPairAddress && (
            <Text>PONDER Pair: {data.ponderPairAddress}</Text>
          )}
          
          {data.kubLiquidity && (
            <Text>KUB Liquidity: {data.kubLiquidity}</Text>
          )}
          {data.ponderLiquidity && (
            <Text>PONDER Liquidity: {data.ponderLiquidity}</Text>
          )}
          
          {data.ponderBurned && (
            <Text>PONDER Burned: {data.ponderBurned}</Text>
          )}
          
          {data.lpWithdrawn && (
            <Text>LP Tokens Withdrawn: Yes</Text>
          )}
          {data.lpWithdrawnAt && (
            <Text>LP Withdrawn At: {new Date(data.lpWithdrawnAt).toLocaleString()}</Text>
          )}
          
          {data.completedAt && (
            <Text>Completed At: {new Date(data.completedAt).toLocaleString()}</Text>
          )}
          {data.cancelledAt && (
            <Text>Cancelled At: {new Date(data.cancelledAt).toLocaleString()}</Text>
          )}
          
          <Text>Created At: {new Date(data.createdAt).toLocaleString()}</Text>
          <Text>Last Updated: {new Date(data.updatedAt).toLocaleString()}</Text>
        </View>
      </View>
    </Card>
  )
}
