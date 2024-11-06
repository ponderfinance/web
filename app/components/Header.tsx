'use client'

import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'

export const Header = () => {
  const { ready, authenticated, login, logout } = usePrivy()

  return (
    <div className="flex flex-row justify-between items-center px-10 py-6 w-full">
      <Image src={'/zorb.svg'} alt={'Zora Zorb Logo'} height={80} width={80} />
      <button
        className="flex items-center border-2 border-black px-10 py-3"
        onClick={!authenticated ? login : logout}
      >
        {authenticated ? (
          <div className="text-2xl">Logout</div>
        ) : (
          <div className="text-2xl">Login</div>
        )}
      </button>
    </div>
  )
}
