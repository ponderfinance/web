import React, { useState, useEffect, useMemo } from 'react'
import { Stepper, View, Text, Card, Button, Modal, Icon } from 'reshaped'
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
import { GearSix } from '@phosphor-icons/react'

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
  const [isSelectingTokenA, setIsSelectingTokenA] = useState(false)
  const [isSelectingTokenB, setIsSelectingTokenB] = useState(false)

  // Form state
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [slippage, setSlippage] = useState(1.0) // 1% default
  const [error, setError] = useState<string>('')

  const isKUBPair = tokenB === zeroAddress

  // SDK Hooks for tokens
  const { data: tokenAInfo } = useTokenInfo(tokenA as Address)
  const { data: tokenBInfo } = useTokenInfo(
    isKUBPair ? (null as unknown as Address) : (tokenB as Address)
  )
  const { data: tokenABalance } = useTokenBalance(tokenA as Address, account as Address)
  const { data: tokenBBalance } = useTokenBalance(
    isKUBPair ? (null as unknown as Address) : (tokenB as Address),
    account as Address
  )

  // Token approval hooks
  const {
    allowance: allowanceA,
    approve: approveA,
    isApproved: isApprovedA,
  } = useTokenApproval(tokenA, sdk?.router?.address)

  // Get native KUB balance if needed
  const { data: kubBalance } = useBalance({
    address: account,
  })

  // For pair existence check, use KKUB address if it's a native pair
  const pairTokenB = isKUBPair ? TOKENS.KKUB : (tokenB as Address)
  const { data: pairExists } = usePairExists(tokenA as Address, pairTokenB)
  const { data: pairInfo } = usePairInfo(pairExists?.pairAddress as Address)

  // Add liquidity mutation
  const { mutateAsync: addLiquidity, isPending: isAddingLiquidity } = useAddLiquidity()

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
    if (!account || !tokenA || !sdk?.router?.address || !tokenAInfo) return

    try {
      setError('')
      const amountADesired = parseUnits(amountA, tokenAInfo.decimals)

      console.log('Approving token:', {
        token: tokenA,
        spender: sdk.router.address,
        amount: amountADesired.toString(),
      })

      await approveA.mutateAsync({
        token: tokenA,
        spender: sdk.router.address,
        amount: amountADesired,
      })
    } catch (err: any) {
      console.error('Approval error:', err)
      setError(err.message || 'Failed to approve token')
    }
  }

  // Auto-calculate amount B based on amount A and reserves
  useEffect(() => {
    if (!amountA || !tokenAInfo || !pairInfo) {
      setAmountB('')
      return
    }

    try {
      const amountABigInt = parseUnits(amountA, tokenAInfo.decimals)

      if (
        BigInt(pairInfo.reserve0) === BigInt(0) &&
        BigInt(pairInfo.reserve1) === BigInt(0)
      ) {
        setAmountB(amountA)
        return
      }

      const isToken0 = tokenA?.toLowerCase() === pairInfo.token0.toLowerCase()
      const reserveIn = isToken0 ? BigInt(pairInfo.reserve0) : BigInt(pairInfo.reserve1)
      const reserveOut = isToken0 ? BigInt(pairInfo.reserve1) : BigInt(pairInfo.reserve0)

      const amountBBigInt = (amountABigInt * reserveOut) / reserveIn
      const formattedAmount = formatUnits(amountBBigInt, 18)
      console.log('Calculated amount B:', formattedAmount)

      setAmountB(formattedAmount)
    } catch (err) {
      console.error('Error calculating amount B:', err)
      setAmountB('')
    }
  }, [amountA, tokenA, tokenB, pairInfo, tokenAInfo])

  const handleAmountAInput = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return

    const parts = value.split('.')
    if (parts.length > 1) {
      const decimals = tokenAInfo?.decimals || 18
      if (parts[1].length > decimals) return
    }

    try {
      if (value !== '') {
        parseUnits(value, tokenAInfo?.decimals || 18)
      }
      setAmountA(value)
    } catch (err) {
      console.error('Invalid amount:', err)
    }
  }

  const handleAmountBInput = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return

    const parts = value.split('.')
    if (parts.length > 1 && parts[1].length > 18) return

    try {
      if (value !== '') {
        parseUnits(value, 18)
      }
      setAmountB(value)
    } catch (err) {
      console.error('Invalid amount:', err)
    }
  }

  const handleAddLiquidity = async () => {
    if (!account || !tokenAInfo || !tokenA || !tokenB) return

    try {
      setError('')
      const amountADesired = parseUnits(amountA, tokenAInfo.decimals)
      const amountBDesired = parseUnits(amountB, 18)

      if (!validateAmounts(amountADesired, amountBDesired)) return

      const slippageBps = BigInt(Math.round(slippage * 100))
      const slippageMultiplier = BigInt(10000) - slippageBps

      const amountAMin = (amountADesired * slippageMultiplier) / BigInt(10000)
      const amountBMin = (amountBDesired * slippageMultiplier) / BigInt(10000)

      console.log('Add Liquidity Parameters:', {
        tokenA,
        isKUBPair,
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        amountAMin: amountAMin.toString(),
        amountBMin: amountBMin.toString(),
        slippage: slippage.toString(),
      })

      // Check if approval is needed before proceeding
      if (!isApprovedA(amountADesired)) {
        setError('Token approval required before adding liquidity')
        return
      }

      if (isKUBPair) {
        await addLiquidity({
          tokenA: tokenA,
          tokenB: TOKENS.KKUB,
          amountADesired: amountADesired,
          amountBDesired: amountBDesired,
          amountAMin: amountAMin,
          amountBMin: amountBMin,
          to: account,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        })
      } else {
        await addLiquidity({
          tokenA,
          tokenB: tokenB as Address,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          to: account,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        })
      }

      setAmountA('')
      setAmountB('')
      setActiveStep(0)
    } catch (err: any) {
      console.error('Add liquidity error:', err)
      setError(err.message || 'Failed to add liquidity')
    }
  }

  const isApprovalNeeded = useMemo(() => {
    if (!tokenAInfo || !amountA) return false
    try {
      const amountABigInt = parseUnits(amountA, tokenAInfo.decimals)
      return !isApprovedA(amountABigInt)
    } catch (err) {
      return false
    }
  }, [tokenAInfo, amountA, isApprovedA])

  const isValid = useMemo(() => {
    if (!tokenAInfo || !amountA || !amountB) return false

    try {
      const amountABigInt = parseUnits(amountA, tokenAInfo.decimals)
      const amountBBigInt = parseUnits(amountB, 18)

      if (isKUBPair) {
        return (
          amountABigInt <= (tokenABalance || BigInt(0)) &&
          amountBBigInt <= (kubBalance?.value || BigInt(0))
        )
      } else {
        return (
          amountABigInt <= (tokenABalance || BigInt(0)) &&
          amountBBigInt <= (tokenBBalance || BigInt(0))
        )
      }
    } catch (err) {
      return false
    }
  }, [tokenAInfo, amountA, amountB, tokenABalance, tokenBBalance, kubBalance, isKUBPair])

  const handleNext = () => {
    setActiveStep((prev) => Math.min(1, prev + 1))
  }

  const handleBack = () => {
    setActiveStep((prev) => Math.max(0, prev - 1))
  }

  const renderTokenSelect = () => (
    <View gap={4} padding={4} borderColor="neutral-faded" borderRadius="large">
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
    <View borderColor="neutral-faded" borderRadius="large" padding={4}>
      <View gap={2}>
        <View direction="row" justify="space-between">
          <TokenSelector onSelectToken={setTokenA} tokenAddress={tokenA} />
          {tokenABalance && tokenAInfo && (
            <Text>
              Balance: {formatUnits(tokenABalance, tokenAInfo.decimals)}{' '}
              {tokenAInfo.symbol}
            </Text>
          )}
        </View>
        <input
          value={amountA}
          onChange={(e) => handleAmountAInput(e.target.value)}
          placeholder="0.0"
          className="w-full p-2 border rounded"
        />
      </View>

      <View gap={2}>
        <View direction="row" justify="space-between">
          <TokenSelector onSelectToken={setTokenB} tokenAddress={tokenB} />
          {isKUBPair
            ? kubBalance && <Text>Balance: {formatUnits(kubBalance.value, 18)} KUB</Text>
            : tokenBBalance &&
              tokenBInfo && (
                <Text>
                  Balance: {formatUnits(tokenBBalance, tokenBInfo.decimals)}{' '}
                  {tokenBInfo.symbol}
                </Text>
              )}
        </View>
        <input
          value={amountB}
          onChange={(e) => handleAmountBInput(e.target.value)}
          placeholder="0.0"
          className="w-full p-2 border rounded"
        />
      </View>

      {pairInfo && !pairExists?.canCreate && (
        <View gap={2}>
          <Text>Current Pool Ratio</Text>
          {/*<Text>*/}
          {/*  1 {tokenAInfo?.symbol} ={' '}*/}
          {/*  {formatUnits(*/}
          {/*    (BigInt(pairInfo.reserve1) * BigInt(10 ** (tokenAInfo?.decimals || 18))) /*/}
          {/*      BigInt(pairInfo.reserve0),*/}
          {/*    isKUBPair ? 18 : tokenBInfo?.decimals || 18*/}
          {/*  )}{' '}*/}
          {/*  {isKUBPair ? 'KUB' : tokenBInfo?.symbol}*/}
          {/*</Text>*/}
        </View>
      )}

      {pairExists?.canCreate && (
        <Text variant="caption-1" color="neutral-faded">
          You are creating a new liquidity pool
        </Text>
      )}

      {error && (
        <Text color="critical" className="p-2 bg-red-50 rounded">
          {error}
        </Text>
      )}

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

      <View direction="row" gap={2} className="mt-4">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>

        {!account ? (
          <Button fullWidth>Connect Wallet</Button>
        ) : !isValid ? (
          <Button fullWidth disabled>
            {!amountA || !amountB ? 'Enter Amounts' : 'Insufficient Balance'}
          </Button>
        ) : isApprovalNeeded ? (
          approveA.isPending ? (
            <Button fullWidth loading>
              Approving {tokenAInfo?.symbol}...
            </Button>
          ) : (
            <Button fullWidth onClick={handleApproval}>
              Approve {tokenAInfo?.symbol}
            </Button>
          )
        ) : (
          <Button
            fullWidth
            disabled={!isValid || isAddingLiquidity}
            loading={isAddingLiquidity}
            onClick={handleAddLiquidity}
          >
            {pairExists?.canCreate ? 'Create Pool & Supply' : 'Supply'}
          </Button>
        )}
      </View>
    </View>
  )

  return (
    <View width={{ s: '100%', l: '980px' }} gap={8}>
      <View direction="row" justify="space-between">
        <Text variant="title-6" weight="regular">
          New Position
        </Text>
        <Button variant="outline" attributes={{ style: { borderRadius: '12px' } }}>
          <Icon size={5} svg={GearSix} />
        </Button>
      </View>

      <View direction="row" gap={16}>
        <View.Item columns={{ s: 12, l: 5 }}>
          <View gap={8}>
            <View borderColor="neutral-faded" borderRadius="large" padding={4}>
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
