'use client'
import { View } from 'reshaped'
import LaunchCreationForm from '@/src/app/components/launch/LaunchToken'
import LaunchContributionCard from "@/src/app/components/launch/LaunchContributionCard";
export default function Launch() {
  return (
    <View direction="column">
      <View insetTop={36}>
        <LaunchCreationForm />
        <LaunchContributionCard launchId={BigInt(2)} />
      </View>
    </View>
  )
}
