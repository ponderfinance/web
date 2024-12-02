'use client'

import { privyConfig, wagmiConfig } from '@/config'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { WagmiProvider, usePublicClient, useWalletClient } from 'wagmi'
import { PonderProvider } from '@/app/providers/ponder'

function PonderProviderWrapper({ children }: { children: React.ReactNode }) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  return (
    <PonderProvider
      chainId={25925}
      publicClient={publicClient}
      walletClient={walletClient}
    >
      {children}
    </PonderProvider>
  )
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={privyConfig}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <PonderProviderWrapper>{children}</PonderProviderWrapper>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  )
}
