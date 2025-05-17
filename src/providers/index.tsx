'use client'

import { privyConfig, wagmiConfig } from '@/config'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState, useEffect, useRef } from 'react'
import { WagmiProvider, usePublicClient, useWalletClient, http } from 'wagmi'
import { PonderProvider, PonderSDK } from '@ponderfinance/sdk'
import { createPublicClient, createWalletClient, custom, type PublicClient } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { useAccount } from 'wagmi'
import { Reshaped } from 'reshaped'
import { RelayEnvironmentProvider } from 'react-relay'
import { getClientEnvironment } from '@/src/lib/relay/environment'
import { RedisSubscriberProvider } from './RedisSubscriberProvider'

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

// Improved RelayProvider component with proper initialization and error handling
function RelayProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvironment] = useState<any>(null);
  const initAttemptedRef = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Initialize environment in useEffect to ensure client-side only
  useEffect(() => {
    // Skip on server
    if (typeof window === 'undefined') return;
    
    // Only try to initialize once
    if (initAttemptedRef.current) return;
    
    // Mark that we've attempted initialization
    initAttemptedRef.current = true;
    
    try {
      logWithStyle('🔄 Initializing Relay environment...', 'info');
      const env = getClientEnvironment();
      
      if (env) {
        setEnvironment(env);
        logWithStyle('✅ Relay environment initialized successfully', 'success');
      } else {
        const err = new Error('Failed to create Relay environment');
        setError(err);
        logWithStyle('⚠️ Failed to create Relay environment', 'warning');
      }
    } catch (err) {
      setError(err as Error);
      logWithStyle('❌ Error creating Relay environment:', 'error');
      console.error(err);
    }
  }, []);

  // If there was an error initializing the environment, render an error message
  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-800 rounded">
        <h3 className="font-bold">Error initializing Relay</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  // If environment is not yet available, render a skeleton UI matching header structure
  if (!environment) {
    return (
      <>
        {/* Skeleton header */}
        <header className="w-full flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          {/* Logo placeholder */}
          <div className="flex items-center">
            <div className="w-32 h-8 bg-neutral-800 rounded animate-pulse"></div>
          </div>
          
          {/* Nav placeholder */}
          <div className="flex space-x-8">
            <div className="w-16 h-4 bg-neutral-800 rounded animate-pulse"></div>
            <div className="w-16 h-4 bg-neutral-800 rounded animate-pulse"></div>
            <div className="w-16 h-4 bg-neutral-800 rounded animate-pulse"></div>
          </div>
          
          {/* Wallet button placeholder */}
          <div className="w-32 h-10 bg-neutral-800 rounded-full animate-pulse"></div>
        </header>
        
        {/* Content skeleton */}
        <div className="max-w-[1032px] mx-auto px-4 pt-6">
          {/* Metrics skeleton */}
          <div className="flex justify-between mb-8">
            <div className="w-32 h-16 bg-neutral-800 rounded animate-pulse"></div>
            <div className="w-32 h-16 bg-neutral-800 rounded animate-pulse"></div>
          </div>
        </div>
      </>
    );
  }

  // Once we have the environment, we can render the RelayEnvironmentProvider
  return (
    <RelayEnvironmentProvider environment={environment}>
      {children}
    </RelayEnvironmentProvider>
  );
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
