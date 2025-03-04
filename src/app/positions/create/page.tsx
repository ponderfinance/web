'use client'
import { View } from 'reshaped'
import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'

export default function Pool() {
  return (
    <AddLiquidityStepper
      defaultTokenA="0xe0432224871917fb5a137f4a153a51ecf9f74f57"
      defaultTokenB="0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5"
    />
  )
}
