'use client'
import { Text, View } from 'reshaped'
import SwapInterface from '@/src/app/components/Swap'

export default function Home() {
  return (
    <View direction="column">
      <View paddingTop={16} paddingBottom={16}>
        <View paddingBottom={16}>
          <Text variant="title-3" align="center">
            trade,{' '}<em> pool, earn and more</em>
          </Text>
        </View>

        <SwapInterface
          defaultTokenIn="0x0852465CE1aeD3644bdc629c6acb0BB9F6FB8e46"
          defaultTokenOut="0x074282BB91529743C66D5AF429dF1ea1BB0519a0"
        />
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
