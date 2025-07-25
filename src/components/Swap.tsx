import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { Text, Button, View, Actionable, Icon, useToast, Image } from 'reshaped'
import { type Address, formatUnits, parseUnits } from 'viem'
import { useAccount, useBalance } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { useLazyLoadQuery, graphql, useRelayEnvironment } from 'react-relay'
import {
  useGasEstimate,
  useSwap,
  useSwapApproval,
  useSwapCallback,
  useSwapRoute,
  useTokenBalance,
  useTokenAllowance,
  useTransaction,
  usePonderSDK,
} from '@ponderfinance/sdk'
import { ArrowDown, GasPump, X, NotePencil } from '@phosphor-icons/react'
import { usePrivy } from '@privy-io/react-auth'
import { InterfaceTabs } from '@/src/modules/swap/components/InterfaceTabs'
import { TokenBalanceDisplay } from '@/src/modules/swap/components/TokenBalanceDisplay'
import TokenSelector from '@/src/components/TokenSelector'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { formatNumber, roundDecimal } from '@/src/utils/numbers'
import { TokenPair, tokenFragment } from '@/src/components/TokenPair'
import { SwapTokenDataQuery } from '@/src/__generated__/SwapTokenDataQuery.graphql'
import { useTokenData } from '@/src/contexts/TokenDataContext'
import { getIpfsGateway } from '@/src/utils/ipfs'

// GraphQL query for token data
const swapTokenDataQuery = graphql`
  query SwapTokenDataQuery($tokenInAddress: String!, $tokenOutAddress: String!, $skipTokenIn: Boolean!, $skipTokenOut: Boolean!) {
    tokenIn: tokenByAddress(address: $tokenInAddress) @skip(if: $skipTokenIn) {
      ...TokenPairFragment
      decimals
      symbol
      name
    }
    tokenOut: tokenByAddress(address: $tokenOutAddress) @skip(if: $skipTokenOut) {
      ...TokenPairFragment  
      decimals
      symbol
      name
    }
  }
`

const kubTokenAbi = [
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

interface SwapInterfaceProps {
  defaultTokenIn?: Address
  defaultTokenOut?: Address
  defaultWidth?: string
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
const DEFAULT_SLIPPAGE = 2.0 // 2.0%
const HIGH_PRICE_IMPACT_THRESHOLD = 2 // 2%
const CRITICAL_PRICE_IMPACT_THRESHOLD = 5 // 5%
const KUB_ADDRESS = '0x0000000000000000000000000000000000000000'

export function SwapInterface({
  defaultTokenIn,
  defaultTokenOut,
  defaultWidth = '480px',
  className,
}: SwapInterfaceProps) {
  const sdk = usePonderSDK()
  const { address: account } = useAccount()
  const toast = useToast()
  const tokenDataContext = useTokenData()

  // Form state
  const [tokenIn, setTokenIn] = useState<Address | undefined>(defaultTokenIn)
  const [tokenOut, setTokenOut] = useState<Address | undefined>(defaultTokenOut)
  const [amountIn, setAmountIn] = useState<string>('')
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [approvalsPending, setApprovalsPending] = useState<Set<Address>>(new Set())
  const { login } = usePrivy()

  // Prefetch token data when tokens change
  useEffect(() => {
    const addressesToPrefetch = [tokenIn, tokenOut].filter(Boolean) as Address[]
    if (addressesToPrefetch.length > 0) {
      tokenDataContext.prefetchTokens(addressesToPrefetch)
    }
  }, [tokenIn, tokenOut, tokenDataContext])

  // Query token data via GraphQL instead of SDK
  const tokenData = useLazyLoadQuery<SwapTokenDataQuery>(
    swapTokenDataQuery,
    {
      tokenInAddress: tokenIn || '',
      tokenOutAddress: tokenOut || '',
      skipTokenIn: !tokenIn || isNativeKUB(tokenIn),
      skipTokenOut: !tokenOut || isNativeKUB(tokenOut),
    },
    { fetchPolicy: 'store-or-network' }
  )

  // Extract token info from GraphQL data
  const tokenInInfo = useMemo(() => {
    if (isNativeKUB(tokenIn)) {
      return { decimals: 18, symbol: 'KUB', name: 'Native KUB' }
    }
    return tokenData.tokenIn ? {
      decimals: tokenData.tokenIn.decimals ?? 18,
      symbol: tokenData.tokenIn.symbol ?? '',
      name: tokenData.tokenIn.name ?? ''
    } : null
  }, [tokenData.tokenIn, tokenIn])

  const tokenOutInfo = useMemo(() => {
    if (isNativeKUB(tokenOut)) {
      return { decimals: 18, symbol: 'KUB', name: 'Native KUB' }
    }
    return tokenData.tokenOut ? {
      decimals: tokenData.tokenOut.decimals ?? 18,
      symbol: tokenData.tokenOut.symbol ?? '',
      name: tokenData.tokenOut.name ?? ''
    } : null
  }, [tokenData.tokenOut, tokenOut])

  // Handle both ERC20 and native KUB balances
  const { data: tokenInBalance, refetch: refetchTokenInBalance } = useTokenBalance(
    tokenIn && tokenIn.toLowerCase() !== KUB_ADDRESS.toLowerCase()
      ? tokenIn
      : ('' as Address),
    account
  )

  const { data: tokenOutBalance, refetch: refetchTokenOutBalance } = useTokenBalance(
    tokenOut && tokenOut.toLowerCase() !== KUB_ADDRESS.toLowerCase()
      ? tokenOut
      : ('' as Address),
    account
  )

  // Fetch native KUB balance
  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address: account,
  })

  const { data: tokenInAllowance, refetch: refetchAllowance } = useTokenAllowance(
    tokenIn && tokenIn.toLowerCase() !== KUB_ADDRESS.toLowerCase()
      ? tokenIn
      : ('' as Address),
    sdk?.router.address,
    account,
    !!(
      tokenIn &&
      tokenIn.toLowerCase() !== KUB_ADDRESS.toLowerCase() &&
      account &&
      sdk?.router.address
    )
  )

  const effectiveTokenInBalance = useMemo(() => {
    if (!tokenIn) return undefined

    if (tokenIn.toLowerCase() === KUB_ADDRESS.toLowerCase()) {
      return nativeBalance?.value || undefined
    }

    return tokenInBalance
  }, [tokenIn, tokenInBalance, nativeBalance])

  const effectiveTokenOutBalance = useMemo(() => {
    if (!tokenOut) return undefined

    if (tokenOut.toLowerCase() === KUB_ADDRESS.toLowerCase()) {
      return nativeBalance?.value || undefined
    }

    return tokenOutBalance
  }, [tokenOut, tokenOutBalance, nativeBalance])

  const parsedAmountIn = useMemo(() => {
    if (!tokenInInfo && !isNativeKUB(tokenIn)) return BigInt(0)
    if (!amountIn) return BigInt(0)

    try {
      // For native KUB, use 18 decimals
      const decimals = isNativeKUB(tokenIn) ? 18 : tokenInInfo!.decimals
      return parseUnits(amountIn, decimals)
    } catch {
      return BigInt(0)
    }
  }, [amountIn, tokenInInfo, tokenIn])

  const { data: wkubAddress } = useQuery({
    queryKey: ['ponder', 'router', 'wkub'],
    queryFn: () => sdk.router.KKUB(),
    enabled: !!sdk.router,
  })

  const routeTokenIn = useMemo(() => {
    if (isNativeKUB(tokenIn) && wkubAddress) {
      return wkubAddress
    }
    return tokenIn as Address
  }, [tokenIn, wkubAddress])

  const routeTokenOut = useMemo(() => {
    if (isNativeKUB(tokenOut) && wkubAddress) {
      return wkubAddress
    }
    return tokenOut as Address
  }, [tokenOut, wkubAddress])

  const isDirectKubWkubSwap = useMemo(() => {
    if (!wkubAddress) return false

    const isKubToWkub =
      isNativeKUB(tokenIn) && tokenOut?.toLowerCase() === wkubAddress.toLowerCase()

    const isWkubToKub =
      tokenIn?.toLowerCase() === wkubAddress.toLowerCase() && isNativeKUB(tokenOut)

    return isKubToWkub || isWkubToKub
  }, [tokenIn, tokenOut, wkubAddress])

  const syntheticDirectRoute = useMemo(() => {
    if (
      !isDirectKubWkubSwap ||
      !tokenIn ||
      !tokenOut ||
      !parsedAmountIn ||
      !wkubAddress
    ) {
      return null
    }

    // Create a synthetic 1:1 route for these special cases
    return {
      path: [routeTokenIn, routeTokenOut],
      pairs: [wkubAddress],
      amountIn: parsedAmountIn,
      amountOut: parsedAmountIn, // 1:1 conversion
      priceImpact: 0,
      totalFee: BigInt(0),
      hops: [
        {
          pair: wkubAddress,
          tokenIn: routeTokenIn,
          tokenOut: routeTokenOut,
          amountIn: parsedAmountIn,
          amountOut: parsedAmountIn, // 1:1 conversion
          fee: BigInt(0),
          priceImpact: 0,
        },
      ],
    }
  }, [
    isDirectKubWkubSwap,
    tokenIn,
    tokenOut,
    parsedAmountIn,
    routeTokenIn,
    routeTokenOut,
    wkubAddress,
  ])

  // Use regular routing for non-direct swaps, synthetic route for direct KUB<->WKUB
  const { data: normalRoute, isLoading: isRouteLoading } = useSwapRoute(
    {
      tokenIn: routeTokenIn as Address,
      tokenOut: routeTokenOut as Address,
      amountIn: parsedAmountIn,
      maxHops: 3,
    },
    Boolean(
      tokenIn &&
        tokenOut &&
        parsedAmountIn > BigInt(0) &&
        (tokenInInfo || isNativeKUB(tokenIn)) &&
        wkubAddress &&
        !isDirectKubWkubSwap
    )
  )

  // 3. Add function to refresh all balances
  const refreshAllBalances = useCallback(async () => {
    // Refresh token balances
    if (tokenIn && tokenIn.toLowerCase() !== KUB_ADDRESS.toLowerCase()) {
      await refetchTokenInBalance()
    }

    if (tokenOut && tokenOut.toLowerCase() !== KUB_ADDRESS.toLowerCase()) {
      await refetchTokenOutBalance()
    }

    // If either token is native KUB, refresh native balance
    if (
      tokenIn?.toLowerCase() === KUB_ADDRESS.toLowerCase() ||
      tokenOut?.toLowerCase() === KUB_ADDRESS.toLowerCase()
    ) {
      await refetchNativeBalance()
    }
  }, [
    tokenIn,
    tokenOut,
    refetchTokenInBalance,
    refetchTokenOutBalance,
    refetchNativeBalance,
  ])

  // Combine normal route with synthetic route
  const route = useMemo(() => {
    if (isDirectKubWkubSwap) {
      return syntheticDirectRoute
    }
    return normalRoute
  }, [normalRoute, syntheticDirectRoute, isDirectKubWkubSwap])

  // Expected output calculations
  const expectedOutput = useMemo(() => {
    if (!route?.amountOut) return null

    // For native KUB, use 18 decimals
    const decimals = isNativeKUB(tokenOut) ? 18 : tokenOutInfo?.decimals || 18

    return {
      raw: BigInt(route.amountOut),
      formatted: formatUnits(BigInt(route.amountOut), decimals),
    }
  }, [route?.amountOut, tokenOutInfo, tokenOut])

  const minimumReceived = useMemo(() => {
    if (!expectedOutput?.raw) return null

    // For native KUB, use 18 decimals
    const decimals = isNativeKUB(tokenOut) ? 18 : tokenOutInfo?.decimals || 18

    const slippageBps = BigInt(Math.round(slippage * 100))
    const slippageAmount = (expectedOutput.raw * slippageBps) / BigInt(10000)
    const minAmount = expectedOutput.raw - slippageAmount

    return {
      raw: minAmount,
      formatted: formatUnits(minAmount, decimals),
    }
  }, [expectedOutput, slippage, tokenOutInfo, tokenOut])

  // Helper function to check if token is native KUB
  function isNativeKUB(tokenAddress?: Address): boolean {
    return !!tokenAddress && tokenAddress.toLowerCase() === KUB_ADDRESS.toLowerCase()
  }

  // Swap execution setup
  const { calldata: swapCalldata } = useSwapCallback({
    route: route ?? undefined,
    recipient: account,
    slippageBps: Math.round(slippage * 100),
    deadline: BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_MINUTES * 60),
  })

  // Create serialized version for gas estimation to avoid BigInt serialization errors
  const serializedCallData = useMemo(() => {
    if (!swapCalldata) return undefined

    // Create a serialized version with BigInts converted to strings
    return {
      to: swapCalldata.to,
      data: swapCalldata.data,
      value: swapCalldata.value,
      gasLimit: swapCalldata.gasLimit.toString(),
    }
  }, [swapCalldata])

  const { data: gasEstimate } = useGasEstimate(
    serializedCallData,
    Boolean(serializedCallData)
  )

  // Contract interactions
  const { mutateAsync: approve } = useSwapApproval()
  const { mutateAsync: swap, isPending: isSwapping } = useSwap()
  const [txHash, setTxHash] = useState<string>()
  const { data: txStatus } = useTransaction(txHash as `0x${string}`)

  // Validation states
  const isApprovalRequired = useMemo(() => {
    if (!route?.amountIn || isNativeKUB(tokenIn) || !tokenInAllowance?.amount || !tokenIn)
      return false
    return BigInt(route.amountIn) > BigInt(tokenInAllowance.amount)
  }, [route?.amountIn, tokenInAllowance?.amount, tokenIn])

  const isValidTrade = useMemo(() => {
    if (!route?.amountIn || !effectiveTokenInBalance || !account) return false

    const amountInBigInt = BigInt(route.amountIn)
    const balanceBigInt = BigInt(effectiveTokenInBalance.toString())

    // For native KUB, keep some for gas
    if (isNativeKUB(tokenIn)) {
      // Make sure gasBuffer is a BigInt
      const gasBuffer = gasEstimate?.estimate
        ? BigInt(gasEstimate.estimate.toString())
        : parseUnits('0.01', 18) // 0.01 KUB as buffer if estimate not available

      return (
        amountInBigInt <= balanceBigInt - gasBuffer &&
        amountInBigInt > BigInt(0) &&
        BigInt(route.amountOut) > BigInt(0)
      )
    }

    return (
      amountInBigInt <= balanceBigInt &&
      amountInBigInt > BigInt(0) &&
      BigInt(route.amountOut) > BigInt(0)
    )
  }, [route, effectiveTokenInBalance, account, tokenIn, gasEstimate])

  const showPriceImpactWarning = (route?.priceImpact || 0) > HIGH_PRICE_IMPACT_THRESHOLD
  const showCriticalPriceImpactWarning =
    (route?.priceImpact || 0) > CRITICAL_PRICE_IMPACT_THRESHOLD

  const handleAmountInput = (value: string) => {
    if (!tokenInInfo && !isNativeKUB(tokenIn)) return
    setError(null)

    // Validate numeric input with decimals
    if (!/^\d*\.?\d*$/.test(value)) return

    // For native KUB, use 18 decimals
    const decimals = isNativeKUB(tokenIn) ? 18 : tokenInInfo!.decimals

    const parts = value.split('.')
    if (parts[1] && parts[1].length > decimals) return

    // Validate maximum amount
    try {
      const parsedAmount = parseUnits(value || '0', decimals)
      if (parsedAmount > MAX_UINT256) return
    } catch {
      return
    }

    setAmountIn(value)
  }

  const handleApproval = useCallback(async () => {
    if (
      !route?.path[0] ||
      !account ||
      !route.amountIn ||
      !tokenIn ||
      isNativeKUB(tokenIn)
    )
      return
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
  }, [route, account, tokenIn, approve, sdk, refetchAllowance])

  const showSuccessToast = (swappedAmountIn: bigint, swappedAmountOut: bigint, txHash: string) => {
    // Format amounts with proper decimals and round to reasonable decimal places
    const formattedAmountIn = isNativeKUB(tokenIn) 
      ? formatNumber(roundDecimal(formatUnits(swappedAmountIn || BigInt(0), 18), 4))
      : tokenInInfo 
        ? formatNumber(roundDecimal(formatUnits(swappedAmountIn || BigInt(0), tokenInInfo.decimals), 4))
        : '0';

    const formattedAmountOut = isNativeKUB(tokenOut)
      ? formatNumber(roundDecimal(formatUnits(swappedAmountOut || BigInt(0), 18), 4))
      : tokenOutInfo
        ? formatNumber(roundDecimal(formatUnits(swappedAmountOut || BigInt(0), tokenOutInfo.decimals), 4))
        : '0';

    // Get token data from context for the TokenPair display
    const tokenInData = tokenDataContext.getTokenData(tokenIn!)
    const tokenOutData = tokenDataContext.getTokenData(tokenOut!)

    const id = toast.show({
      color: 'neutral',
      title: (
        <View direction="row" align="start" gap={3} position="relative">
          {/* Token Pair Display */}
          {tokenInData && tokenOutData ? (
            <View position="relative">
              <View
                height={8}
                width={8}
                overflow="hidden"
                insetStart={-4.25}
              >
                <View
                  position="absolute"
                  insetTop={0}
                  insetEnd={-4}
                  attributes={{ style: { zIndex: 2 } }}
                  overflow="hidden"
                  borderRadius="circular"
                  height={8}
                  width={8}
                >
                  <Image
                    src={tokenInData.imageURI ? getIpfsGateway(tokenInData.imageURI) : '/tokens/coin.svg'}
                    height={8}
                    width={8}
                    alt={tokenInData.symbol || 'Token'}
                  />
                </View>
              </View>
              <View
                height={8}
                width={8}
                overflow="hidden"
                insetEnd={-4.25}
                insetTop={0}
                position="absolute"
              >
                <View
                  position="absolute"
                  insetTop={0}
                  insetStart={-4}
                  overflow="hidden"
                  borderRadius="circular"
                  attributes={{
                    style: {
                      zIndex: 1,
                    },
                  }}
                >
                  <Image
                    src={tokenOutData.imageURI ? getIpfsGateway(tokenOutData.imageURI) : '/tokens/coin.svg'}
                    height={8}
                    width={8}
                    alt={tokenOutData.symbol || 'Token'}
                  />
                </View>
              </View>
            </View>
          ) : null}
          <View direction="column" gap={1}>
            <Text variant="body-2" weight="regular">Swapped</Text>
            <Text variant="body-2" color="neutral-faded" weight="regular">
              {formattedAmountIn} {tokenInInfo?.symbol || 'KUB'} for {formattedAmountOut} {tokenOutInfo?.symbol || 'KUB'}
            </Text>
          </View>
          <Button
            onClick={() => toast.hide(id)}
            variant="ghost"
            size="small"
            attributes={{
              style: {
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                zIndex: 10
              }
            }}
          >
            <Icon svg={X} />
          </Button>
        </View>
      ),
      timeout: 0,
    })
  }

  const handleSwap = async () => {
    if (!route || !account || !minimumReceived?.raw || !sdk) return
    setError(null)
    setIsProcessing(true)

    try {
      // Use the user-controlled slippage from the UI
      const currentMinimumReceived = minimumReceived.raw
      // Special case for KUB -> WKUB (direct deposit)
      if (
        isNativeKUB(tokenIn) &&
        tokenOut &&
        wkubAddress &&
        tokenOut.toLowerCase() === wkubAddress.toLowerCase()
      ) {
        try {
          console.log('Using direct deposit for KUB -> WKUB')

          // Get WKUB contract instance
          const wkubContract = {
            address: wkubAddress,
            abi: [
              {
                name: 'deposit',
                type: 'function',
                stateMutability: 'payable',
                inputs: [],
                outputs: [],
              },
            ],
          }

          // Execute deposit transaction
          const hash = await sdk?.walletClient?.writeContract({
            address: wkubAddress,
            abi: wkubContract.abi,
            functionName: 'deposit',
            value: parsedAmountIn,
            chain: CURRENT_CHAIN,
            account,
          })

          if (!hash) throw new Error('Failed to get transaction hash')
          
          setTxHash(hash)

          await sdk.publicClient.waitForTransactionReceipt({
            hash: hash as `0x${string}`,
            confirmations: 1,
          })

          showSuccessToast(parsedAmountIn, parsedAmountIn, hash as string)
          
          // Refresh balances immediately
          await refreshAllBalances()
          
          setAmountIn('')
          setTxHash(undefined)
          setError(null)

          return
        } catch (err: any) {
          console.error('WKUB deposit failed:', err)
          setError(`WKUB deposit failed: ${err.message || 'Unknown error'}`)
          setIsProcessing(false)
          return
        }
      }

      // Special case for WKUB -> KUB (try unwrapKKUB first, then fallback to router)
      if (
        tokenIn &&
        wkubAddress &&
        tokenIn.toLowerCase() === wkubAddress.toLowerCase() &&
        isNativeKUB(tokenOut)
      ) {
        // Try with direct unwrapper first
        try {
          console.log('Using direct unwrapKKUB for WKUB -> KUB')

          // Check current allowance
          const unwrapperAllowance = await sdk.publicClient.readContract({
            address: wkubAddress,
            abi: kubTokenAbi,
            functionName: 'allowance',
            args: [account, sdk.kkubUnwrapper.address],
          })

          // If allowance is insufficient, we need to approve
          if (unwrapperAllowance < parsedAmountIn) {
            console.log('Approving WKUB for unwrapper...')
            setApprovalsPending((prev) => new Set(prev).add(wkubAddress))

            // For WKUB -> KUB, approve directly without using the approval function
            // This ensures we're setting the exact allowance needed
            const approveHash = await sdk?.walletClient?.writeContract({
              address: wkubAddress,
              abi: kubTokenAbi,
              functionName: 'approve',
              args: [sdk.kkubUnwrapper.address, parsedAmountIn],
              account,
              chain: CURRENT_CHAIN,
            })

            // Wait for approval transaction to be confirmed
            await sdk.publicClient.waitForTransactionReceipt({
              hash: approveHash as `0x${string}`,
              confirmations: 1,
            })

            // Verify the new allowance after approval
            const newAllowance = await sdk.publicClient.readContract({
              address: wkubAddress,
              abi: kubTokenAbi,
              functionName: 'allowance',
              args: [account, sdk.kkubUnwrapper.address],
            })

            console.log('New allowance after approval:', newAllowance?.toString())

            setApprovalsPending((prev) => {
              const next = new Set(prev)
              next.delete(wkubAddress)
              return next
            })
          }

          // Now call unwrapKKUB with the approved amount
          const hash = await sdk.unwrapKKUB(parsedAmountIn, account)

          setTxHash(hash)
          setAmountIn('')

          await sdk.publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
          })

          return
        } catch (unwrapErr: any) {
          console.error('Direct WKUB unwrap failed, trying router:', unwrapErr)
        }
      }

      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_MINUTES * 60
      )
      const isETHIn = isNativeKUB(tokenIn)
      const isETHOut = isNativeKUB(tokenOut)

      let swapParams: SwapParams

      if (isETHIn && parsedAmountIn) {
        swapParams = {
          type: 'exactETHForTokens',
          params: {
            amountOutMin: currentMinimumReceived,
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
            amountOutMin: currentMinimumReceived,
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
            amountOutMin: currentMinimumReceived,
            path: route.path,
            to: account,
            deadline,
          },
        }
      }

      const result = await swap(swapParams)
      if (!result.hash) throw new Error('Failed to get transaction hash')
      
      setTxHash(result.hash)

      await sdk.publicClient.waitForTransactionReceipt({
        hash: result.hash,
        confirmations: 1,
      })

      showSuccessToast(parsedAmountIn, route.amountOut, result.hash as string)
      
      // Refresh balances after a successful swap
      await refreshAllBalances()
      
      setAmountIn('')
      setTxHash(undefined)
      setError(null)
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

  // Handle token selection with Uniswap-like swap behavior
  const handleTokenSelect = (position: 'in' | 'out', address: Address) => {
    if (position === 'in') {
      // If selecting the same token that's already in the output
      if (tokenOut && address.toLowerCase() === tokenOut.toLowerCase()) {
        // Swap the tokens
        setTokenIn(tokenOut)
        setTokenOut(tokenIn)
      } else {
        // Regular selection
        setTokenIn(address)
      }
    } else {
      // position === 'out'
      // If selecting the same token that's already in the input
      if (tokenIn && address.toLowerCase() === tokenIn.toLowerCase()) {
        // Swap the tokens
        setTokenOut(tokenIn)
        setTokenIn(tokenOut)
      } else {
        // Regular selection
        setTokenOut(address)
      }
    }

    // Reset input amount when tokens change
    setAmountIn('')
    setError(null)
  }

  // Remove the useEffect for transaction status since we're handling it in the swap function
  useEffect(() => {
    if (error) {
      const id = toast.show({
        color: 'critical',
        title: '',
        text: error,
        actionsSlot: (
          <Button onClick={() => toast.hide(id)} variant="ghost">
            <Icon svg={X} />
          </Button>
        ),
      })
    }
  }, [error])

  return (
    <View align="center" className={className}>
      <View width={{ s: '100%', m: defaultWidth }}>
        <View gap={2} borderRadius="large">
          <InterfaceTabs slippage={slippage} setSlippage={setSlippage} />
          <View maxHeight="600px" overflow="auto" gap={1}>
            {/* Input Token Section */}
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              borderColor="neutral-faded"
              align="start"
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
                    autoFocus
                  />
                </View>

                <TokenSelector
                  onSelectToken={(address) => handleTokenSelect('in', address)}
                  tokenAddress={tokenIn}
                  otherSelectedToken={tokenOut}
                />
              </View>
              <View>
                {effectiveTokenInBalance && (tokenInInfo || isNativeKUB(tokenIn)) && (
                  <View direction="row" align="center" justify="end" gap={2}>
                    {/* Display balance based on whether it's native KUB or ERC20 */}
                    {isNativeKUB(tokenIn) ? (
                      <Text color="neutral-faded" variant="body-3" maxLines={1}>
                        {formatNumber(
                          roundDecimal(formatUnits(effectiveTokenInBalance, 18), 2)
                        )}{' '}
                        KUB
                      </Text>
                    ) : (
                      <TokenBalanceDisplay
                        tokenInBalance={effectiveTokenInBalance}
                        tokenInInfo={tokenInInfo!}
                      />
                    )}
                    {effectiveTokenInBalance > BigInt(0) && (
                      <Actionable
                        onClick={() => {
                          const decimals = isNativeKUB(tokenIn)
                            ? 18
                            : tokenInInfo!.decimals

                          // If native KUB, leave some for gas
                          if (isNativeKUB(tokenIn)) {
                            const gasBuffer =
                              gasEstimate?.estimate || parseUnits('0.01', 18)
                            const maxAmount = effectiveTokenInBalance - gasBuffer
                            if (maxAmount > BigInt(0)) {
                              setAmountIn(formatUnits(maxAmount, decimals))
                            }
                          } else {
                            setAmountIn(formatUnits(effectiveTokenInBalance, decimals))
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

            {/* Output Token Section */}
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              backgroundColor="elevation-base"
              align="start"
              position="relative"
            >
              <View
                position="absolute"
                insetTop={-7}
                align="center"
                backgroundColor="elevation-overlay"
                borderColor="neutral-faded"
                borderRadius="large"
                attributes={{
                  style: {
                    left: '50%',
                    marginLeft: '-22px',
                    borderWidth: '4px',
                    borderColor: 'var(--rs-color-background-page)',
                  },
                }}
                zIndex={2}
              >
                <Button
                  onClick={() => {
                    if (!isProcessing) {
                      setTokenIn(tokenOut)
                      setTokenOut(tokenIn)
                      setAmountIn('')
                      setError(null)
                    }
                  }}
                  disabled={isProcessing}
                  variant="ghost"
                  size="small"
                  attributes={{ style: { paddingInline: 4 } }}
                >
                  <View padding={2}>
                    <ArrowDown size={24} />
                  </View>
                </Button>
              </View>
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

                <TokenSelector
                  onSelectToken={(address) => handleTokenSelect('out', address)}
                  tokenAddress={tokenOut}
                  otherSelectedToken={tokenIn}
                />
              </View>
              <View>
                {effectiveTokenOutBalance && (tokenOutInfo || isNativeKUB(tokenOut)) && (
                  <View direction="row" align="center" justify="end" gap={2}>
                    {/* Display balance based on whether it's native KUB or ERC20 */}
                    {isNativeKUB(tokenOut) ? (
                      <Text color="neutral-faded" variant="body-3" maxLines={1}>
                        {formatNumber(
                          roundDecimal(formatUnits(effectiveTokenOutBalance, 18))
                        )}{' '}
                        KUB
                      </Text>
                    ) : (
                      <TokenBalanceDisplay
                        tokenInBalance={effectiveTokenOutBalance}
                        tokenInInfo={tokenOutInfo!}
                      />
                    )}
                  </View>
                )}
              </View>
            </View>
            {/* Trade Details */}
            {/*{route && (*/}
            {/*  <View gap={4} className="bg-gray-50 p-4 rounded mt-4">*/}
            {/*    <View direction="row" justify="space-between">*/}
            {/*      <Text>Price Impact</Text>*/}
            {/*      <Text*/}
            {/*        color={*/}
            {/*          showCriticalPriceImpactWarning*/}
            {/*            ? 'critical'*/}
            {/*            : showPriceImpactWarning*/}
            {/*              ? 'warning'*/}
            {/*              : 'neutral'*/}
            {/*        }*/}
            {/*      >*/}
            {/*        {route.priceImpact.toFixed(2)}%*/}
            {/*      </Text>*/}
            {/*    </View>*/}

            {/*    <View direction="row" justify="space-between">*/}
            {/*      <Text>Minimum Received</Text>*/}
            {/*      <Text>*/}
            {/*        {minimumReceived?.formatted}{' '}*/}
            {/*        {isNativeKUB(tokenOut) ? 'KUB' : tokenOutInfo?.symbol}*/}
            {/*      </Text>*/}
            {/*    </View>*/}

            {/*    {gasEstimate && (*/}
            {/*      <View direction="row" justify="space-between">*/}
            {/*        <Text>Network Fee</Text>*/}
            {/*        <Text>{gasEstimate.estimateInKUB} KUB</Text>*/}
            {/*      </View>*/}
            {/*    )}*/}

            {/*    {route.totalFee > BigInt(0) && (*/}
            {/*      <View direction="row" justify="space-between">*/}
            {/*        <Text>Trading Fee</Text>*/}
            {/*        <Text>*/}
            {/*          {formatUnits(*/}
            {/*            route.totalFee,*/}
            {/*            isNativeKUB(tokenIn) ? 18 : tokenInInfo?.decimals || 18*/}
            {/*          )}{' '}*/}
            {/*          {isNativeKUB(tokenIn) ? 'KUB' : tokenInInfo?.symbol}*/}
            {/*        </Text>*/}
            {/*      </View>*/}
            {/*    )}*/}
            {/*  </View>*/}
            {/*)}*/}

            {/* Action Buttons */}
            <View gap={4} className="mt-4">
              {!account ? (
                <Button
                  fullWidth
                  size="large"
                  variant="solid"
                  color="primary"
                  /*//@ts-ignore*/
                  onClick={login}
                >
                  Connect Wallet
                </Button>
              ) : !tokenIn || !tokenOut ? (
                <Button fullWidth size="large" disabled>
                  Select Tokens
                </Button>
              ) : !route || !amountIn ? (
                <Button fullWidth size="large" disabled loading={isRouteLoading}>
                  {isRouteLoading ? 'Fetching quote' : 'Enter Amount'}
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
                  disabled={!isValidTrade || !route || isProcessing || isRouteLoading}
                  loading={isRouteLoading || isProcessing}
                  onClick={handleSwap}
                  variant="solid"
                  color="primary"
                  attributes={{ style: { borderRadius: 'var(--rs-radius-large)' } }}
                >
                  {isRouteLoading ? 'Finalizing Quote ' : 'Swap'}
                </Button>
              )}
              <View>
                {gasEstimate && (
                  <View direction="row" gap={1}>
                    <Icon svg={GasPump} size={4} color="neutral-faded" />
                    <Text variant="caption-2" weight="regular">
                      {gasEstimate.estimateInKUB} KUB
                    </Text>
                  </View>
                )}
              </View>

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
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

export default SwapInterface

// Safe wrapper that only renders SwapInterface when Relay environment is available
function SafeSwapInterface(props: SwapInterfaceProps) {
  try {
    // This will throw if no Relay environment is available
    useRelayEnvironment()
    return <SwapInterface {...props} />
  } catch (error) {
    // Return the same UI structure but without Relay functionality
    return <SwapInterfaceStaticUI {...props} />
  }
}

// Static UI version without Relay queries for when environment isn't ready
function SwapInterfaceStaticUI({ defaultTokenIn, defaultTokenOut, defaultWidth = '480px', className }: SwapInterfaceProps) {
  const { login } = usePrivy()
  const { address: account } = useAccount()
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE)

  return (
    <View align="center" className={className}>
      <View width={{ s: '100%', m: defaultWidth }}>
        <View gap={2} borderRadius="large">
          {/* Show actual interface tabs */}
          <InterfaceTabs slippage={slippage} setSlippage={setSlippage} />
          
          <View maxHeight="600px" overflow="auto" gap={1}>
            {/* Input Token Section */}
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              borderColor="neutral-faded"
              align="start"
            >
              <Text color="neutral-faded" variant="body-3">
                Sell
              </Text>
              <View direction="row" gap={8} wrap={false}>
                <View grow={true} align="center">
                  <input
                    placeholder="0"
                    disabled
                    className="flex w-full h-full text-4xl bg-[rgba(0,0,0,0)] focus:outline-0"
                  />
                </View>
                <TokenSelector
                  onSelectToken={() => {}} // Disabled function
                  tokenAddress={defaultTokenIn}
                  otherSelectedToken={defaultTokenOut}
                />
              </View>
            </View>

            {/* Output Token Section */}
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              backgroundColor="elevation-base"
              align="start"
              position="relative"
            >
              <View
                position="absolute"
                insetTop={-7}
                align="center"
                backgroundColor="elevation-overlay"
                borderColor="neutral-faded"
                borderRadius="large"
                attributes={{
                  style: {
                    left: '50%',
                    marginLeft: '-22px',
                    borderWidth: '4px',
                    borderColor: 'var(--rs-color-background-page)',
                  },
                }}
                zIndex={2}
              >
                <Button
                  disabled
                  variant="ghost"
                  size="small"
                  attributes={{ style: { paddingInline: 4 } }}
                >
                  <View padding={2}>
                    <ArrowDown size={24} />
                  </View>
                </Button>
              </View>
              <Text color="neutral-faded" variant="body-3">
                Buy
              </Text>
              <View direction="row" gap={8} wrap={false}>
                <View grow={true} align="center">
                  <input
                    placeholder="0"
                    disabled
                    readOnly
                    className="flex w-full h-full text-4xl bg-[rgba(0,0,0,0)] focus:outline-0"
                  />
                </View>
                <TokenSelector
                  onSelectToken={() => {}} // Disabled function
                  tokenAddress={defaultTokenOut}
                  otherSelectedToken={defaultTokenIn}
                />
              </View>
            </View>

            {/* Action Button */}
            <View gap={4} className="mt-4">
              {!account ? (
                <Button
                  fullWidth
                  size="large"
                  variant="solid"
                  color="primary"
                  onClick={() => login()}
                >
                  Connect Wallet
                </Button>
              ) : (
                <Button fullWidth size="large" disabled>
                  Loading...
                </Button>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

// Client-side wrapper to prevent SSR execution of Relay queries
export function ClientSwapInterface(props: SwapInterfaceProps) {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  if (!isClient) {
    // Return the static UI during SSR
    return <SwapInterfaceStaticUI {...props} />
  }
  
  // Use the safe wrapper for client-side rendering
  return <SafeSwapInterface {...props} />
}
