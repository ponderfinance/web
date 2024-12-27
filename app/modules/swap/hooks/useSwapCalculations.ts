import { useMemo } from 'react'
import { formatUnits, parseUnits } from 'viem'
import type { TokenInfo } from '../types/swap'

interface SwapRoute {
  amountOut: string | bigint
  priceImpact: number
  totalFee: bigint
  path: string[]
  hops: Array<{ pair: string }>
}

interface SwapCalculations {
  parsedAmountIn: bigint
  expectedOutput: {
    raw: bigint
    formatted: string
  } | null
  minimumReceived: {
    raw: bigint
    formatted: string
  } | null
  showPriceImpactWarning: boolean
  showCriticalPriceImpactWarning: boolean
}

const HIGH_PRICE_IMPACT_THRESHOLD = 2 // 2%
const CRITICAL_PRICE_IMPACT_THRESHOLD = 5 // 5%

export function useSwapCalculations(
  route: SwapRoute | null | undefined,
  amountIn: string,
  slippage: number,
  tokenInInfo?: TokenInfo,
  tokenOutInfo?: TokenInfo
): SwapCalculations {
  const parsedAmountIn = useMemo(() => {
    if (!tokenInInfo || !amountIn) return BigInt(0)
    try {
      return parseUnits(amountIn, tokenInInfo.decimals || 18)
    } catch {
      return BigInt(0)
    }
  }, [amountIn, tokenInInfo])

  const expectedOutput = useMemo(() => {
    if (!route?.amountOut || !tokenOutInfo) return null
    const rawAmount =
      typeof route.amountOut === 'string' ? BigInt(route.amountOut) : route.amountOut
    return {
      raw: rawAmount,
      formatted: formatUnits(rawAmount, tokenOutInfo.decimals || 18),
    }
  }, [route?.amountOut, tokenOutInfo])

  const minimumReceived = useMemo(() => {
    if (!expectedOutput?.raw || !tokenOutInfo) return null
    const slippageBps = BigInt(Math.round(slippage * 100))
    const slippageAmount = (expectedOutput.raw * slippageBps) / BigInt(10000)
    const minAmount = expectedOutput.raw - slippageAmount
    return {
      raw: minAmount,
      formatted: formatUnits(minAmount, tokenOutInfo.decimals || 18),
    }
  }, [expectedOutput, slippage, tokenOutInfo])

  const showPriceImpactWarning = useMemo(() => {
    return (route?.priceImpact || 0) > HIGH_PRICE_IMPACT_THRESHOLD
  }, [route?.priceImpact])

  const showCriticalPriceImpactWarning = useMemo(() => {
    return (route?.priceImpact || 0) > CRITICAL_PRICE_IMPACT_THRESHOLD
  }, [route?.priceImpact])

  return {
    parsedAmountIn,
    expectedOutput,
    minimumReceived,
    showPriceImpactWarning,
    showCriticalPriceImpactWarning,
  }
}
