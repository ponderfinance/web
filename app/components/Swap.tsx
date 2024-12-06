import { useState, useEffect, useMemo } from 'react'
import { Text, Card, Button, View } from 'reshaped'
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
} from '@ponderfinance/sdk'

interface SwapInterfaceProps {
  defaultTokenIn?: Address
  defaultTokenOut?: Address
}

const verifyPoolLiquidity = async (
  route: any,
  sdk: any
): Promise<{ isValid: boolean; reason?: string }> => {
  try {
    if (!route.hops?.[0]?.pair) {
      return { isValid: false, reason: 'Invalid route' }
    }

    const pair = sdk.getPair(route.hops[0].pair)
    const [token0, reserves] = await Promise.all([pair.token0(), pair.getReserves()])

    const isToken0In = route.path[0].toLowerCase() === token0.toLowerCase()
    const reserveIn = isToken0In ? reserves.reserve0 : reserves.reserve1
    const reserveOut = isToken0In ? reserves.reserve1 : reserves.reserve0

    console.log('Pool state:', {
      reserveIn: reserveIn.toString(),
      reserveOut: reserveOut.toString(),
      amountIn: route.amountIn.toString(),
      pair: route.hops[0].pair,
    })

    // Check if input amount is too large compared to pool reserves
    if (BigInt(route.amountIn) > BigInt(reserveIn) / BigInt(2)) {
      return {
        isValid: false,
        reason: 'Amount too large for pool liquidity',
      }
    }

    // Verify minimum reserves
    if (BigInt(reserveIn) === BigInt(0) || BigInt(reserveOut) === BigInt(0)) {
      return {
        isValid: false,
        reason: 'Pool has insufficient liquidity',
      }
    }

    return { isValid: true }
  } catch (err) {
    console.error('Pool verification failed:', err)
    return { isValid: false, reason: 'Failed to verify pool state' }
  }
}

export default function SwapInterface({
  defaultTokenIn,
  defaultTokenOut,
}: SwapInterfaceProps) {
  const sdk = usePonderSDK()
  const { address: account } = useAccount()

  // Form state
  const [tokenIn, setTokenIn] = useState<Address | undefined>(defaultTokenIn)
  const [tokenOut, setTokenOut] = useState<Address | undefined>(defaultTokenOut)
  const [amountIn, setAmountIn] = useState<string>('')
  const [slippage, setSlippage] = useState(0.5) // 0.5% default

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

  // Get optimal route and amounts
  const { data: route, isLoading: isRouteLoading } = useSwapRoute(
    {
      tokenIn: tokenIn as Address,
      tokenOut: tokenOut as Address,
      amountIn: tokenInInfo
        ? parseUnits(amountIn || '0', tokenInInfo.decimals)
        : BigInt(0),
      maxHops: 3,
    },
    Boolean(tokenIn && tokenOut && amountIn && tokenInInfo)
  )

  // Handle amount input with proper decimal validation
  const handleAmountInput = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return

    const parts = value.split('.')
    if (parts[1] && parts[1].length > (tokenInInfo?.decimals || 18)) return

    setAmountIn(value)
  }

  // Calculate expected output amount based on route
  const expectedOutputAmount = useMemo(() => {
    if (!route || !tokenOutInfo) return ''
    try {
      const amountOutBigInt = BigInt(route.amountOut)
      return formatUnits(amountOutBigInt, tokenOutInfo.decimals)
    } catch (err) {
      console.error('Error calculating expected output:', err)
      return ''
    }
  }, [route, tokenOutInfo])

  // Price impact warning
  const showPriceImpactWarning = useMemo(() => {
    if (!route) return false
    return route.priceImpact > 2
  }, [route])

  // Display route information
  const routeDisplay = useMemo(() => {
    if (!route || !route.hops.length) return null

    return route.hops.map((hop, index) => ({
      from: {
        address: hop.tokenIn,
        symbol: index === 0 ? tokenInInfo?.symbol : `Token${index}`,
      },
      to: {
        address: hop.tokenOut,
        symbol:
          index === route.hops.length - 1 ? tokenOutInfo?.symbol : `Token${index + 1}`,
      },
      pair: hop.pair,
      amountIn: formatUnits(BigInt(hop.amountIn), tokenInInfo?.decimals || 18),
      amountOut: formatUnits(BigInt(hop.amountOut), tokenOutInfo?.decimals || 18),
      fee: formatUnits(BigInt(hop.fee), tokenInInfo?.decimals || 18),
    }))
  }, [route, tokenInInfo, tokenOutInfo])

  // Gas estimation
  const { calldata: swapCalldata } = useSwapCallback({
    route,
    recipient: account,
    slippageBps: Math.round(slippage * 100),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
  }) || { calldata: null }

  const { data: gasEstimate } = useGasEstimate(
    swapCalldata ?? undefined,
    Boolean(swapCalldata)
  )

  // Token approval
  const { mutateAsync: approve, isPending: isApproving } = useSwapApproval()

  // Swap execution
  const { mutateAsync: swap, isPending: isSwapping } = useSwap()
  const [txHash, setTxHash] = useState<string>()
  const { data: txStatus } = useTransaction(txHash as `0x${string}`)

  const handleApproval = async () => {
    if (!route || !account || !sdk?.router.address) return

    try {
      const amountInBigInt = BigInt(route.amountIn)
      console.log('Starting approval process...', {
        tokenIn: route.path[0],
        amountInBigInt: amountInBigInt.toString(),
        currentAllowance: tokenInAllowance?.amount?.toString(),
      })

      const MAX_UINT256 = BigInt(
        '115792089237316195423570985008687907853269984665640564039457584007913129639935'
      )
      await approve({
        tokenIn: route.path[0],
        amountIn: MAX_UINT256,
      })

      await new Promise((resolve) => setTimeout(resolve, 2000))
      await refetchAllowance?.()

      const newAllowance = tokenInAllowance?.amount
      console.log('Approval complete:', {
        newAllowance: newAllowance?.toString(),
        requiredAmount: amountInBigInt.toString(),
      })

      if (!newAllowance || newAllowance < amountInBigInt) {
        throw new Error('Approval failed - allowance not set correctly')
      }
    } catch (err) {
      console.error('Approval failed:', err)
      throw err
    }
  }

  const handleSwap = async () => {
    if (!route || !account) return

    // Verify pool state first
    const poolCheck = await verifyPoolLiquidity(route, sdk)
    if (!poolCheck.isValid) {
      throw new Error(`Swap validation failed: ${poolCheck.reason}`)
    }

    try {
      if (isApprovalRequired) {
        await handleApproval()
      }

      const amountInBigInt = BigInt(route.amountIn)
      const currentAllowance = BigInt(tokenInAllowance?.amount || 0)

      if (currentAllowance < amountInBigInt) {
        throw new Error('Insufficient allowance for swap')
      }

      const amountOutBigInt = BigInt(route.amountOut)
      const slippageBps = BigInt(Math.round(slippage * 100))
      const minAmountOut =
        minimumReceived?.amount ||
        amountOutBigInt - (amountOutBigInt * slippageBps) / BigInt(10000)

      console.log('Executing swap with params:', {
        amountIn: amountInBigInt.toString(),
        amountOutMin: minAmountOut.toString(),
        path: route.path,
        to: account,
        deadline: (Math.floor(Date.now() / 1000) + 1200).toString(),
        allowance: currentAllowance.toString(),
      })

      const swapResult = await swap({
        amountIn: amountInBigInt,
        amountOutMin: minAmountOut,
        path: route.path,
        to: account,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
      })

      setTxHash(swapResult.hash)
    } catch (err: any) {
      console.error('Swap failed:', {
        error: err,
        message: err.message,
        details: err.details,
        code: err.code,
      })
      throw err
    }
  }

  const handleSwitchTokens = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn('')
  }

  // Reset on successful transaction
  useEffect(() => {
    if (txStatus?.state === 'confirmed') {
      setAmountIn('')
      setTxHash(undefined)
    }
  }, [txStatus])

  // Validation
  const isApprovalRequired = useMemo(() => {
    if (!route || !tokenInAllowance?.amount) return true

    const amountInBigInt = BigInt(route.amountIn)
    const allowanceBigInt = BigInt(tokenInAllowance.amount)

    console.log('Approval check:', {
      allowance: allowanceBigInt.toString(),
      required: amountInBigInt.toString(),
      isRequired: amountInBigInt > allowanceBigInt,
    })

    return amountInBigInt > allowanceBigInt
  }, [route, tokenInAllowance])

  const isValidTrade = useMemo(() => {
    if (!route || !tokenInBalance || !account || !tokenInInfo) return false

    const amountInBigInt = BigInt(route.amountIn)
    const balanceBigInt = BigInt(tokenInBalance)

    console.log('Trade validation:', {
      amountIn: formatUnits(amountInBigInt, tokenInInfo.decimals),
      balance: formatUnits(balanceBigInt, tokenInInfo.decimals),
      priceImpact: route.priceImpact,
      rawAmountIn: amountInBigInt.toString(),
      rawBalance: balanceBigInt.toString(),
    })

    console.log(
      'IS VALID',
      amountInBigInt <= balanceBigInt,
      route.priceImpact <= 15,
      BigInt(route.amountOut) > BigInt(0),
      amountInBigInt > BigInt(0)
    )

    return (
      amountInBigInt <= balanceBigInt &&
      // route.priceImpact <= 15 &&
      BigInt(route.amountOut) > BigInt(0) &&
      amountInBigInt > BigInt(0)
    )
  }, [route, tokenInBalance, account, tokenInInfo])

  // Calculate minimum received amount accounting for slippage
  const minimumReceived = useMemo(() => {
    if (!route || !tokenOutInfo) return null

    try {
      const slippageBps = BigInt(Math.round(slippage * 100))
      const amountOutBigInt = BigInt(route.amountOut)
      const bpsBasedSlippage = (amountOutBigInt * slippageBps) / BigInt(10000)
      const minAmount = amountOutBigInt - bpsBasedSlippage

      return {
        amount: minAmount,
        formatted: formatUnits(minAmount, tokenOutInfo.decimals),
      }
    } catch (err) {
      console.error('Error calculating minimum received:', err)
      return null
    }
  }, [route, tokenOutInfo, slippage])

  return (
    <View align="center" width="100%">
      <View width={{ s: '100%', m: 120 }}>
        <View backgroundColor="elevation-base" borderRadius="large">
          <View padding={8} maxHeight={'400px'} overflow={'auto'}>
            {/* Token Input */}
            <View gap={8}>
              <View direction="row" justify="space-between">
                <Text>Sell</Text>
                {tokenInBalance && tokenInInfo && (
                  <Text>
                    Balance: {formatUnits(BigInt(tokenInBalance), tokenInInfo.decimals)}{' '}
                    {tokenInInfo.symbol}
                  </Text>
                )}
              </View>

              <View direction="row" gap={8}>
                <input
                  value={amountIn}
                  onChange={(e) => handleAmountInput(e.target.value)}
                  placeholder="0.0"
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    /* Open token selector */
                  }}
                  variant="outline"
                >
                  {tokenInInfo?.symbol || 'Select Token'}
                </Button>
              </View>
            </View>

            <View align="center">
              <Button variant="ghost" onClick={handleSwitchTokens}>
                ↓
              </Button>
            </View>

            {/* Token Output */}
            <View gap={8}>
              <View direction="row" justify="space-between">
                <Text>Buy</Text>
                {tokenOutBalance && tokenOutInfo && (
                  <Text>
                    Balance: {formatUnits(BigInt(tokenOutBalance), tokenOutInfo.decimals)}{' '}
                    {tokenOutInfo.symbol}
                  </Text>
                )}
              </View>

              <View direction="row" gap={8}>
                <input
                  value={expectedOutputAmount}
                  readOnly
                  placeholder="0.0"
                  className="flex-1 bg-gray-50"
                />
                <Button
                  onClick={() => {
                    /* Open token selector */
                  }}
                  variant="outline"
                >
                  {tokenOutInfo?.symbol || 'Select Token'}
                </Button>
              </View>
            </View>

            {/* Route Information */}
            {routeDisplay && routeDisplay.length > 0 && (
              <View gap={4} className="bg-gray-50 p-4 rounded">
                <Text weight="medium">Route</Text>
                {routeDisplay.map((hop, index) => (
                  <View key={index} gap={2}>
                    <Text>
                      {hop.from.symbol} → {hop.to.symbol}
                    </Text>
                    <Text color="neutral">
                      {hop.amountIn} → {hop.amountOut} (Fee: {hop.fee})
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Trade Details */}
            {route && (
              <View gap={4} className="bg-gray-50 p-4 rounded">
                <View direction="row" justify="space-between">
                  <Text>Price Impact</Text>
                  <Text color={route.priceImpact > 2 ? 'critical' : 'warning'}>
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
              </View>
            )}

            {/* Action Button */}
            {!account ? (
              <Button fullWidth size="large">
                Connect Wallet
              </Button>
            ) : !route ? (
              <Button fullWidth size="large" disabled>
                Enter an amount
              </Button>
            ) : !isValidTrade ? (
              <Button fullWidth size="large" disabled>
                Insufficient Balance
              </Button>
            ) : isSwapping || (!!txHash && txStatus?.state === 'pending') ? (
              <Button fullWidth size="large" loading disabled>
                {isSwapping ? 'Swapping...' : 'Processing...'}
              </Button>
            ) : isApprovalRequired ? (
              <Button
                fullWidth
                size="large"
                loading={isApproving}
                disabled={isApproving}
                onClick={handleApproval}
              >
                Approve {tokenInInfo?.symbol}
              </Button>
            ) : (
              <Button
                fullWidth
                disabled={!isValidTrade || !route}
                size="large"
                onClick={handleSwap}
              >
                Swap
              </Button>
            )}


            {/* Price Impact Warning */}
            {showPriceImpactWarning && (
              <Text color="warning" align="center">
                Warning: High price impact. You will lose {route?.priceImpact.toFixed(2)}%
                of your trade value.
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}
