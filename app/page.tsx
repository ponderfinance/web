'use client'

import PetSelector from '@/app/components/PetSelector'
import { Snacks } from '@/app/components/Snacks'
import { SnackInfo } from '@/app/components/SnackInfo'

export default function Home() {
  return (
    <div className="min-h-screen w-full max-w-screen-2xl mx-auto pb-20">
      <PetSelector />
      <Snacks />
      <SnackInfo />
    </div>
  )
}
