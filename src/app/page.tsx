'use client'
import { Text, View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'

export default function Home() {
  return (
    <View direction="column">
      <View insetTop={32} paddingBottom={16}>
        <View paddingBottom={16}>
          <Text variant="title-3" align="center">
            trade, <em> pool, earn and more</em>
          </Text>
        </View>

        <SwapInterface
          defaultTokenIn="0x49d233e6A933944f6c5DD5dd9d770018dAa2B368"
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
