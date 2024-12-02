'use client'
import { Text } from 'reshaped'
import CreatePair from '@/app/components/CreatePair'
import LaunchCreationForm from '@/app/components/launch/LaunchToken'
import LaunchContributionCard from '@/app/components/launch/LaunchContributionCard'
import AddLiquidityForm from '@/app/components/AddLiquidityForm'
import SwapInterface from '@/app/components/Swap'
import RemoveLiquidityForm from '@/app/components/RemoveLiquidityForm'
import PairStatsCard from '@/app/components/PairStatsCard'
import FarmList from "@/app/components/FarmList";
export default function Home() {
  return (
    <div className="min-h-screen w-full max-w-screen-2xl mx-auto pb-20">
      hi
      <CreatePair />
      <LaunchCreationForm />
      <LaunchContributionCard launchId={BigInt(1)} />
      <AddLiquidityForm />
      <RemoveLiquidityForm />
      <SwapInterface />
      {/*<PairStatsCard pairAddress={'0x8178048760CbA8844f269842cB4A6fa4Cc756149'} />*/}
      <FarmList />
    </div>
  )
}
