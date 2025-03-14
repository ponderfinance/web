'use client'

import AddLiquidityStepper from '@/src/modules/pool/components/AddLiquidityStepper'
import { KKUB_ADDRESS, KOI_ADDRESS } from '@/src/constants/addresses'
import { CURRENT_CHAIN } from '@/src/constants/chains'

export default function Pool() {
  return (
    <AddLiquidityStepper
      defaultTokenA={KOI_ADDRESS[CURRENT_CHAIN.id]}
      defaultTokenB={KKUB_ADDRESS[CURRENT_CHAIN.id]}
    />
  )
}
