'use client'
import { View } from 'reshaped'
import LiquidityPositionsList from '@/src/app/components/LiqudityPositionsList'

export default function Pool() {
  return (
    <View direction="column">
      <View paddingTop={16}>
        <LiquidityPositionsList />
      </View>
    </View>
  )
}
