'use client'
import { View } from 'reshaped'
import SwapInterface from '@/app/components/Swap'
export default function Home() {
  return (
    <View direction="column">
      <View insetTop={32}>
        <SwapInterface
          defaultTokenIn="0x394c708B7Bd536C9961EA1748389F5bBDE3b480D"
          defaultTokenOut="0x96C5A82c5DE603AeB973F0fef40e8C46A86cb01f"
        />
      </View>

      {/*<PairStatsCard pairAddress={'0xED64948DEE99eC4B38c93177B928B46edD778d1B'} />*/}
      {/*<FarmList />*/}
    </View>
  )
}
