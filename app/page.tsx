'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Home() {
  return (
    <View direction="column">
      <View insetTop={32}>
        <SwapInterface
          defaultTokenIn="0x394c708B7Bd536C9961EA1748389F5bBDE3b480D"
          defaultTokenOut="0xBa71efd94be63bD47B78eF458DE982fE29f552f7"
        />
      </View>

      {/*<PairStatsCard pairAddress={'0xED64948DEE99eC4B38c93177B928B46edD778d1B'} />*/}
      {/*<FarmList />*/}
    </View>
  )
}
