import { useCallback } from 'react'
import { type Address } from 'viem'
import {
    useSwapApproval,
    useSwap,
    usePonderSDK
} from '@ponderfinance/sdk'
import type { SwapParams } from '../types/swap'

const DEFAULT_DEADLINE_MINUTES = 20

interface UseSwapActionsProps {
    addApprovalPending: (token: Address) => void
    removeApprovalPending: (token: Address) => void
    setError: (error: string | null) => void
    setIsProcessing: (isProcessing: boolean) => void
    setTxHash: (hash?: string) => void
    refetchAllowance?: () => Promise<any>
}

export function useSwapActions({
                                   addApprovalPending,
                                   removeApprovalPending,
                                   setError,
                                   setIsProcessing,
                                   setTxHash,
                                   refetchAllowance
                               }: UseSwapActionsProps) {
    const sdk = usePonderSDK()
    const { mutateAsync: approve } = useSwapApproval()
    const { mutateAsync: swap } = useSwap()

    const handleApproval = useCallback(async (
        tokenIn: Address,
        amountIn: bigint
    ) => {
        if (!tokenIn || !amountIn) return
        setError(null)

        try {
            addApprovalPending(tokenIn)
            const result = await approve({
                tokenIn,
                amountIn,
                useUnlimited: true
            })

            // Wait for approval to be mined
            await sdk?.publicClient.waitForTransactionReceipt({
                hash: result.hash,
                confirmations: 1
            })

            await refetchAllowance?.()
            removeApprovalPending(tokenIn)

            return result
        } catch (err: any) {
            console.error('Approval failed:', err)
            setError(err.message || 'Failed to approve token')
            removeApprovalPending(tokenIn)
            throw err
        }
    }, [sdk, approve, addApprovalPending, removeApprovalPending, setError, refetchAllowance])

    const handleSwap = useCallback(async (
        swapParams: SwapParams,
        tokenIn?: Address
    ) => {
        if (!sdk) return
        setError(null)
        setIsProcessing(true)

        try {
            const result = await swap(swapParams)
            setTxHash(result.hash)

            await sdk.publicClient.waitForTransactionReceipt({
                hash: result.hash,
                confirmations: 1
            })

            return result
        } catch (err: any) {
            console.error('Swap error:', err)
            setError(parseSwapError(err))
            throw err
        } finally {
            setIsProcessing(false)
        }
    }, [sdk, swap, setError, setIsProcessing, setTxHash])

    const prepareSwapParams = useCallback((
        route: any,
        account: Address,
        minimumReceived: bigint,
        parsedAmountIn: bigint,
        kkubAddress: string
    ): SwapParams => {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_MINUTES * 60)

        const tokenIn = route.path[0]
        const tokenOut = route.path[route.path.length - 1]
        const isETHIn = tokenIn?.toLowerCase() === kkubAddress?.toLowerCase()
        const isETHOut = tokenOut?.toLowerCase() === kkubAddress?.toLowerCase()

        if (isETHIn) {
            return {
                type: 'exactETHForTokens',
                params: {
                    amountOutMin: minimumReceived,
                    path: route.path,
                    to: account,
                    deadline
                },
                value: parsedAmountIn
            }
        }

        if (isETHOut) {
            return {
                type: 'exactTokensForETH',
                params: {
                    amountIn: parsedAmountIn,
                    amountOutMin: minimumReceived,
                    path: route.path,
                    to: account,
                    deadline
                }
            }
        }

        return {
            type: 'exactTokensForTokens',
            params: {
                amountIn: parsedAmountIn,
                amountOutMin: minimumReceived,
                path: route.path,
                to: account,
                deadline
            }
        }
    }, [])

    return {
        handleApproval,
        handleSwap,
        prepareSwapParams
    }
}

function parseSwapError(error: any): string {
  const message = error.message || error.toString()

  if (message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
    return 'Insufficient output amount - try increasing slippage tolerance'
  }
  if (message.includes('EXCESSIVE_INPUT_AMOUNT')) {
    return 'Input amount too large for pool liquidity'
  }
  if (message.includes('EXPIRED')) {
    return 'Transaction deadline expired - please try again'
  }
  if (message.includes('INSUFFICIENT_LIQUIDITY')) {
    return 'Insufficient liquidity in pool'
  }
  if (message.includes('INVALID_PATH')) {
    return 'Invalid swap path - please try again'
  }
  if (message.includes('TRANSFER_FAILED')) {
    return 'Token transfer failed - please check your balance and allowance'
  }
  if (message.includes('rejected') || message.includes('user rejected transaction')) {
    return 'Transaction cancelled'
  }
  if (message.includes('User rejected high impact swap')) {
    return 'Swap cancelled due to high price impact'
  }

  return `Swap failed: ${message}`
}
