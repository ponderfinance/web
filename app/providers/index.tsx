'use client'

import { privyConfig, wagmiConfig } from '@/config'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { WagmiProvider, usePublicClient, useWalletClient } from 'wagmi'
import { PonderProvider, PonderSDK } from '@ponderfinance/sdk'
import { createWalletClient, custom, type PublicClient } from 'viem'
import { bitkubTestnetChain } from '@/app/constants/chains'
import { useAccount } from 'wagmi'

function WalletProvider({
  children,
  queryClient,
}: {
  children: React.ReactNode
  queryClient: QueryClient
}) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()

  const sdk = useMemo(() => {
    if (!publicClient || !address || !walletClient) return null

    // Create a custom transport using the window.ethereum provider
    const transport = custom(window.ethereum)

    const viemWalletClient = createWalletClient({
      chain: bitkubTestnetChain,
      transport,
      account: address as `0x${string}`,
    })

    return new PonderSDK({
      chainId: bitkubTestnetChain.id,
      publicClient: publicClient as PublicClient,
      walletClient: viemWalletClient,
    })
  }, [publicClient, address, walletClient])

  if (!sdk) {
    return <div>Loading...</div>
  }

  return (
    <PonderProvider sdk={sdk} queryClient={queryClient}>
      {children}
    </PonderProvider>
  )
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            staleTime: 1000 * 60 * 5, // 5 minutes
            structuralSharing: (oldData, newData) => {
              try {
                return JSON.parse(
                  JSON.stringify(newData, (_, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                  )
                )
              } catch {
                return newData
              }
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
        config={privyConfig}
      >
        <WagmiProvider config={wagmiConfig}>
          <WalletProvider queryClient={queryClient}>{children}</WalletProvider>
        </WagmiProvider>
      </PrivyProvider>
    </QueryClientProvider>
  )
}
