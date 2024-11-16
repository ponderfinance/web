'use client'

import { usePrivy } from '@privy-io/react-auth'

export const Header = () => {
  const { authenticated, login, logout } = usePrivy()

  return (
    <header className="relative md:top-0 md:left-0 md:right-0 z-50 bg-white border-gray-200">
      <div className="flex flex-row justify-between items-center px-10 py-6 w-full max-w-screen-2xl mx-auto">
        <button
          className="flex items-center border-2 border-black px-10 py-3 hover:border-gray-400 hover:text-gray-400"
          onClick={!authenticated ? login : logout}
        >
          <div className="text-2xl">{authenticated ? 'Logout' : 'Login'}</div>
        </button>
      </div>
    </header>
  )
}
