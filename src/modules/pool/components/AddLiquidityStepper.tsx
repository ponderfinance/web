import {
  Stepper,
  View,
  Text,
  Button,
  Icon,
  DropdownMenu,
  Actionable,
  useToast,
  Badge,
} from 'reshaped'
import { Address, formatUnits, parseUnits, zeroAddress } from 'viem'
import { useAccount, useBalance } from 'wagmi'
import {
  useTokenBalance,
  useTokenInfo,
  usePonderSDK,
  usePairExists,
  usePairInfo,
  useAddLiquidity,
  useTokenApproval,
} from '@ponderfinance/sdk'
import TokenSelector from '@/src/components/TokenSelector'
import { GearSix, NotePencil, X, Warning } from '@phosphor-icons/react'
import { TokenPair } from '@/src/components/TokenPair'
import { formatNumber, roundDecimal } from '@/src/utils/numbers'
import { useQuery } from '@tanstack/react-query'
import { KKUB_ADDRESS } from '@/src/constants/addresses'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'

interface AddLiquidityStepperProps {
  defaultTokenA?: Address
  defaultTokenB?: Address
}

// Hardcoded token list
const TOKENS = {
  KKUB: KKUB_ADDRESS[CURRENT_CHAIN.id] as Address,
  KUB: zeroAddress as Address,
}

// Extended ABI for tokens that might use allowances instead of allowance
const extendedAllowanceAbi = [
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
    name: 'allowances',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

const AddLiquidityStepper = ({
  defaultTokenA,
  defaultTokenB = zeroAddress,
}: AddLiquidityStepperProps) => {
  const sdk = usePonderSDK()
  const { login } = usePrivy()

  const { address: account } = useAccount()
  const [activeStep, setActiveStep] = useState(0)

  // Token selection state
  const [tokenA, setTokenA] = useState<Address | undefined>(defaultTokenA)
  const [tokenB, setTokenB] = useState<Address | undefined>(defaultTokenB)

  // Form state
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [slippage, setSlippage] = useState(1.0) // 1% default
  const [error, setError] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [manualApprovalCheck, setManualApprovalCheck] = useState({
    tokenA: false,
    tokenB: false,
  })
  const toast = useToast()

  useEffect(() => {
    if (error) {
      if (error.toString().includes('User rejected the request')) {
        return
      }

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
  }, [error, toast])

  // Determine if we're dealing with native KUB
  const isNativeKUBPair = useMemo(() => {
    return tokenA === zeroAddress || tokenB === zeroAddress
  }, [tokenA, tokenB])

  // SDK Hooks for tokens
  const { data: tokenAInfo } = useTokenInfo(
    tokenA === zeroAddress ? (null as unknown as Address) : (tokenA as Address)
  )
  const { data: tokenBInfo } = useTokenInfo(
    tokenB === zeroAddress ? (null as unknown as Address) : (tokenB as Address)
  )
  const { data: tokenABalance } = useTokenBalance(
    tokenA === zeroAddress ? (null as unknown as Address) : (tokenA as Address),
    account as Address
  )
  const { data: tokenBBalance } = useTokenBalance(
    tokenB === zeroAddress ? (null as unknown as Address) : (tokenB as Address),
    account as Address
  )

  // Token approval hooks
  const {
    allowance: allowanceA,
    approve: approveA,
    isApproved: isApprovedA,
  } = useTokenApproval(
    tokenA === zeroAddress ? (null as unknown as Address) : (tokenA as Address),
    sdk?.router?.address
  )

  const {
    allowance: allowanceB,
    approve: approveB,
    isApproved: isApprovedB,
  } = useTokenApproval(
    tokenB === zeroAddress ? (null as unknown as Address) : (tokenB as Address),
    sdk?.router?.address
  )

  // Get native KUB balance if needed
  const { data: kubBalance } = useBalance({
    address: account,
  })

  // For pair existence check, we need to use KKUB address if it's a native pair
  const pairTokenA = tokenA === zeroAddress ? TOKENS.KKUB : (tokenA as Address)
  const pairTokenB = tokenB === zeroAddress ? TOKENS.KKUB : (tokenB as Address)
  const { data: pairExists, isLoading: isPairCheckLoading } = usePairExists(
    pairTokenA,
    pairTokenB
  )
  const { data: pairInfo, isLoading: isPairInfoLoading } = usePairInfo(
    pairExists?.pairAddress as Address
  )

  // Get WETH (KKUB) address for comparison
  const { data: wethAddress } = useQuery({
    queryKey: ['ponder', 'router', 'wkub'],
    queryFn: () => sdk.router.KKUB(),
    enabled: !!sdk?.router,
  })

  // Add liquidity mutation
  const {
    mutateAsync: addLiquidity,
    isPending: isAddingLiquidity,
    status,
  } = useAddLiquidity()

  // Direct check for token allowance (supporting both allowance and allowances)
  const checkTokenAllowance = useCallback(
    async (token: Address, owner: Address, spender: Address): Promise<bigint> => {
      if (!sdk?.publicClient) return BigInt(0)

      try {
        // Try allowances first (specific to KUSDT)
        return (await sdk.publicClient.readContract({
          address: token,
          abi: extendedAllowanceAbi,
          functionName: 'allowances',
          args: [owner, spender],
        })) as bigint
      } catch (err) {
        try {
          // Fall back to standard allowance
          return (await sdk.publicClient.readContract({
            address: token,
            abi: extendedAllowanceAbi,
            functionName: 'allowance',
            args: [owner, spender],
          })) as bigint
        } catch (err2) {
          console.error('Failed to check token allowance:', err2)
          return BigInt(0)
        }
      }
    },
    [sdk]
  )

  // Check manual approvals when needed
  useEffect(() => {
    const checkApprovals = async () => {
      if (
        !account ||
        !sdk?.router?.address ||
        !tokenA ||
        !tokenB ||
        !amountA ||
        !amountB
      ) {
        return
      }

      try {
        // Check token A (if not native)
        if (tokenA !== zeroAddress && tokenAInfo) {
          const amountADesired = parseUnits(amountA, tokenAInfo.decimals)
          const tokenAAllowance = await checkTokenAllowance(
            tokenA as Address,
            account as Address,
            sdk.router.address as Address
          )
          setManualApprovalCheck((prev) => ({
            ...prev,
            tokenA: tokenAAllowance >= amountADesired,
          }))
        } else {
          setManualApprovalCheck((prev) => ({ ...prev, tokenA: true }))
        }

        // Check token B (if not native)
        if (tokenB !== zeroAddress && tokenBInfo) {
          const amountBDesired = parseUnits(amountB, tokenBInfo.decimals)
          const tokenBAllowance = await checkTokenAllowance(
            tokenB as Address,
            account as Address,
            sdk.router.address as Address
          )
          setManualApprovalCheck((prev) => ({
            ...prev,
            tokenB: tokenBAllowance >= amountBDesired,
          }))
        } else {
          setManualApprovalCheck((prev) => ({ ...prev, tokenB: true }))
        }
      } catch (err) {
        console.error('Error checking token approvals:', err)
      }
    }

    // Check after approvals or when dependencies change
    if (!isProcessing) {
      checkApprovals()
    }
  }, [
    tokenA,
    tokenB,
    amountA,
    amountB,
    account,
    sdk?.router?.address,
    tokenAInfo,
    tokenBInfo,
    isProcessing,
    checkTokenAllowance,
  ])

  const validateAmounts = (amountADesired: bigint, amountBDesired: bigint) => {
    if (amountADesired <= BigInt(0) || amountBDesired <= BigInt(0)) {
      setError('Amounts must be greater than 0')
      return false
    }

    try {
      const slippageBps = BigInt(Math.round(slippage * 100))
      const slippageMultiplier = BigInt(10000) - slippageBps

      const _amountAMin = (amountADesired * slippageMultiplier) / BigInt(10000)
      const _amountBMin = (amountBDesired * slippageMultiplier) / BigInt(10000)

      return true
    } catch (err) {
      setError('Amount calculation would cause overflow')
      return false
    }
  }

  // Handle token approval with support for allowances
  const handleApproval = async () => {
    if (!account || !sdk?.router?.address) return

    try {
      setError('')
      setIsProcessing(true)
      let approvalSuccess = false

      // Approve tokenA if it's an ERC20 and needs approval
      if (tokenA !== zeroAddress && tokenAInfo && amountA) {
        try {
          const amountADesired = parseUnits(amountA, tokenAInfo.decimals)

          // Check current allowance
          const currentAllowanceA = await checkTokenAllowance(
            tokenA as Address,
            account,
            sdk.router.address
          )

          console.log(
            `Current allowance for ${tokenAInfo.symbol}:`,
            currentAllowanceA.toString(),
            'Required:',
            amountADesired.toString()
          )

          if (currentAllowanceA < amountADesired) {
            console.log(
              `Approving ${tokenAInfo.symbol} (${tokenA}) for amount ${amountADesired}`
            )

            await approveA.mutateAsync({
              token: tokenA as Address,
              spender: sdk.router.address,
              amount: amountADesired,
            })

            // Verify approval went through
            await new Promise((resolve) => setTimeout(resolve, 2000))

            const newAllowanceA = await checkTokenAllowance(
              tokenA as Address,
              account,
              sdk.router.address
            )

            console.log(
              `New allowance for ${tokenAInfo.symbol}:`,
              newAllowanceA.toString()
            )

            if (newAllowanceA >= amountADesired) {
              setManualApprovalCheck((prev) => ({ ...prev, tokenA: true }))
              approvalSuccess = true
            }
          } else {
            console.log(`${tokenAInfo.symbol} already has sufficient allowance`)
            setManualApprovalCheck((prev) => ({ ...prev, tokenA: true }))
            approvalSuccess = true
          }
        } catch (err) {
          console.error('Error approving token A:', err)
        }
      }

      // Approve tokenB if it's an ERC20 and needs approval
      if (tokenB !== zeroAddress && tokenBInfo && amountB) {
        try {
          const amountBDesired = parseUnits(amountB, tokenBInfo.decimals)

          // Check current allowance
          const currentAllowanceB = await checkTokenAllowance(
            tokenB as Address,
            account,
            sdk.router.address
          )

          console.log(
            `Current allowance for ${tokenBInfo.symbol}:`,
            currentAllowanceB.toString(),
            'Required:',
            amountBDesired.toString()
          )

          if (currentAllowanceB < amountBDesired) {
            console.log(
              `Approving ${tokenBInfo.symbol} (${tokenB}) for amount ${amountBDesired}`
            )

            await approveB.mutateAsync({
              token: tokenB as Address,
              spender: sdk.router.address,
              amount: amountBDesired,
            })

            // Verify approval went through
            await new Promise((resolve) => setTimeout(resolve, 2000))

            const newAllowanceB = await checkTokenAllowance(
              tokenB as Address,
              account,
              sdk.router.address
            )

            console.log(
              `New allowance for ${tokenBInfo.symbol}:`,
              newAllowanceB.toString()
            )

            if (newAllowanceB >= amountBDesired) {
              setManualApprovalCheck((prev) => ({ ...prev, tokenB: true }))
              approvalSuccess = true
            }
          } else {
            console.log(`${tokenBInfo.symbol} already has sufficient allowance`)
            setManualApprovalCheck((prev) => ({ ...prev, tokenB: true }))
            approvalSuccess = true
          }
        } catch (err) {
          console.error('Error approving token B:', err)
        }
      }

      // Force a re-render after approval
      setIsProcessing(false)
    } catch (err: any) {
      console.error('Approval error:', err)
      setError(err.message || 'Failed to approve token')
      setIsProcessing(false)
    }
  }

  // Auto-calculate amount B based on amount A and reserves
  useEffect(() => {
    if (!amountA || (!tokenAInfo && tokenA !== zeroAddress) || !pairInfo) {
      setAmountB('')
      return
    }

    try {
      const tokenADecimals = tokenA === zeroAddress ? 18 : tokenAInfo!.decimals
      const amountABigInt = parseUnits(amountA, tokenADecimals)

      // For new pairs, set 1:1 ratio
      if (
        BigInt(pairInfo.reserve0) === BigInt(0) &&
        BigInt(pairInfo.reserve1) === BigInt(0)
      ) {
        setAmountB(amountA)
        return
      }

      // For existing pairs, calculate based on reserves
      const isToken0 = pairTokenA.toLowerCase() === pairInfo.token0.toLowerCase()
      const reserveIn = isToken0 ? BigInt(pairInfo.reserve0) : BigInt(pairInfo.reserve1)
      const reserveOut = isToken0 ? BigInt(pairInfo.reserve1) : BigInt(pairInfo.reserve0)

      const amountBBigInt = (amountABigInt * reserveOut) / reserveIn
      const tokenBDecimals = tokenB === zeroAddress ? 18 : tokenBInfo?.decimals || 18
      const formattedAmount = formatUnits(amountBBigInt, tokenBDecimals)

      setAmountB(formattedAmount)
    } catch (err) {
      setAmountB('')
    }
  }, [amountA, tokenA, tokenB, pairTokenA, pairInfo, tokenAInfo, tokenBInfo])

  const handleAmountAInput = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return

    const decimals = tokenA === zeroAddress ? 18 : tokenAInfo?.decimals || 18
    const parts = value.split('.')
    if (parts.length > 1 && parts[1].length > decimals) return

    try {
      if (value !== '') {
        parseUnits(value, decimals)
      }
      setAmountA(value)
    } catch (err) {
      // console.error('Invalid amount:', err)
    }
  }

  const handleAmountBInput = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return

    const decimals = tokenB === zeroAddress ? 18 : tokenBInfo?.decimals || 18
    const parts = value.split('.')
    if (parts.length > 1 && parts[1].length > decimals) return

    try {
      if (value !== '') {
        parseUnits(value, decimals)
      }
      setAmountB(value)
    } catch (err) {
      // console.error('Invalid amount:', err)
    }
  }

  const handleAddLiquidity = async () => {
    if (!account || !tokenA || !tokenB) return

    try {
      setError('')
      setIsProcessing(true)

      // Parse amounts with appropriate decimals
      const tokenADecimals = tokenA === zeroAddress ? 18 : tokenAInfo?.decimals || 18
      const tokenBDecimals = tokenB === zeroAddress ? 18 : tokenBInfo?.decimals || 18

      const amountADesired = parseUnits(amountA, tokenADecimals)
      const amountBDesired = parseUnits(amountB, tokenBDecimals)

      if (!validateAmounts(amountADesired, amountBDesired)) {
        setIsProcessing(false)
        return
      }

      // Calculate minimum amounts with slippage
      const slippageBps = BigInt(Math.round(slippage * 100))
      const slippageMultiplier = BigInt(10000) - slippageBps
      const amountAMin = (amountADesired * slippageMultiplier) / BigInt(10000)
      const amountBMin = (amountBDesired * slippageMultiplier) / BigInt(10000)

      // Verify approvals one last time
      let approvalsOK = true

      if (tokenA !== zeroAddress) {
        const currentAllowanceA = await checkTokenAllowance(
          tokenA as Address,
          account,
          sdk.router.address
        )
        if (currentAllowanceA < amountADesired) {
          setError(`${tokenAInfo?.symbol || 'Token A'} approval required`)
          setIsProcessing(false)
          return
        }
      }

      if (tokenB !== zeroAddress) {
        const currentAllowanceB = await checkTokenAllowance(
          tokenB as Address,
          account,
          sdk.router.address
        )
        if (currentAllowanceB < amountBDesired) {
          setError(`${tokenBInfo?.symbol || 'Token B'} approval required`)
          setIsProcessing(false)
          return
        }
      }

      // IMPORTANT: Handle native KUB pairs
      if (isNativeKUBPair) {
        console.log('Using addLiquidityETH for native KUB pair:', {
          tokenA: tokenA === zeroAddress ? 'Native KUB' : tokenA,
          tokenB: tokenB === zeroAddress ? 'Native KUB' : tokenB,
        })

        if (tokenA === zeroAddress) {
          // Case: tokenA is native KUB, tokenB is ERC20
          await sdk.publicClient
            .simulateContract({
              address: sdk.router.address,
              abi: [
                {
                  name: 'addLiquidityETH',
                  type: 'function',
                  stateMutability: 'payable',
                  inputs: [
                    { name: 'token', type: 'address' },
                    { name: 'amountTokenDesired', type: 'uint256' },
                    { name: 'amountTokenMin', type: 'uint256' },
                    { name: 'amountETHMin', type: 'uint256' },
                    { name: 'to', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                  ],
                  outputs: [
                    { name: 'amountToken', type: 'uint256' },
                    { name: 'amountETH', type: 'uint256' },
                    { name: 'liquidity', type: 'uint256' },
                  ],
                },
              ],
              functionName: 'addLiquidityETH',
              args: [
                tokenB as Address, // ERC20 token
                amountBDesired, // Token amount
                amountBMin, // Min token
                amountAMin, // Min ETH
                account,
                BigInt(Math.floor(Date.now() / 1000) + 1200),
              ],
              account,
              value: amountADesired, // ETH value
            })
            .then(({ request }) => {
              return sdk?.walletClient?.writeContract(request)
            })
            .then(() => {
              const id = toast.show({
                color: 'positive',
                title: 'Position created',
                text: 'You have successfully added liquidity.',
                actionsSlot: (
                  <Button onClick={() => toast.hide(id)} variant="ghost">
                    <Icon svg={X} />
                  </Button>
                ),
              })
            })
        } else {
          // Case: tokenB is native KUB, tokenA is ERC20
          await sdk.publicClient
            .simulateContract({
              address: sdk.router.address,
              abi: [
                {
                  name: 'addLiquidityETH',
                  type: 'function',
                  stateMutability: 'payable',
                  inputs: [
                    { name: 'token', type: 'address' },
                    { name: 'amountTokenDesired', type: 'uint256' },
                    { name: 'amountTokenMin', type: 'uint256' },
                    { name: 'amountETHMin', type: 'uint256' },
                    { name: 'to', type: 'address' },
                    { name: 'deadline', type: 'uint256' },
                  ],
                  outputs: [
                    { name: 'amountToken', type: 'uint256' },
                    { name: 'amountETH', type: 'uint256' },
                    { name: 'liquidity', type: 'uint256' },
                  ],
                },
              ],
              functionName: 'addLiquidityETH',
              args: [
                tokenA as Address, // ERC20 token
                amountADesired, // Token amount
                amountAMin, // Min token
                amountBMin, // Min ETH
                account,
                BigInt(Math.floor(Date.now() / 1000) + 1200),
              ],
              account,
              value: amountBDesired, // ETH value
            })
            .then(({ request }) => {
              return sdk?.walletClient?.writeContract(request)
            })
            .then(() => {
              const id = toast.show({
                color: 'positive',
                title: 'Position created',
                text: 'You have successfully added liquidity.',
                actionsSlot: (
                  <Button onClick={() => toast.hide(id)} variant="ghost">
                    <Icon svg={X} />
                  </Button>
                ),
              })
            })
        }
      } else {
        await addLiquidity(
          {
            tokenA: tokenA,
            tokenB: tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            to: account,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
          },
          {
            onSuccess: () => {
              const id = toast.show({
                color: 'positive',
                title: 'Position created',
                text: 'You have successfully added liquidity.',
                actionsSlot: (
                  <Button onClick={() => toast.hide(id)} variant="ghost">
                    <Icon svg={X} />
                  </Button>
                ),
              })
            },
          }
        )
      }

      setAmountA('')
      setAmountB('')
      setActiveStep(0)
    } catch (err: any) {
      console.error('Add liquidity error:', err.message)
      setError(err.message || 'Failed to add liquidity')
    } finally {
      setIsProcessing(false)
    }
  }

  // Use manual approval check instead of relying on the hook's isApproved
  const isApprovalNeeded = useMemo(() => {
    // Check if either token needs approval based on our manual checks
    if (!amountA || !amountB) return false

    // If either token is native KUB, it doesn't need approval
    if (tokenA === zeroAddress) {
      // Only check token B (if it's not native)
      if (tokenB === zeroAddress) return false
      return !manualApprovalCheck.tokenB
    } else if (tokenB === zeroAddress) {
      // Only check token A
      return !manualApprovalCheck.tokenA
    } else {
      // Check both tokens
      return !manualApprovalCheck.tokenA || !manualApprovalCheck.tokenB
    }
  }, [
    tokenA,
    tokenB,
    amountA,
    amountB,
    manualApprovalCheck.tokenA,
    manualApprovalCheck.tokenB,
  ])

  const isCreatingNewPair = useMemo(() => {
    if (!pairExists) return false
    return pairExists.canCreate
  }, [pairExists])

  const isValid = useMemo(() => {
    if (!amountA || !amountB || !tokenA || !tokenB) return false

    try {
      const tokenADecimals = tokenA === zeroAddress ? 18 : tokenAInfo?.decimals || 18
      const tokenBDecimals = tokenB === zeroAddress ? 18 : tokenBInfo?.decimals || 18

      const amountABigInt = parseUnits(amountA, tokenADecimals)
      const amountBBigInt = parseUnits(amountB, tokenBDecimals)

      // Add gas buffer for native KUB to ensure enough for transaction
      const gasBuffer = parseUnits('0.01', 18)

      const hasEnoughTokenA =
        tokenA === zeroAddress
          ? amountABigInt + gasBuffer <= (kubBalance?.value || BigInt(0))
          : amountABigInt <= (tokenABalance || BigInt(0))

      const hasEnoughTokenB =
        tokenB === zeroAddress
          ? amountBBigInt + gasBuffer <= (kubBalance?.value || BigInt(0))
          : amountBBigInt <= (tokenBBalance || BigInt(0))

      // Both tokens should be valid and have adequate balance
      return (
        hasEnoughTokenA &&
        hasEnoughTokenB &&
        (!!tokenAInfo || tokenA === zeroAddress) &&
        (!!tokenBInfo || tokenB === zeroAddress)
      )
    } catch (err) {
      return false
    }
  }, [
    tokenA,
    tokenB,
    amountA,
    amountB,
    tokenAInfo,
    tokenBInfo,
    tokenABalance,
    tokenBBalance,
    kubBalance,
  ])

  const handleNext = () => {
    if (isNativeAndWrappedPair) {
      setError('KUB and KKUB pairs are not allowed. Please select different tokens.')
      return
    }

    setActiveStep((prev) => Math.min(1, prev + 1))
  }

  const handleBack = () => {
    setActiveStep((prev) => Math.max(0, prev - 1))
  }

  const isNativeAndWrappedPair = useMemo(() => {
    if (!tokenA || !tokenB) return false

    // Check if one token is native KUB and the other is KKUB
    const isTokenANative = tokenA === zeroAddress
    const isTokenBNative = tokenB === zeroAddress

    const isTokenAKKUB = tokenA === TOKENS.KKUB
    const isTokenBKKUB = tokenB === TOKENS.KKUB

    // Return true if we have a native KUB + KKUB pair
    return (isTokenANative && isTokenBKKUB) || (isTokenBNative && isTokenAKKUB)
  }, [tokenA, tokenB, TOKENS.KKUB])

  const renderTokenSelect = () => (
    <View gap={4} padding={6} borderColor="neutral-faded" borderRadius="large">
      <View>
        <Text variant="body-1">Select Pair</Text>
        <Text variant="body-3" color="neutral-faded">
          Choose the tokens you want to provide liquidity for.
        </Text>
      </View>
      <View direction="row" gap={4}>
        <View.Item columns={{ s: 12, m: 6 }}>
          <View gap={4}>
            <TokenSelector
              onSelectToken={setTokenA}
              tokenAddress={tokenA}
              otherSelectedToken={tokenB}
            />
          </View>
        </View.Item>
        <View.Item columns={{ s: 12, m: 6 }}>
          <View gap={4}>
            <TokenSelector
              onSelectToken={setTokenB}
              tokenAddress={tokenB}
              otherSelectedToken={tokenA}
              disabled={!tokenA || !tokenB || isNativeAndWrappedPair}
            />
          </View>
        </View.Item>
      </View>

      {tokenA && tokenB && tokenA.toLowerCase() === tokenB.toLowerCase() && (
        <View
          backgroundColor="critical-faded"
          padding={3}
          borderRadius="medium"
          direction="row"
          align="center"
          gap={2}
        >
          <Icon svg={Warning} color="critical" size={5} />
          <Text color="critical">Cannot create a pair with identical tokens</Text>
        </View>
      )}

      <Button
        fullWidth
        disabled={!tokenA || !tokenB || tokenA.toLowerCase() === tokenB.toLowerCase()}
        onClick={handleNext}
        color="primary"
        size="large"
        rounded={true}
      >
        Continue
      </Button>
    </View>
  )

  const renderAmountInputs = () => (
    <View direction="column" gap={8}>
      <View
        direction="row"
        justify="space-between"
        borderColor="neutral-faded"
        borderRadius="large"
        padding={6}
        gap={4}
      >
        <View>
          <TokenPair tokenAddressA={tokenA} tokenAddressB={tokenB} />
        </View>
        <View>
          <Button onClick={handleBack}>
            <Icon svg={NotePencil} size={5} />
            Edit
          </Button>
        </View>
      </View>

      <View gap={4}>
        <View>
          <Text variant="body-1">Deposit tokens</Text>
          <Text variant="body-3" color="neutral-faded">
            Specify the token amounts for your liquidity contribution.
          </Text>
        </View>

        <View direction="column" gap={1}>
          <View
            gap={2}
            padding={4}
            paddingTop={6}
            paddingBottom={6}
            borderRadius="large"
            borderColor="neutral-faded"
            align="start"
          >
            <View direction="row" gap={8} wrap={false}>
              <View grow={true} align="center">
                <input
                  value={amountA}
                  onChange={(e) => handleAmountAInput(e.target.value)}
                  placeholder="0"
                  className="flex w-full h-full text-4xl bg-[rgba(0,0,0,0)] focus:outline-0"
                />
              </View>

              <TokenSelector
                onSelectToken={setTokenA}
                tokenAddress={tokenA}
                disabled={true}
              />
            </View>
            <View>
              {tokenA === zeroAddress
                ? kubBalance && (
                    <View direction="row" align="center" justify="end" gap={2}>
                      <Text color="neutral-faded" variant="body-3" maxLines={1}>
                        {formatNumber(roundDecimal(formatUnits(kubBalance.value, 18), 6))}{' '}
                        KUB
                      </Text>
                      {kubBalance.value > BigInt(0) && (
                        <Actionable
                          onClick={() => {
                            // Leave some for gas
                            const gasBuffer = parseUnits('0.01', 18)
                            if (kubBalance.value > gasBuffer) {
                              const maxAmount = kubBalance.value - gasBuffer
                              setAmountA(formatUnits(maxAmount, 18))
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
                  )
                : tokenABalance &&
                  tokenAInfo && (
                    <View direction="row" align="center" justify="end" gap={2}>
                      <Text color="neutral-faded" variant="body-3" maxLines={1}>
                        {formatNumber(
                          roundDecimal(formatUnits(tokenABalance, tokenAInfo.decimals), 6)
                        )}{' '}
                        {tokenAInfo.symbol}
                      </Text>
                      {tokenABalance > BigInt(0) && (
                        <Actionable
                          onClick={() => {
                            if (tokenAInfo) {
                              setAmountA(formatUnits(tokenABalance, tokenAInfo.decimals))
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
          <View
            gap={2}
            padding={4}
            paddingTop={6}
            paddingBottom={6}
            borderRadius="large"
            backgroundColor="elevation-base"
            align="start"
          >
            <View direction="row" gap={8} wrap={false}>
              <View grow={true} align="center">
                <input
                  value={amountB}
                  onChange={(e) => handleAmountBInput(e.target.value)}
                  placeholder="0"
                  className="flex w-full h-full text-4xl bg-[rgba(0,0,0,0)] focus:outline-0"
                />
              </View>

              <TokenSelector
                onSelectToken={setTokenB}
                tokenAddress={tokenB}
                disabled={true}
              />
            </View>
            <View>
              {tokenB === zeroAddress
                ? kubBalance && (
                    <View direction="row" align="center" justify="end" gap={2}>
                      <Text color="neutral-faded" variant="body-3" maxLines={1}>
                        {formatNumber(roundDecimal(formatUnits(kubBalance.value, 18), 6))}{' '}
                        KUB
                      </Text>
                      {kubBalance.value > BigInt(0) && (
                        <Actionable
                          onClick={() => {
                            // Leave some for gas
                            const gasBuffer = parseUnits('0.01', 18)
                            if (kubBalance.value > gasBuffer) {
                              const maxAmount = kubBalance.value - gasBuffer
                              setAmountB(formatUnits(maxAmount, 18))
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
                  )
                : tokenBBalance &&
                  tokenBInfo && (
                    <View direction="row" align="center" justify="end" gap={2}>
                      <Text color="neutral-faded" variant="body-3" maxLines={1}>
                        {formatNumber(
                          roundDecimal(formatUnits(tokenBBalance, tokenBInfo.decimals), 6)
                        )}{' '}
                        {tokenBInfo.symbol}
                      </Text>
                      {tokenBBalance > BigInt(0) && (
                        <Actionable
                          onClick={() => {
                            if (tokenBInfo) {
                              setAmountB(formatUnits(tokenBBalance, tokenBInfo.decimals))
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
        </View>
      </View>

      {isCreatingNewPair && (
        <View
          backgroundColor="primary-faded"
          padding={4}
          borderRadius="large"
          direction="row"
          align="center"
          gap={2}
        >
          <Icon svg={Warning} color="primary" size={5} />
          <View>
            <Text weight="medium">Creating a new liquidity pool</Text>
            <Text variant="body-3" color="neutral-faded">
              You'll be the first liquidity provider for this pair. The ratio of tokens
              you add will set the initial price.
            </Text>
          </View>
        </View>
      )}

      {!account ? (
        //@ts-ignore
        <Button fullWidth color="primary" size="large" rounded={true} onClick={login}>
          Connect Wallet
        </Button>
      ) : isPairCheckLoading || isPairInfoLoading ? (
        <Button fullWidth loading color="primary" size="large" rounded={true}>
          Loading Pair Data...
        </Button>
      ) : !isValid ? (
        <Button fullWidth disabled color="primary" size="large" rounded={true}>
          {!amountA || !amountB ? 'Enter Amounts' : 'Insufficient Balance'}
        </Button>
      ) : isApprovalNeeded ? (
        isProcessing || approveA.isPending || approveB.isPending ? (
          <Button fullWidth loading color="primary" size="large" rounded={true}>
            Approving Tokens...
          </Button>
        ) : (
          <Button
            fullWidth
            onClick={handleApproval}
            color="primary"
            size="large"
            rounded={true}
          >
            Approve Tokens
          </Button>
        )
      ) : (
        <Button
          fullWidth={true}
          disabled={!isValid || isAddingLiquidity || isProcessing}
          loading={isAddingLiquidity || isProcessing}
          onClick={handleAddLiquidity}
          color="primary"
          size="large"
          rounded={true}
        >
          {isCreatingNewPair ? 'Create Pair & Add Liquidity' : 'Add Liquidity'}
        </Button>
      )}
    </View>
  )

  return (
    <View width="100%" maxWidth="980px" gap={8}>
      <View direction="row" justify="space-between">
        <View direction="row" align="center" gap={2}>
          <Text variant="title-6" weight="regular">
            New Position
          </Text>
          {isCreatingNewPair && tokenA && tokenB && (
            <Badge color="primary">New Pool</Badge>
          )}
        </View>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            {(attributes) => (
              <Button
                variant="outline"
                attributes={{ ...attributes, style: { borderRadius: '12px' } }}
              >
                <Icon size={5} svg={GearSix} />
              </Button>
            )}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <View gap={2}>
              <Text>Slippage Tolerance</Text>
              <View direction="row" gap={2}>
                {[0.1, 0.5, 1.0].map((value) => (
                  <Button
                    key={value}
                    variant={slippage === value ? 'outline' : 'ghost'}
                    onClick={() => setSlippage(value)}
                  >
                    {value}%
                  </Button>
                ))}
              </View>
            </View>
          </DropdownMenu.Content>
        </DropdownMenu>
      </View>

      <View direction="row" gap={16}>
        <View.Item columns={{ s: 12, l: 5 }}>
          <View gap={8}>
            <View borderColor="neutral-faded" borderRadius="large" padding={6}>
              <View gap={6}>
                <Stepper
                  activeId={activeStep}
                  direction="column"
                  attributes={{ style: { gap: 32 } }}
                >
                  <Stepper.Item
                    title="Step 1"
                    subtitle="Select token pair"
                    completed={activeStep > 0}
                  />

                  <Stepper.Item
                    title="Step 2"
                    subtitle={
                      isCreatingNewPair
                        ? 'Set initial pool ratio'
                        : 'Enter deposit amounts'
                    }
                  />
                </Stepper>
              </View>
            </View>
          </View>
        </View.Item>
        <View.Item columns={{ s: 12, l: 7 }}>
          {activeStep === 0 && renderTokenSelect()}
          {activeStep === 1 && renderAmountInputs()}
        </View.Item>
      </View>
    </View>
  )
}

export default AddLiquidityStepper
