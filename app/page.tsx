'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
import PonderPriceChart from '@/app/components/PonderPriceChart'
export default function Home() {
  return (
    <View direction="column">
      <View paddingTop={24}>
        <SwapInterface
          defaultTokenIn="0x394c708B7Bd536C9961EA1748389F5bBDE3b480D"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
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
