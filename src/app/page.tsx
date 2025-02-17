'use client'
import { Text, View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'

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
          defaultTokenIn="0x54e75E45842855Df24d96908a229575cD101b914"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
        <View
          paddingTop={4}
          paddingBottom={4}
          maxWidth={'440px'}
          align="center"
          attributes={{ style: { margin: '0 auto' } }}
        >
          <Text variant="body-1" align="center">
            Bitkub Chain’s AMM governed by xKOI.
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
