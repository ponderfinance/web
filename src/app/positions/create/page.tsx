'use client'

import AddLiquidityStepper from '@/src/app/modules/pool/components/AddLiquidityStepper'
import { KKUB_ADDRESS, KOI_ADDRESS } from '@/src/app/constants/addresses'
import { CURRENT_CHAIN } from '@/src/app/constants/chains'

export default function Pool() {
  return (
    <AddLiquidityStepper
      defaultTokenA={KOI_ADDRESS[CURRENT_CHAIN.id]}
      defaultTokenB={KKUB_ADDRESS[CURRENT_CHAIN.id]}
    />
  )
}
