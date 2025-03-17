'use client'

import { Text, View } from 'reshaped'
import SwapInterface from '@/src/components/Swap'
import Image from 'next/image'
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
          defaultTokenIn={KOI_ADDRESS[CURRENT_CHAIN.id]}
          defaultTokenOut={KKUB_ADDRESS[CURRENT_CHAIN.id]}
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
      {/*<PonderPriceChart*/}
      {/*  pairAddress={'0x8999DB2fD18Bd364D98f15bbA5014f792b243BCE'}*/}
      {/*  tokenIn="0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5"*/}
      {/*/>*/}

      {/*<PairStatsCard pairAddress={'0xED64948DEE99eC4B38c93177B928B46edD778d1B'} />*/}
      {/*<FarmList />*/}
    </View>
  )
}
