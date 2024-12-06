'use client'
import { Text, View } from 'reshaped'
import CreatePair from '@/app/components/CreatePair'
import LaunchCreationForm from '@/app/components/launch/LaunchToken'
import LaunchContributionCard from '@/app/components/launch/LaunchContributionCard'
import AddLiquidityForm from '@/app/components/AddLiquidityForm'
import SwapInterface from '@/app/components/Swap'
import RemoveLiquidityForm from '@/app/components/RemoveLiquidityForm'
import PairStatsCard from '@/app/components/PairStatsCard'
import FarmList from '@/app/components/FarmList'
import LiquidityPositionsList from '@/app/components/LiqudityPositionsList'
export default function Home() {
  return (
    <View direction="column">
      {/**/}
      {/*<CreatePair />*/}
      {/*<LaunchCreationForm />*/}
      {/*<LaunchContributionCard launchId={BigInt(0)} />*/}
      {/*<AddLiquidityForm />*/}
      {/*<RemoveLiquidityForm />*/}
      <View insetTop={32}>
        <SwapInterface
          defaultTokenIn="0x83140338c917690Ad94Da099aC4BFCf2Cf9c5291"
          defaultTokenOut="0x3b9656251F82a40118E08210823Fff1A97F60C2D"
        />
      </View>

      {/*<PairStatsCard pairAddress={'0xED64948DEE99eC4B38c93177B928B46edD778d1B'} />*/}
      {/*<FarmList />*/}
      {/*<LiquidityPositionsList />*/}
    </View>
  )
}
