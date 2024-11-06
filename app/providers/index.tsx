'use client'

import { privyConfig, wagmiConfig } from '@/config'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from 'wagmi'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={privyConfig}
    >
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </PrivyProvider>
  )
}
