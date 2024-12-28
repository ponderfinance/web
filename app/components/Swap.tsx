import { useState, useEffect, useMemo, useCallback } from 'react'
import { Text, Button, View, Actionable } from 'reshaped'
import { type Address, formatUnits, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import {
  useGasEstimate,
  useSwap,
  useSwapApproval,
  useSwapCallback,
  useSwapRoute,
  useTokenBalance,
  useTokenInfo,
  useTokenAllowance,
  useTransaction,
  usePonderSDK,
  type SwapResult,
} from '@ponderfinance/sdk'
import { roundDecimal, shortenNumber } from '@/app/utils/numbers'
import { ArrowDown } from '@phosphor-icons/react'

interface SwapInterfaceProps {
  defaultTokenIn?: Address
  defaultTokenOut?: Address
  className?: string
}

// Base swap params shared across all swap types
interface BaseSwapParams {
  path: Address[]
  to: Address
  deadline: bigint
}

interface SwapExactTokensForTokensParams extends BaseSwapParams {
  amountIn: bigint
  amountOutMin: bigint
}

interface SwapTokensForExactTokensParams extends BaseSwapParams {
  amountOut: bigint
  amountInMax: bigint
}

interface SwapExactETHForTokensParams extends BaseSwapParams {
  amountOutMin: bigint
}

interface SwapTokensForExactETHParams extends BaseSwapParams {
  amountOut: bigint
  amountInMax: bigint
}

interface SwapExactTokensForETHParams extends BaseSwapParams {
  amountIn: bigint
  amountOutMin: bigint
}

interface SwapETHForExactTokensParams extends BaseSwapParams {
  amountOut: bigint
  value: bigint
}

type SwapParams =
  | {
      type: 'exactETHForTokens'
      params: SwapExactETHForTokensParams
      value: bigint
    }
  | {
      type: 'tokensForExactETH'
      params: SwapTokensForExactETHParams
    }
  | {
      type: 'exactTokensForETH'
      params: SwapExactTokensForETHParams
    }
  | {
      type: 'ETHForExactTokens'
      params: SwapETHForExactTokensParams
      value: bigint
    }
  | {
      type: 'exactTokensForTokens'
      params: SwapExactTokensForTokensParams
    }

const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)
const DEFAULT_DEADLINE_MINUTES = 20
const DEFAULT_SLIPPAGE = 0.5 // 0.5%
const HIGH_PRICE_IMPACT_THRESHOLD = 2 // 2%
const CRITICAL_PRICE_IMPACT_THRESHOLD = 5 // 5%
const KKUB_ADDRESS = '0xBa71efd94be63bD47B78eF458DE982fE29f552f7'

export function SwapInterface({
  defaultTokenIn,
  defaultTokenOut,
  className,
}: SwapInterfaceProps) {
  const sdk = usePonderSDK()
  const { address: account } = useAccount()

  // Form state
  const [tokenIn, setTokenIn] = useState<Address | undefined>(defaultTokenIn)
  const [tokenOut, setTokenOut] = useState<Address | undefined>(defaultTokenOut)
  const [amountIn, setAmountIn] = useState<string>('')
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [approvalsPending, setApprovalsPending] = useState<Set<Address>>(new Set())

  // Token information
  const { data: tokenInInfo } = useTokenInfo(tokenIn || ('' as Address))
  const { data: tokenOutInfo } = useTokenInfo(tokenOut || ('' as Address))
  const { data: tokenInBalance } = useTokenBalance(tokenIn || ('' as Address), account)
  const { data: tokenOutBalance } = useTokenBalance(tokenOut || ('' as Address), account)
  const { data: tokenInAllowance, refetch: refetchAllowance } = useTokenAllowance(
    tokenIn || ('' as Address),
    sdk?.router.address,
    account,
    !!tokenIn && !!account && !!sdk?.router.address
  )

  const parsedAmountIn = useMemo(() => {
    if (!tokenInInfo || !amountIn) return BigInt(0)
    try {
      return parseUnits(amountIn, tokenInInfo.decimals)
    } catch {
      return BigInt(0)
    }
  }, [amountIn, tokenInInfo])

  const { data: route, isLoading: isRouteLoading } = useSwapRoute(
    {
      tokenIn: tokenIn as Address,
      tokenOut: tokenOut as Address,
      amountIn: parsedAmountIn,
      maxHops: 3,
    },
    Boolean(tokenIn && tokenOut && parsedAmountIn > BigInt(0) && tokenInInfo)
  )

  // Expected output calculations
  const expectedOutput = useMemo(() => {
    if (!route?.amountOut || !tokenOutInfo) return null
    return {
      raw: BigInt(route.amountOut),
      formatted: formatUnits(BigInt(route.amountOut), tokenOutInfo.decimals),
    }
  }, [route?.amountOut, tokenOutInfo])

  const minimumReceived = useMemo(() => {
    if (!expectedOutput?.raw || !tokenOutInfo) return null
    const slippageBps = BigInt(Math.round(slippage * 100))
    const slippageAmount = (expectedOutput.raw * slippageBps) / BigInt(10000)
    const minAmount = expectedOutput.raw - slippageAmount
    return {
      raw: minAmount,
      formatted: formatUnits(minAmount, tokenOutInfo.decimals),
    }
  }, [expectedOutput, slippage, tokenOutInfo])

  // Swap execution setup
  const { calldata: swapCalldata } = useSwapCallback({
    route: route ?? undefined,
    recipient: account,
    slippageBps: Math.round(slippage * 100),
    deadline: BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_MINUTES * 60),
  })

  const { data: gasEstimate } = useGasEstimate(
    swapCalldata ?? undefined,
    Boolean(swapCalldata)
  )

  // Contract interactions
  const { mutateAsync: approve } = useSwapApproval()
  const { mutateAsync: swap, isPending: isSwapping } = useSwap()
  const [txHash, setTxHash] = useState<string>()
  const { data: txStatus } = useTransaction(txHash as `0x${string}`)

  // Validation states
  const isApprovalRequired = useMemo(() => {
    if (!route?.amountIn || !tokenInAllowance?.amount || !tokenIn) return false
    return BigInt(route.amountIn) > BigInt(tokenInAllowance.amount)
  }, [route?.amountIn, tokenInAllowance?.amount, tokenIn])

  const isValidTrade = useMemo(() => {
    if (!route?.amountIn || !tokenInBalance || !account) return false

    const amountInBigInt = BigInt(route.amountIn)
    const balanceBigInt = BigInt(tokenInBalance)

    return (
      amountInBigInt <= balanceBigInt &&
      amountInBigInt > BigInt(0) &&
      BigInt(route.amountOut) > BigInt(0)
    )
  }, [route, tokenInBalance, account])

  const showPriceImpactWarning = (route?.priceImpact || 0) > HIGH_PRICE_IMPACT_THRESHOLD
  const showCriticalPriceImpactWarning =
    (route?.priceImpact || 0) > CRITICAL_PRICE_IMPACT_THRESHOLD

  const handleAmountInput = (value: string) => {
    if (!tokenInInfo) return
    setError(null)

    // Validate numeric input with decimals
    if (!/^\d*\.?\d*$/.test(value)) return

    const parts = value.split('.')
    if (parts[1] && parts[1].length > tokenInInfo.decimals) return

    // Validate maximum amount
    try {
      const parsedAmount = parseUnits(value || '0', tokenInInfo.decimals)
      if (parsedAmount > MAX_UINT256) return
    } catch {
      return
    }

    setAmountIn(value)
  }

  const handleApproval = useCallback(async () => {
    if (!route?.path[0] || !account || !route.amountIn || !tokenIn) return
    setError(null)

    try {
      setApprovalsPending((prev) => new Set(prev).add(tokenIn))
      const result = await approve({
        tokenIn: route.path[0],
        amountIn: BigInt(route.amountIn),
        useUnlimited: true,
      })

      // Wait for approval to be mined
      await sdk.publicClient.waitForTransactionReceipt({
        hash: result.hash,
        confirmations: 1,
      })

      await refetchAllowance?.()
      setApprovalsPending((prev) => {
        const next = new Set(prev)
        next.delete(tokenIn)
        return next
      })

      return result
    } catch (err: any) {
      console.error('Approval failed:', err)
      setError(err.message || 'Failed to approve token')
      setApprovalsPending((prev) => {
        const next = new Set(prev)
        next.delete(tokenIn)
        return next
      })
      throw err
    }
  }, [route])

  const handleSwap = async () => {
    if (!route || !account || !minimumReceived?.raw || !sdk) return
    setError(null)
    setIsProcessing(true)

    try {
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_MINUTES * 60
      )
      const isETHIn = tokenIn?.toLowerCase() === KKUB_ADDRESS?.toLowerCase()
      const isETHOut = tokenOut?.toLowerCase() === KKUB_ADDRESS?.toLowerCase()

      let swapParams: SwapParams

      if (isETHIn && parsedAmountIn) {
        swapParams = {
          type: 'exactETHForTokens',
          params: {
            amountOutMin: minimumReceived.raw,
            path: route.path,
            to: account,
            deadline,
          },
          value: parsedAmountIn,
        }
      } else if (isETHOut && parsedAmountIn) {
        swapParams = {
          type: 'exactTokensForETH',
          params: {
            amountIn: parsedAmountIn,
            amountOutMin: minimumReceived.raw,
            path: route.path,
            to: account,
            deadline,
          },
        }
      } else if (isETHOut && route.amountOut) {
        swapParams = {
          type: 'tokensForExactETH',
          params: {
            amountOut: route.amountOut,
            amountInMax: parsedAmountIn || BigInt(0),
            path: route.path,
            to: account,
            deadline,
          },
        }
      } else if (isETHIn && route.amountOut) {
        swapParams = {
          type: 'ETHForExactTokens',
          params: {
            amountOut: route.amountOut,
            path: route.path,
            to: account,
            deadline,
            value: parsedAmountIn || BigInt(0),
          },
          value: parsedAmountIn || BigInt(0),
        }
      } else {
        swapParams = {
          type: 'exactTokensForTokens',
          params: {
            amountIn: parsedAmountIn || BigInt(0),
            amountOutMin: minimumReceived.raw,
            path: route.path,
            to: account,
            deadline,
          },
        }
      }

      const result = await swap(swapParams)
      setTxHash(result.hash)
      setAmountIn('')

      await sdk.publicClient.waitForTransactionReceipt({
        hash: result.hash,
        confirmations: 1,
      })
    } catch (err: any) {
      console.error('Swap error:', err)
      setError(parseSwapError(err))
    } finally {
      setIsProcessing(false)
    }
  }

  const parseSwapError = (error: any): string => {
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
    if (message.includes('rejected')) {
      return 'Transaction rejected by user'
    }
    if (message.includes('User rejected high impact swap')) {
      return 'Swap cancelled due to high price impact'
    }
    if (message.includes('user rejected transaction')) {
      return 'Transaction cancelled'
    }

    return `Swap failed: ${message}`
  }

  // Reset on successful transaction
  useEffect(() => {
    if (txStatus?.state === 'confirmed') {
      setAmountIn('')
      setTxHash(undefined)
      setError(null)
    }
  }, [txStatus])

  // Validate amounts on route changes
  useEffect(() => {
    if (route && tokenInInfo && amountIn) {
      try {
        const parsedAmount = parseUnits(amountIn, tokenInInfo.decimals)
        if (parsedAmount !== BigInt(route.amountIn)) {
          setAmountIn(formatUnits(BigInt(route.amountIn), tokenInInfo.decimals))
        }
      } catch (err) {
        console.error('Amount validation failed:', err)
      }
    }
  }, [route, tokenInInfo, amountIn])

  if (!sdk || !account) {
    return <Text>Loading...</Text>
  }

  return (
    <View align="center" width="100%" className={className}>
      <View width={{ s: '100%', m: '480px' }}>
        <View padding={2} borderRadius="large">
          <View maxHeight="600px" overflow="auto" gap={1}>
            {/* Input Token Section */}
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              borderColor="neutral-faded"
            >
              <Text color="neutral-faded" variant="body-3">
                Sell
              </Text>
              <View direction="row" gap={8} wrap={false}>
                <View grow={true} align="center">
                  <input
                    value={amountIn}
                    onChange={(e) => handleAmountInput(e.target.value)}
                    placeholder="0"
                    disabled={!tokenIn || !tokenOut}
                    className="flex w-full h-full text-4xl bg-[rgba(0,0,0,0)] focus:outline-0"
                  />
                </View>

                <Button
                  onClick={() => {
                    /* Token selector integration point */
                  }}
                  variant="outline"
                  disabled={isProcessing}
                  rounded={true}
                >
                  {tokenInInfo?.symbol || 'Select Token'}
                </Button>
              </View>
              <View>
                {tokenInBalance && tokenInInfo && (
                  <View direction="row" align="center" justify="end" gap={2}>
                    <Text color="neutral-faded" variant="body-3">
                      {roundDecimal(formatUnits(tokenInBalance, tokenInInfo.decimals), 3)}{' '}
                      {tokenInInfo.symbol}
                    </Text>
                    {tokenInBalance > BigInt(0) && (
                      <Actionable
                        onClick={() => {
                          if (tokenInInfo && tokenInBalance) {
                            setAmountIn(formatUnits(tokenInBalance, tokenInInfo.decimals))
                          }
                        }}
                      >
                        <View
                          backgroundColor="primary-faded"
                          padding={1}
                          borderRadius="circular"
                        >
                          <Text variant="caption-2" color="primary" weight="bold">
                            MAX
                          </Text>
                        </View>
                      </Actionable>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Switch Tokens Button */}

            <View
              position="absolute"
              insetTop={32}
              align="center"
              backgroundColor="elevation-overlay"
              borderColor="neutral-faded"
              borderRadius="large"
              attributes={{ style: { left: '50%', marginLeft: '-20px' } }}
              zIndex={2}
            >
              <Actionable
                onClick={() => {
                  if (!isProcessing) {
                    setTokenIn(tokenOut)
                    setTokenOut(tokenIn)
                    setAmountIn('')
                    setError(null)
                  }
                }}
                disabled={isProcessing}
                fullWidth={true}
              >
                <View padding={2}>
                  <ArrowDown size={24} />
                </View>
              </Actionable>
            </View>

            {/* Output Token Section */}
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              backgroundColor="elevation-base"
            >
              <Text color="neutral-faded" variant="body-3">
                Buy
              </Text>
              <View direction="row" gap={8} wrap={false}>
                <View grow={true} align="center">
                  <input
                    value={expectedOutput?.formatted || ''}
                    readOnly
                    placeholder="0"
                    disabled={!tokenIn || !tokenOut}
                    className="flex w-full h-full text-4xl bg-[rgba(0,0,0,0)] focus:outline-0"
                  />
                </View>

                <Button
                  onClick={() => {
                    /* Token selector integration point */
                  }}
                  variant="outline"
                  disabled={isProcessing}
                  rounded={true}
                >
                  {tokenOutInfo?.symbol || 'Select Token'}
                </Button>
              </View>
              <View>
                {tokenOutBalance && tokenOutInfo && (
                  <View direction="row" align="center" justify="end" gap={2}>
                    <Text color="neutral-faded" variant="body-3">
                      {roundDecimal(
                        formatUnits(tokenOutBalance, tokenOutInfo.decimals),
                        3
                      )}{' '}
                      {tokenOutInfo.symbol}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {/* Trade Details */}
            {route && (
              <View gap={4} className="bg-gray-50 p-4 rounded mt-4">
                <View direction="row" justify="space-between">
                  <Text>Price Impact</Text>
                  <Text
                    color={
                      showCriticalPriceImpactWarning
                        ? 'critical'
                        : showPriceImpactWarning
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {route.priceImpact.toFixed(2)}%
                  </Text>
                </View>

                <View direction="row" justify="space-between">
                  <Text>Minimum Received</Text>
                  <Text>
                    {minimumReceived?.formatted} {tokenOutInfo?.symbol}
                  </Text>
                </View>

                {gasEstimate && (
                  <View direction="row" justify="space-between">
                    <Text>Network Fee</Text>
                    <Text>{gasEstimate.estimateInKUB} KUB</Text>
                  </View>
                )}

                {route.totalFee > BigInt(0) && (
                  <View direction="row" justify="space-between">
                    <Text>Trading Fee</Text>
                    <Text>
                      {formatUnits(route.totalFee, tokenInInfo?.decimals || 18)}{' '}
                      {tokenInInfo?.symbol}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Error Display */}
            {error && (
              <Text color="critical" align="center" className="mt-4">
                {error}
              </Text>
            )}

            {/* Action Buttons */}
            <View gap={4} className="mt-4">
              {!account ? (
                <Button fullWidth size="large" variant="solid" color="primary">
                  Connect Wallet
                </Button>
              ) : !tokenIn || !tokenOut ? (
                <Button fullWidth size="large" disabled>
                  Select Tokens
                </Button>
              ) : !route || !amountIn ? (
                <Button fullWidth size="large" disabled>
                  Enter Amount
                </Button>
              ) : !isValidTrade ? (
                <Button fullWidth size="large" disabled>
                  Insufficient Balance
                </Button>
              ) : isProcessing || (!!txHash && txStatus?.state === 'pending') ? (
                <Button fullWidth size="large" loading disabled>
                  {isSwapping ? 'Swapping...' : 'Processing...'}
                </Button>
              ) : isApprovalRequired ? (
                <Button
                  fullWidth
                  size="large"
                  loading={approvalsPending.has(tokenIn)}
                  disabled={approvalsPending.has(tokenIn) || isProcessing}
                  onClick={handleApproval}
                  variant="solid"
                  color="primary"
                >
                  Approve {tokenInInfo?.symbol}
                </Button>
              ) : (
                <Button
                  fullWidth
                  size="large"
                  disabled={!isValidTrade || !route || isProcessing}
                  onClick={handleSwap}
                  variant="solid"
                  color="primary"
                >
                  Swap
                </Button>
              )}

              {/* Price Impact Warning */}
              {showPriceImpactWarning && (
                <Text
                  color={showCriticalPriceImpactWarning ? 'critical' : 'warning'}
                  align="center"
                >
                  {showCriticalPriceImpactWarning
                    ? `Warning: High price impact (${route?.priceImpact.toFixed(
                        2
                      )}% loss)`
                    : `High price impact (${route?.priceImpact.toFixed(
                        2
                      )}% loss). Consider reducing your trade size.`}
                </Text>
              )}

              {/* Slippage Controls */}
              <View gap={4}>
                <Text align="center" color="neutral">
                  Slippage Tolerance
                </Text>
                <View direction="row" gap={2} justify="center">
                  <Button
                    variant={slippage === 0.1 ? 'outline' : 'ghost'}
                    size="small"
                    onClick={() => setSlippage(0.1)}
                    disabled={isProcessing}
                  >
                    0.1%
                  </Button>
                  <Button
                    variant={slippage === 0.5 ? 'outline' : 'ghost'}
                    size="small"
                    onClick={() => setSlippage(0.5)}
                    disabled={isProcessing}
                  >
                    0.5%
                  </Button>
                  <Button
                    variant={slippage === 1.0 ? 'outline' : 'ghost'}
                    size="small"
                    onClick={() => setSlippage(1.0)}
                    disabled={isProcessing}
                  >
                    1.0%
                  </Button>
                </View>
              </View>

              {/* Route Information */}
              {route && route.hops.length > 0 && (
                <View gap={2} className="mt-2">
                  <Text weight="medium" align="center">
                    Route
                  </Text>
                  {route.hops.map((hop, index) => (
                    <View key={index} direction="row" justify="center" gap={2}>
                      <Text color="neutral">
                        {index === 0 ? tokenInInfo?.symbol : `Token${index}`}
                      </Text>
                      <Text color="neutral">→</Text>
                      <Text color="neutral">
                        {index === route.hops.length - 1
                          ? tokenOutInfo?.symbol
                          : `Token${index + 1}`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

export default SwapInterface
