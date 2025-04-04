'use client'

import { View } from 'reshaped'
import LaunchDetailView from '@/src/components/launch/LaunchDetailView'

interface Props {
  params: {
    id: string
  }
}

export default function LaunchDetailPage({ params }: Props) {
  return (
    <View padding={4}>
      <LaunchDetailView launchId={parseInt(params.id)} />
    </View>
  )
} 