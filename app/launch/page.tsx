'use client'
import { View } from 'reshaped'
import LaunchCreationForm from '@/app/components/launch/LaunchToken'
import LaunchContributionCard from "@/app/components/launch/LaunchContributionCard";
export default function Launch() {
  return (
    <View direction="column">
      <View insetTop={32}>
        <LaunchCreationForm />
        <LaunchContributionCard launchId={BigInt(1)} />
      </View>
    </View>
  )
}
