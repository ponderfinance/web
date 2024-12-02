'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  type PublicClient,
  type WalletClient,
  type Chain,
  type Client,
  type Transport,
  createPublicClient,
  http,
} from 'viem'
import { PonderSDK } from '@ponderfinance/sdk'
import { SUPPORTED_CHAINS, SupportedChainId } from '@/app/constants/chains'

type PonderContextType = {
  sdk: PonderSDK | null
  isReady: boolean
  error: Error | null
  updateWalletClient: (walletClient: WalletClient | undefined) => void
}

const PonderContext = createContext<PonderContextType>({
  sdk: null,
  isReady: false,
  error: null,
  updateWalletClient: () => {},
})

type PonderProviderProps = {
  children: React.ReactNode
  chainId: SupportedChainId
  publicClient?: PublicClient
  walletClient?: WalletClient
}

export const PonderProvider: React.FC<PonderProviderProps> = ({
  children,
  chainId,
  publicClient: initialPublicClient,
  walletClient: initialWalletClient,
}) => {
  const [sdk, setSDK] = useState<PonderSDK | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    try {
      const chain = SUPPORTED_CHAINS[chainId]
      if (!chain) {
        throw new Error(`Chain ${chainId} not supported`)
      }

      const client =
        initialPublicClient ??
        (createPublicClient({
          chain: chain as Chain,
          transport: http(),
        }) as Client<Transport, Chain>)

      const sdk = new PonderSDK({
        chainId,
        publicClient: client as PublicClient,
        walletClient: initialWalletClient as WalletClient,
      })

      setSDK(sdk)
      setIsReady(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to initialize Ponder SDK'))
      setIsReady(false)
      setSDK(null)
    }
  }, [chainId, initialPublicClient, initialWalletClient])

  const updateWalletClient = (walletClient: WalletClient | undefined) => {
    if (sdk) {
      sdk.updateWalletClient(walletClient as WalletClient)
      const client =
        initialPublicClient ??
        (createPublicClient({
          chain: SUPPORTED_CHAINS[chainId] as Chain,
          transport: http(),
        }) as PublicClient)

      setSDK(
        new PonderSDK({
          chainId,
          publicClient: client,
          walletClient: walletClient as WalletClient,
        })
      )
    }
  }

  return (
    <PonderContext.Provider
      value={{
        sdk,
        isReady,
        error,
        updateWalletClient,
      }}
    >
      {children}
    </PonderContext.Provider>
  )
}

export const usePonderSDK = () => {
  const context = useContext(PonderContext)
  if (!context) {
    throw new Error('usePonderSDK must be used within a PonderProvider')
  }
  return context
}

export type { PonderContextType, PonderProviderProps }
