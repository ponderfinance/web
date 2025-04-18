'use client'

import { useAccount } from 'wagmi'
import { graphql, useLazyLoadQuery, RelayEnvironmentProvider } from 'react-relay'
import { PoolPageQuery } from '@/src/__generated__/PoolPageQuery.graphql'
import { Button, Skeleton, Text, View } from 'reshaped'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { LiquidityPositionsList } from '@/src/components/LiquidityPositionsList'
import React, { Suspense, useState, useEffect } from 'react'
import { getClientEnvironment } from '@/src/lib/relay/environment'

const userPositionsQuery = graphql`
  query PoolPageQuery($userAddress: String!) {
    userPositions(userAddress: $userAddress) {
      liquidityPositions {
        ...LiquidityPositionItem_position
      }
    }
  }
`

// Loading component for suspense
function PoolLoading() {
  return (
    <View direction="column" gap={16}>
      <Skeleton height={'222px'} width="100%" borderRadius="large" />
      <Skeleton height={'222px'} width="100%" borderRadius="large" />
      <Skeleton height={'222px'} width="100%" borderRadius="large" />
    </View>
  )
}

// Main content component that fetches data
function PoolContent({ userAddress }: { userAddress: string }) {
  // Fetch data at the content level
  const data = useLazyLoadQuery<PoolPageQuery>(
    userPositionsQuery,
    {
      userAddress: userAddress || '',
    },
    {
      fetchPolicy: 'network-only',
    }
  )

  return <LiquidityPositionsList positionsData={data.userPositions} />
}

// Wrapper to ensure Relay environment is available
function PoolContentWithRelay({ userAddress }: { userAddress: string }) {
  const [environment, setEnvironment] = useState<any>(null);
  
  useEffect(() => {
    // Get the Relay environment on the client side
    const relayEnvironment = getClientEnvironment();
    setEnvironment(relayEnvironment);
  }, []);
  
  // Don't render anything until we have the environment
  if (!environment) {
    return <PoolLoading />;
  }
  
  return (
    <RelayEnvironmentProvider environment={environment}>
      <Suspense fallback={<PoolLoading />}>
        <PoolContent userAddress={userAddress} />
      </Suspense>
    </RelayEnvironmentProvider>
  );
}

// Exported page component
export const PoolPage = () => {
  const account = useAccount()
  const userAddress = account.address?.toLowerCase() || ''

  return (
    <View direction="column">
      <View gap={12}>
        <View gap={4}>
          <Text variant="featured-2">Your Positions</Text>
          <Link href="/positions/create">
            <Button
              variant="faded"
              color="neutral"
              attributes={{ style: { alignSelf: 'self-start' } }}
              rounded={true}
            >
              <View gap={4} direction="row" align="center" paddingInline={2}>
                <Plus size={16} />
                <Text variant="body-3">New</Text>
              </View>
            </Button>
          </Link>
        </View>

        <PoolContentWithRelay userAddress={userAddress} />
      </View>
    </View>
  )
}
