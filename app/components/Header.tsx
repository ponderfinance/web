'use client'

import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'

export const Header = () => {
  const { authenticated, login, logout } = usePrivy()

  return (
    <header className="relative md:top-0 md:left-0 md:right-0 border-gray-200">
      <div className="flex flex-row justify-between items-center py-6 w-full max-w-screen-2xl mx-auto">
        <div className="flex gap-2 flex-row items-center justify-center">
          <div style={{ fontFamily: 'var(--font-silkscreen)' }}>Ponder DEX</div>
        </div>

        <div>

          <button
              className="flex items-center border-2 border-black px-5 py-1 hover:border-gray-400 hover:text-gray-400"
              onClick={!authenticated ? login : logout}
              style={{fontFamily: 'var(--font-silkscreen)'}}
          >
            <div className="text-md">{authenticated ? 'Logout' : 'Login'}</div>
          </button>
        </div>

      </div>
    </header>
  )
}
