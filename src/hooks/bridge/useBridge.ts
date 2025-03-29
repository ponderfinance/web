'use client'

import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { usePonderSDK } from '@ponderfinance/sdk'
import { type BridgeParams } from '@/src/types'
import { type Address } from 'viem'
import { Bridge } from '@ponderfinance/sdk'
import { type SupportedChainId } from '@ponderfinance/sdk'

const BRIDGE_ADDRESSES: Record<SupportedChainId, { bridge: `0x${string}` }> = {
  1: {
    bridge: "0x89943b2499d678fb2d382c66b7baed00b732e753" as `0x${string}`,
  },
  96: {
    bridge: "0x89943b2499d678fb2d382C66b7BaeD00b732e753" as `0x${string}`,
  },
  25925: {
    bridge: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  },
}

export function useBridge(): {
  bridgeTokens: (params: BridgeParams, sourceChainId: number) => Promise<string>
  computeFee: (token: Address, destChainId: bigint, amount: bigint) => Promise<bigint>
} {
  const sdk = usePonderSDK()

  const bridgeTokens = async (params: BridgeParams, sourceChainId: number): Promise<string> => {
    if (!sdk) {
      throw new Error('SDK not available')
    }

    if (!sdk.walletClient?.account) {
      throw new Error('Wallet not connected')
    }

    // Get the bridge address for the source chain
    const bridgeAddress = BRIDGE_ADDRESSES[sourceChainId as SupportedChainId]?.bridge
    if (!bridgeAddress) {
      throw new Error(`No bridge address found for chain ${sourceChainId}`)
    }

    // Create a new bridge instance for the source chain
    const sourceBridge = new Bridge(
      sourceChainId as SupportedChainId,
      bridgeAddress,
      sdk.publicClient,
      sdk.walletClient
    )

    // Get bridge info before executing
    const info = await sourceBridge.getBridgeInfo(
      params.token,
      params.destChainID
    )

    if (!info.enabled) {
      throw new Error('Bridge not enabled')
    }

    const hash = await sourceBridge.bridgeTokens(params)
    return hash
  }

  const computeFee = async (
    token: Address,
    destChainId: bigint,
    amount: bigint
  ): Promise<bigint> => {
    if (!sdk) {
      throw new Error('SDK not available')
    }

    if (!sdk.publicClient) {
      throw new Error('Public client not available')
    }

    return sdk.bridge.computeFee(token, destChainId, amount)
  }

  return {
    bridgeTokens,
    computeFee,
  }
} 