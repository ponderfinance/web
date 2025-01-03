import React, { useState, useEffect, useMemo } from 'react'
import { Stepper, View, Text, Card, Button, Modal } from 'reshaped'
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

interface AddLiquidityStepperProps {
  defaultTokenA?: Address
  defaultTokenB?: Address
}

// Hardcoded token list
const TOKENS = {
  KKUB: '0xBa71efd94be63bD47B78eF458DE982fE29f552f7' as Address,
  KUB: zeroAddress as Address,
  WESTSIDE: '0xc3D83117DB2F88Ff0f272b4AdB05E99B1E128E9d' as Address,
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

      // Format with proper decimals (18 for ETH)
      const formattedAmount = formatUnits(amountBBigInt, 18)
      console.log('Calculated amount B:', formattedAmount)

      setAmountB(formattedAmount)
    } catch (err) {
      console.error('Error calculating amount B:', err)
      setAmountB('')
    }
  }, [amountA, tokenA, tokenB, pairInfo, tokenAInfo])

  // Input handlers with decimal validation
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

    // ETH always has 18 decimals
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

      // Parse input amounts with correct decimals
      const amountADesired = parseUnits(amountA, tokenAInfo.decimals)
      const amountBDesired = parseUnits(amountB, 18) // ETH/WETH always has 18 decimals

      if (!validateAmounts(amountADesired, amountBDesired)) {
        return
      }

      // Calculate minimum amounts with slippage
      const slippageBps = BigInt(Math.round(slippage * 100))
      const slippageMultiplier = BigInt(10000) - slippageBps

      const amountAMin = (amountADesired * slippageMultiplier) / BigInt(10000)
      const amountBMin = (amountBDesired * slippageMultiplier) / BigInt(10000)

      // Debug log the values
      console.log('Add Liquidity Parameters:', {
        tokenA,
        isKUBPair,
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        amountAMin: amountAMin.toString(),
        amountBMin: amountBMin.toString(),
        slippage: slippage.toString(),
      })

      // Handle token approval if needed
      if (!isApprovedA(amountADesired)) {
        try {
          await approveA.mutateAsync({
            token: tokenA,
            spender: sdk?.router?.address as Address,
            amount: amountADesired,
          })
        } catch (err: any) {
          if (err.message !== 'Already approved') {
            throw err
          }
        }
      }

      // For ETH pairs, we need to handle the order differently
      if (isKUBPair) {
        const result = await addLiquidity({
          tokenA: tokenA, // The non-ETH token
          tokenB: TOKENS.KKUB, // This will be converted to WETH
          amountADesired: amountADesired, // Token amount
          amountBDesired: amountBDesired, // ETH amount
          amountAMin: amountAMin, // Min token amount
          amountBMin: amountBMin, // Min ETH amount
          to: account,
          deadline: BigInt(Math.floor(Date.now() / 1200)),
        })

        console.log('Transaction result:', result)
      } else {
        const result = await addLiquidity({
          tokenA,
          tokenB: tokenB as Address,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          to: account,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        })

        console.log('Transaction result:', result)
      }

      setAmountA('')
      setAmountB('')
      setActiveStep(0)
    } catch (err: any) {
      console.error('Add liquidity error:', err)
      setError(err.message || 'Failed to add liquidity')
    }
  }

  // Validation
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
  }, [
    tokenAInfo,
    tokenBInfo,
    amountA,
    amountB,
    tokenABalance,
    tokenBBalance,
    kubBalance,
    isKUBPair,
  ])

  const handleNext = () => {
    setActiveStep((prev) => Math.min(1, prev + 1))
  }

  const handleBack = () => {
    setActiveStep((prev) => Math.max(0, prev - 1))
  }

  const renderTokenSelect = () => (
    <View gap={4} className="mt-4">
      <View gap={4}>
        <Text>Token A</Text>
        <View
          direction="row"
          gap={2}
          justify="space-between"
          className="p-4 border rounded"
        >
          {tokenAInfo ? (
            <View direction="row" justify="space-between" className="w-full">
              <Text>{tokenAInfo.symbol}</Text>
              {tokenABalance && (
                <Text>Balance: {formatUnits(tokenABalance, tokenAInfo.decimals)}</Text>
              )}
            </View>
          ) : (
            <Button onClick={() => setIsSelectingTokenA(true)}>Select Token</Button>
          )}
        </View>
      </View>

      <View gap={4}>
        <Text>Token B</Text>
        <View
          direction="row"
          gap={2}
          justify="space-between"
          className="p-4 border rounded"
        >
          {isKUBPair ? (
            <View direction="row" justify="space-between" className="w-full">
              <Text>KUB</Text>
              {kubBalance && (
                <Text>Balance: {formatUnits(kubBalance.value, 18)} KUB</Text>
              )}
            </View>
          ) : tokenBInfo ? (
            <View direction="row" justify="space-between" className="w-full">
              <Text>{tokenBInfo.symbol}</Text>
              {tokenBBalance && tokenBInfo && (
                <Text>Balance: {formatUnits(tokenBBalance, tokenBInfo.decimals)}</Text>
              )}
            </View>
          ) : (
            <Button onClick={() => setIsSelectingTokenB(true)}>Select Token</Button>
          )}
        </View>
      </View>

      <Button fullWidth disabled={!tokenA || !tokenB} onClick={handleNext}>
        Next
      </Button>
    </View>
  )

  const renderAmountInputs = () => (
    <View gap={4} className="mt-4">
      <View gap={2}>
        <View direction="row" justify="space-between">
          <Text>{tokenAInfo?.symbol || 'Token A'}</Text>
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
          <Text>{isKUBPair ? 'KUB' : tokenBInfo?.symbol || 'Token B'}</Text>
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
          <Text>
            1 {tokenAInfo?.symbol} ={' '}
            {formatUnits(
              (BigInt(pairInfo.reserve1) * BigInt(10 ** (tokenAInfo?.decimals || 18))) /
                BigInt(pairInfo.reserve0),
              isKUBPair ? 18 : tokenBInfo?.decimals || 18
            )}{' '}
            {isKUBPair ? 'KUB' : tokenBInfo?.symbol}
          </Text>
        </View>
      )}

      {pairExists?.canCreate && (
        <Text variant="caption-1" color="neutral-faded">
          You are creating a new liquidity pool
        </Text>
      )}

      {error && <Text color="critical">{error}</Text>}

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

      <View direction="row" gap={2}>
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        {!account ? (
          <Button fullWidth>Connect Wallet</Button>
        ) : !isValid ? (
          <Button fullWidth disabled>
            {!amountA || !amountB ? 'Enter Amounts' : 'Insufficient Balance'}
          </Button>
        ) : approveA.isPending ? (
          <Button fullWidth loading>
            Approving {tokenAInfo?.symbol}...
          </Button>
        ) : !isApprovedA(parseUnits(amountA, tokenAInfo?.decimals || 18)) ? (
          <Button fullWidth onClick={() => handleAddLiquidity()}>
            Approve {tokenAInfo?.symbol}
          </Button>
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

  // Token Selector Modal
  const TokenSelector = ({
    open,
    onClose,
    onSelect,
    excludeToken,
  }: {
    open: boolean
    onClose: () => void
    onSelect: (token: Address) => void
    excludeToken?: Address
  }) => {
    const tokenList = [
      { address: TOKENS.WESTSIDE, symbol: 'WESTSIDE', name: 'Westside Token' },
      { address: TOKENS.KKUB, symbol: 'KKUB', name: 'Wrapped KUB' },
      { address: TOKENS.KUB, symbol: 'KUB', name: 'KUB' },
    ].filter((token) => token.address !== excludeToken)

    return (
      <Modal active={open} onClose={onClose}>
        <View gap={4} padding={4}>
          <Text variant="title-3">Select a Token</Text>

          <View gap={2} className="max-h-96 overflow-y-auto">
            {tokenList.map((token) => (
              <Button
                key={token.address}
                variant="outline"
                fullWidth
                onClick={() => {
                  onSelect(token.address as Address)
                  onClose()
                }}
              >
                <View direction="row" justify="space-between" className="w-full">
                  <Text>{token.symbol}</Text>
                  <Text>{token.name}</Text>
                </View>
              </Button>
            ))}
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <View className="w-full max-w-2xl mx-auto">
      <Card className="w-full p-6">
        <View gap={6}>
          <Text variant="title-3">Add Liquidity</Text>

          <Stepper activeId={activeStep} direction="column">
            <Stepper.Item
              title="Select Pair"
              subtitle="Choose tokens to provide liquidity"
              completed={activeStep > 0}
            >
              {activeStep === 0 && renderTokenSelect()}
            </Stepper.Item>

            <Stepper.Item title="Add Liquidity" subtitle="Enter the amounts and confirm">
              {activeStep === 1 && renderAmountInputs()}
            </Stepper.Item>
          </Stepper>
        </View>
      </Card>

      <TokenSelector
        open={isSelectingTokenA}
        onClose={() => setIsSelectingTokenA(false)}
        onSelect={(token) => setTokenA(token)}
        excludeToken={tokenB}
      />

      <TokenSelector
        open={isSelectingTokenB}
        onClose={() => setIsSelectingTokenB(false)}
        onSelect={(token) => setTokenB(token)}
        excludeToken={tokenA}
      />
    </View>
  )
}

export default AddLiquidityStepper
