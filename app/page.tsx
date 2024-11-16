'use client'

import { CreatePet } from '@/app/components/CreatePet'

export default function Home() {
  return (
    <div className="min-h-screen w-full max-w-screen-2xl mx-auto">
      <div className="text-4xl">SNACK SNACK!</div>
      <CreatePet />
    </div>
  )
}
