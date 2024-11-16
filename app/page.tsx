'use client'

import { CreatePet } from '@/app/components/CreatePet'
import { FeedPet } from '@/app/components/FeedPet'
import { EnableWithdraw } from '@/app/components/EnableWithdrawl'
import { ShowPet } from '@/app/components/ShowPet'
import Image from 'next/image'

export default function Home() {
  return (
    <div className="min-h-screen w-full max-w-screen-2xl mx-auto">
      <div className="px-8 max-w-screen-2xl flex flex-col w-full items-center gap-4">
        <div
          className="text-4xl md:text-6xl text-center"
          style={{ fontFamily: 'var(--font-silkscreen)' }}
        >
          SNACK SNACK
        </div>
        <Image
          src={'/pets/donut.png'}
          alt={'Snack Snack Donut Logo'}
          height={200}
          width={200}
        />
        <div className="text-xl" style={{ fontFamily: 'var(--font-silkscreen)' }}>
          Snack your way to savings
        </div>
        <div className="text-md uppercase text-center max-w-xl">
          Snack Snack is a savings game, where you and your friends care for a digital
          pet and work together to achieve the goal of launching a validator on Ethereum!
        </div>
      </div>

      {/*<CreatePet />*/}
      <ShowPet />
      {/*<FeedPet />*/}
      {/*<EnableWithdraw />*/}
    </div>
  )
}
