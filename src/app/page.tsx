'use client'
import { Text, View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'
import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <View direction="column">
      <View
        insetTop={32}
        paddingBottom={16}
        textAlign="center"
        align="center"
        grow={true}
      >
        <View paddingBottom={16} maxWidth="620px">
          <Text variant="featured-1" align="center">
            trade, <em> pool, and launch</em>
          </Text>
        </View>

        <SwapInterface
          defaultTokenIn="0xe456B9B279e159842a91375e382804F7980e8Aa7"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
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
            Bitkub Chain’s AMM and fair token launch platform governed by{' '}
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
      {/*  tokenIn="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"*/}
      {/*/>*/}

      {/*<PairStatsCard pairAddress={'0xED64948DEE99eC4B38c93177B928B46edD778d1B'} />*/}
      {/*<FarmList />*/}
    </View>
  )
}
