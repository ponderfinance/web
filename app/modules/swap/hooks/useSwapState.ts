import { useState, useCallback } from 'react'
import { type Address, parseUnits } from 'viem'
import { TokenInfo, SwapState } from '../types/swap'

const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)

export function useSwapState(tokenInInfo?: TokenInfo) {
  const [state, setState] = useState<SwapState>({
    tokenIn: undefined,
    tokenOut: undefined,
    amountIn: '',
    slippage: 0.5, // 0.5% default slippage
    error: null,
    isProcessing: false,
    txHash: undefined,
    approvalsPending: new Set(),
  })

  const setTokenIn = useCallback((token?: Address) => {
    setState((prev) => ({ ...prev, tokenIn: token }))
  }, [])

  const setTokenOut = useCallback((token?: Address) => {
    setState((prev) => ({ ...prev, tokenOut: token }))
  }, [])

  const setAmountIn = useCallback((amount: string) => {
    setState((prev) => ({ ...prev, amountIn: amount }))
  }, [])

  const handleAmountInput = useCallback(
    (value: string) => {
      if (!tokenInInfo) return
      setState((prev) => ({ ...prev, error: null }))

      // Validate numeric input with decimals
      if (!/^\d*\.?\d*$/.test(value)) return

      const parts = value.split('.')
      if (parts[1] && parts[1].length > (tokenInInfo.decimals || 18)) return

      // Validate maximum amount
      try {
        const parsedAmount = parseUnits(value || '0', tokenInInfo.decimals || 18)
        if (parsedAmount > MAX_UINT256) return
      } catch {
        return
      }

      setAmountIn(value)
    },
    [tokenInInfo, setAmountIn]
  )

  const setSlippage = useCallback((value: number) => {
    setState((prev) => ({ ...prev, slippage: value }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  const setIsProcessing = useCallback((isProcessing: boolean) => {
    setState((prev) => ({ ...prev, isProcessing }))
  }, [])

  const setTxHash = useCallback((hash?: string) => {
    setState((prev) => ({ ...prev, txHash: hash }))
  }, [])

  const addApprovalPending = useCallback((token: Address) => {
    setState((prev) => {
      const newApprovals = new Set(prev.approvalsPending)
      newApprovals.add(token)
      return { ...prev, approvalsPending: newApprovals }
    })
  }, [])

  const removeApprovalPending = useCallback((token: Address) => {
    setState((prev) => {
      const newApprovals = new Set(prev.approvalsPending)
      newApprovals.delete(token)
      return { ...prev, approvalsPending: newApprovals }
    })
  }, [])

  const resetState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      amountIn: '',
      error: null,
      isProcessing: false,
      txHash: undefined,
      approvalsPending: new Set(),
    }))
  }, [])

  return {
    ...state,
    setTokenIn,
    setTokenOut,
    setAmountIn,
    handleAmountInput,
    setSlippage,
    setError,
    setIsProcessing,
    setTxHash,
    addApprovalPending,
    removeApprovalPending,
    resetState,
  }
}
