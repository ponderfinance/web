'use client'

import { privyConfig, wagmiConfig } from '@/config'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { WagmiProvider, usePublicClient, useWalletClient, http } from 'wagmi'
import { PonderProvider, PonderSDK } from '@ponderfinance/sdk'
import { createPublicClient, createWalletClient, custom, type PublicClient } from 'viem'
import { bitkubTestnetChain } from '@/src/app/constants/chains'
import { useAccount } from 'wagmi'
import { Reshaped } from 'reshaped'

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
    if (!publicClient) return undefined

    const fallbackPublicClient = createPublicClient({
      chain: bitkubTestnetChain,
      transport: http(bitkubTestnetChain.rpcUrls.default.http[0]),
    })

    const transport =
      typeof window !== 'undefined' && window.ethereum
        ? custom(window.ethereum)
        : http(bitkubTestnetChain.rpcUrls.default.http[0])

    const viemWalletClient = createWalletClient({
      chain: bitkubTestnetChain,
      transport,
      account: (address as `0x${string}`) || undefined,
    })

    return new PonderSDK({
      chainId: bitkubTestnetChain.id,
      publicClient: (publicClient || fallbackPublicClient) as PublicClient,
      walletClient: viemWalletClient,
    })
  }, [publicClient, address])

  return (
    <PonderProvider sdk={sdk!} queryClient={queryClient}>
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
        <Reshaped theme="ponder">
          <WagmiProvider config={wagmiConfig}>
            <WalletProvider queryClient={queryClient}>{children}</WalletProvider>
          </WagmiProvider>
        </Reshaped>
      </PrivyProvider>
    </QueryClientProvider>
  )
}
