import React, { useState, useEffect, useMemo } from 'react'
import {
  Stepper,
  View,
  Text,
  Button,
  Icon,
  DropdownMenu,
  Actionable,
  useToast,
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
import TokenSelector from '@/src/app/components/TokenSelector'
import { GearSix, NotePencil, X } from '@phosphor-icons/react'
import { TokenPair } from '@/src/app/components/TokenPair'
import { formatNumber, roundDecimal } from '@/src/app/utils/numbers'
import { useQuery } from '@tanstack/react-query'

interface AddLiquidityStepperProps {
  defaultTokenA?: Address
  defaultTokenB?: Address
}

// Hardcoded token list
const TOKENS = {
  KKUB: '0xBa71efd94be63bD47B78eF458DE982fE29f552f7' as Address,
  KUB: zeroAddress as Address,
}

const AddLiquidityStepper = ({
  defaultTokenA,
  defaultTokenB = zeroAddress,
}: AddLiquidityStepperProps) => {
  const sdk = usePonderSDK()
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
  }, [error])

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
  const { data: pairExists } = usePairExists(pairTokenA, pairTokenB)
  const { data: pairInfo } = usePairInfo(pairExists?.pairAddress as Address)

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

  // Handle token approval
  const handleApproval = async () => {
    if (!account || !sdk?.router?.address) return

    try {
      setError('')
      setIsProcessing(true)

      // Approve tokenA if it's an ERC20 and needs approval
      if (tokenA !== zeroAddress && tokenAInfo && amountA) {
        const amountADesired = parseUnits(amountA, tokenAInfo.decimals)

        if (!isApprovedA(amountADesired)) {
          console.log(
            `Approving ${tokenAInfo.symbol} (${tokenA}) for amount ${amountADesired}`
          )

          await approveA.mutateAsync({
            token: tokenA as Address,
            spender: sdk.router.address,
            amount: amountADesired,
          })
        }
      }

      // Approve tokenB if it's an ERC20 and needs approval
      if (tokenB !== zeroAddress && tokenBInfo && amountB) {
        const amountBDesired = parseUnits(amountB, tokenBInfo.decimals)

        if (!isApprovedB(amountBDesired)) {
          console.log(
            `Approving ${tokenBInfo.symbol} (${tokenB}) for amount ${amountBDesired}`
          )

          await approveB.mutateAsync({
            token: tokenB as Address,
            spender: sdk.router.address,
            amount: amountBDesired,
          })
        }
      }
    } catch (err: any) {
      // console.error('Approval error:', err)
      setError(err.message || 'Failed to approve token')
    } finally {
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

      if (
        BigInt(pairInfo.reserve0) === BigInt(0) &&
        BigInt(pairInfo.reserve1) === BigInt(0)
      ) {
        setAmountB(amountA)
        return
      }

      const isToken0 = pairTokenA.toLowerCase() === pairInfo.token0.toLowerCase()
      const reserveIn = isToken0 ? BigInt(pairInfo.reserve0) : BigInt(pairInfo.reserve1)
      const reserveOut = isToken0 ? BigInt(pairInfo.reserve1) : BigInt(pairInfo.reserve0)

      const amountBBigInt = (amountABigInt * reserveOut) / reserveIn
      const tokenBDecimals = tokenB === zeroAddress ? 18 : tokenBInfo?.decimals || 18
      const formattedAmount = formatUnits(amountBBigInt, tokenBDecimals)

      setAmountB(formattedAmount)
    } catch (err) {
      // console.error('Error calculating amount B:', err)
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

      // Check ERC20 token approvals
      if (tokenA !== zeroAddress && !isApprovedA(amountADesired)) {
        setError(`${tokenAInfo?.symbol || 'Token A'} approval required`)
        setIsProcessing(false)
        return
      }

      if (tokenB !== zeroAddress && !isApprovedB(amountBDesired)) {
        setError(`${tokenBInfo?.symbol || 'Token B'} approval required`)
        setIsProcessing(false)
        return
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
                text: 'You have succesfully added liquidity.',
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
      // console.error('Add liquidity error:', err.message)
      setError('Failed to add liquidity')
    } finally {
      setIsProcessing(false)
    }
  }

  const isApprovalNeeded = useMemo(() => {
    // Check if either token needs approval
    if (!amountA || !amountB) return false

    try {
      let needsApproval = false

      // Check first token if it's not native KUB
      if (tokenA !== zeroAddress && tokenAInfo) {
        const amountABigInt = parseUnits(amountA, tokenAInfo.decimals)
        if (!isApprovedA(amountABigInt)) {
          needsApproval = true
        }
      }

      // Check second token if it's not native KUB
      if (tokenB !== zeroAddress && tokenBInfo && !needsApproval) {
        const amountBBigInt = parseUnits(amountB, tokenBInfo.decimals)
        if (!isApprovedB(amountBBigInt)) {
          needsApproval = true
        }
      }

      return needsApproval
    } catch (err) {
      // console.error('Error checking approval status:', err)
      return false
    }
  }, [tokenA, tokenB, tokenAInfo, tokenBInfo, amountA, amountB, isApprovedA, isApprovedB])

  const isValid = useMemo(() => {
    if (!amountA || !amountB || !tokenA || !tokenB) return false

    try {
      const tokenADecimals = tokenA === zeroAddress ? 18 : tokenAInfo?.decimals || 18
      const tokenBDecimals = tokenB === zeroAddress ? 18 : tokenBInfo?.decimals || 18

      const amountABigInt = parseUnits(amountA, tokenADecimals)
      const amountBBigInt = parseUnits(amountB, tokenBDecimals)

      const hasEnoughTokenA =
        tokenA === zeroAddress
          ? amountABigInt <= (kubBalance?.value || BigInt(0))
          : amountABigInt <= (tokenABalance || BigInt(0))

      const hasEnoughTokenB =
        tokenB === zeroAddress
          ? amountBBigInt <= (kubBalance?.value || BigInt(0))
          : amountBBigInt <= (tokenBBalance || BigInt(0))

      return hasEnoughTokenA && hasEnoughTokenB
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
    setActiveStep((prev) => Math.min(1, prev + 1))
  }

  const handleBack = () => {
    setActiveStep((prev) => Math.max(0, prev - 1))
  }

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
            <TokenSelector onSelectToken={setTokenA} tokenAddress={tokenA} />
          </View>
        </View.Item>
        <View.Item columns={{ s: 12, m: 6 }}>
          <View gap={4}>
            <TokenSelector onSelectToken={setTokenB} tokenAddress={tokenB} />
          </View>
        </View.Item>
      </View>
      <Button
        fullWidth
        disabled={!tokenA || !tokenB}
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

      {pairExists?.canCreate && (
        <Text variant="caption-1" color="neutral-faded">
          You are creating a new liquidity pool
        </Text>
      )}

      {!account ? (
        <Button fullWidth color="primary" size="large" rounded={true}>
          Connect Wallet
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
          Create Position
        </Button>
      )}
    </View>
  )

  return (
    <View width="100%" maxWidth="980px" gap={8}>
      <View direction="row" justify="space-between">
        <Text variant="title-6" weight="regular">
          New Position
        </Text>
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

                  <Stepper.Item title="Step 2" subtitle="Enter deposit amounts" />
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
