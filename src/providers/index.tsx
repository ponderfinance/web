'use client'

import { privyConfig, wagmiConfig } from '@/config'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState, useEffect } from 'react'
import { WagmiProvider, usePublicClient, useWalletClient, http } from 'wagmi'
import { PonderProvider, PonderSDK } from '@ponderfinance/sdk'
import { createPublicClient, createWalletClient, custom, type PublicClient } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { useAccount } from 'wagmi'
import { Reshaped } from 'reshaped'
import { RelayEnvironmentProvider } from 'react-relay'
import { getClientEnvironment } from '@/src/lib/relay/environment'
import { RedisSubscriberProvider } from './RedisSubscriberProvider'
import { TokenDataProvider } from '@/src/contexts/TokenDataContext'
import type { Environment } from 'relay-runtime'

// Helper to create styled console logs
const logWithStyle = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
  if (typeof window === 'undefined') return; // Only log in browser
  
  const styles = {
    success: 'color: #00c853; font-weight: bold; font-size: 14px;',
    info: 'color: #2196f3; font-weight: bold;',
    error: 'color: #f44336; font-weight: bold;',
    warning: 'color: #ff9800; font-weight: bold;'
  };
  
  console.log(`%c${message}`, styles[type]);
};

// Client-side Relay Provider following Next.js best practices
function RelayProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvironment] = useState<Environment | null>(null)
  const [isClient, setIsClient] = useState(false)
  
  // Mark as client-side after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // Create environment only on client-side after hydration
  useEffect(() => {
    if (!isClient) return
    
    try {
      const env = getClientEnvironment()
      setEnvironment(env)
    } catch (error) {
      console.error('Failed to create Relay environment:', error)
      // App continues without Relay - graceful degradation
    }
  }, [isClient])
  
  // Only render RelayEnvironmentProvider when we have a valid environment
  if (isClient && environment) {
    return (
      <RelayEnvironmentProvider environment={environment}>
        <TokenDataProvider>
          {children}
        </TokenDataProvider>
      </RelayEnvironmentProvider>
    )
  }
  
  // Fallback during SSR and before environment is ready
  return (
    <TokenDataProvider>
      {children}
    </TokenDataProvider>
  )
}

// SDK Provider using wallet hook
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
      chain: CURRENT_CHAIN,
      transport: http(CURRENT_CHAIN.rpcUrls.default.http[0]),
    })

    const transport =
      typeof window !== 'undefined' && window.ethereum
        ? custom(window.ethereum)
        : http(CURRENT_CHAIN.rpcUrls.default.http[0])

    const viemWalletClient = createWalletClient({
      chain: CURRENT_CHAIN,
      transport,
      account: (address as `0x${string}`) || undefined,
    })

    return new PonderSDK({
      chainId: CURRENT_CHAIN.id,
      publicClient: (publicClient || fallbackPublicClient) as PublicClient,
      walletClient: viemWalletClient,
    })
  }, [publicClient, address, CURRENT_CHAIN])

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
            <WalletProvider queryClient={queryClient}>
              <RelayProvider>
                <RedisSubscriberProvider>
                  {children}
                </RedisSubscriberProvider>
              </RelayProvider>
            </WalletProvider>
          </WagmiProvider>
        </Reshaped>
      </PrivyProvider>
    </QueryClientProvider>
  )
}
