'use client'

import { Button, Text, View } from 'reshaped'
import LiquidityPositionsList from '@/src/components/LiquidityPositionsList'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import PoolsList from '@/src/components/PoolsList'
import ErrorBoundary from "@/src/components/ErrorBoundary";

export default function Pool() {
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

        <ErrorBoundary>
          <PoolsList />
        </ErrorBoundary>
        {/*<LiquidityPositionsList />*/}
      </View>
    </View>
  )
}
