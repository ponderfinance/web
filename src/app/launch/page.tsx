'use client'
import { View } from 'reshaped'
import LaunchCreationForm from '@/src/components/launch/LaunchToken'
import LaunchContributionCard from "@/src/components/launch/LaunchContributionCard";
export default function Launch() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <LaunchCreationForm />
        <LaunchContributionCard launchId={BigInt(1)} />
      </View>
    </View>
  )
}
