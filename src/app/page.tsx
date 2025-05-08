'use client'

import { Text, View } from 'reshaped'
import SwapInterface from '@/src/components/Swap'
import Link from 'next/link'
import { KKUB_ADDRESS, KOI_ADDRESS } from '@/src/constants/addresses'
import { CURRENT_CHAIN } from '@/src/constants/chains'

export default function Home() {
  return (
    <View direction="column">
      <View paddingBottom={16} textAlign="center" align="center" grow={true}>
        <View paddingBottom={{ s: 2, m: 8 }} maxWidth={{ s: '240px', m: '380px' }}>
          <Text variant={{ s: 'title-6', m: 'title-3' }} align="center" weight="regular">
            trade, pool, <em>and launch.</em>
          </Text>
        </View>

        <SwapInterface
          defaultTokenIn={KKUB_ADDRESS[CURRENT_CHAIN.id]}
          defaultTokenOut={KOI_ADDRESS[CURRENT_CHAIN.id]}
        />
        <View
          direction="row"
          gap={2}
          paddingTop={4}
          paddingBottom={4}
          maxWidth={'440px'}
          align="center"
          attributes={{ style: { margin: '0 auto' } }}
        >
          <Text variant="body-1" align="center">
            Automated Market Maker and fair token launch platform on KUB, governed by{' '}
            <Link
              href={'/xkoi'}
              style={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              xKOI
            </Link>
            .
          </Text>
        </View>
      </View>
    </View>
  )
}
