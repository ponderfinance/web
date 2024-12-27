import { useState, useEffect, useMemo } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { type Address, formatUnits, parseUnits, zeroAddress } from 'viem'
import { useAccount, useBalance } from 'wagmi'
import {
  useTokenBalance,
  useTokenInfo,
  useTokenAllowance,
  usePonderSDK,
  usePairExists,
  usePairInfo,
  useAddLiquidity,
} from '@ponderfinance/sdk'
import { CURRENT_CHAIN } from '@/app/constants/chains'

interface AddLiquidityFormProps {
  defaultTokenA?: Address
  defaultTokenB?: Address
}

export default function AddLiquidityForm({
  defaultTokenA,
  defaultTokenB = zeroAddress,
}: AddLiquidityFormProps) {
  const sdk = usePonderSDK()
  const { address: account } = useAccount()

  // Form state
  const [tokenA, setTokenA] = useState<Address | undefined>(defaultTokenA)
  const [tokenB, setTokenB] = useState<Address | undefined>(defaultTokenB)
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [slippage, setSlippage] = useState(1.0) // 1% default
  const [error, setError] = useState<string>('')
  const [isApprovingA, setIsApprovingA] = useState(false)
  const [isApprovingB, setIsApprovingB] = useState(false)

  // Get KKUB address for current chain
  //TODO: make dependent on chain
  const kkubAddress = '0xBa71efd94be63bD47B78eF458DE982fE29f552f7'

  // Check if we're dealing with a native KUB pair
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
  const { data: tokenAAllowance, refetch: refetchAllowanceA } = useTokenAllowance(
    tokenA as Address,
    sdk?.router?.address as Address,
    account as Address
  )
  const { data: tokenBAllowance, refetch: refetchAllowanceB } = useTokenAllowance(
    isKUBPair ? (null as unknown as Address) : (tokenB as Address),
    sdk?.router?.address as Address,
    account as Address
  )

  // Get native KUB balance if needed
  const { data: kubBalance } = useBalance({
    address: account,
  })

  // For pair existence check, use KKUB address if it's a native pair
  const pairTokenB = isKUBPair ? kkubAddress : (tokenB as Address)
  const { data: pairExists } = usePairExists(tokenA as Address, pairTokenB)
  const { data: pairInfo } = usePairInfo(pairExists?.pairAddress as Address)

  // Add liquidity mutation
  const { mutateAsync: addLiquidity, isPending: isAddingLiquidity } = useAddLiquidity()

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
        // For new pairs, use 1:1 ratio or let user decide
        setAmountB(amountA)
        return
      }

      // Check if tokenA is token0 in the pair
      const isToken0 = tokenA?.toLowerCase() === pairInfo.token0.toLowerCase()
      const reserveIn = isToken0 ? BigInt(pairInfo.reserve0) : BigInt(pairInfo.reserve1)
      const reserveOut = isToken0 ? BigInt(pairInfo.reserve1) : BigInt(pairInfo.reserve0)

      // Calculate optimal amount using the same formula as the router
      const amountBBigInt = (amountABigInt * reserveOut) / reserveIn
      const decimalsB = isKUBPair ? 18 : tokenBInfo?.decimals || 18
      setAmountB(formatUnits(amountBBigInt, decimalsB))
    } catch (err) {
      console.error('Error calculating amount B:', err)
    }
  }, [amountA, tokenA, tokenB, pairInfo, tokenAInfo, tokenBInfo, isKUBPair])

  // Input handlers with decimal validation
  const handleAmountAInput = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return
    const parts = value.split('.')
    if (parts[1] && parts[1].length > (tokenAInfo?.decimals || 18)) return
    setAmountA(value)
  }

  const handleAmountBInput = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return
    const parts = value.split('.')
    if (parts[1] && parts[1].length > (isKUBPair ? 18 : tokenBInfo?.decimals || 18))
      return
    setAmountB(value)
  }

  // Handle token approval
  const handleApproval = async (token: Address, amount: bigint) => {
    if (!sdk?.walletClient?.account || !sdk?.router?.address) return

    try {
      const hash = await sdk.walletClient.writeContract({
        address: token,
        abi: [
          {
            name: 'approve',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
          },
        ],
        functionName: 'approve',
        args: [sdk.router.address, amount],
        chain: CURRENT_CHAIN,
        account: sdk.walletClient.account,
      })

      await sdk.publicClient.waitForTransactionReceipt({ hash })
    } catch (err) {
      console.error('Approval error:', err)
      throw err
    }
  }

  // Handle liquidity addition
  const handleAddLiquidity = async () => {
    if (!account || !tokenAInfo || !tokenA || !tokenB) return

    try {
      setError('')
      const amountADesired = parseUnits(amountA, tokenAInfo.decimals)
      const amountBDesired = parseUnits(
        amountB,
        isKUBPair ? 18 : tokenBInfo?.decimals || 18
      )
      const slippageBps = BigInt(Math.round(slippage * 100))

      // Calculate minimum amounts with slippage tolerance
      const amountAMin = (amountADesired * (BigInt(10000) - slippageBps)) / BigInt(10000)
      const amountBMin = (amountBDesired * (BigInt(10000) - slippageBps)) / BigInt(10000)

      // Handle token approvals
      if (needsApprovalA) {
        setIsApprovingA(true)
        await handleApproval(tokenA, amountADesired)
        await refetchAllowanceA()
        setIsApprovingA(false)
      }

      if (!isKUBPair && needsApprovalB) {
        setIsApprovingB(true)
        await handleApproval(tokenB, amountBDesired)
        await refetchAllowanceB()
        setIsApprovingB(false)
      }

      // Add liquidity
      const result = await addLiquidity({
        tokenA,
        tokenB: isKUBPair ? kkubAddress : tokenB,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        to: account,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
      })

      // Reset form on success
      setAmountA('')
      setAmountB('')
    } catch (err: any) {
      console.error('Add liquidity error:', err)
      setError(err.message || 'Failed to add liquidity')
      throw err
    }
  }

  // Approval checks
  const needsApprovalA = useMemo(() => {
    if (!tokenAInfo || !amountA) return false
    const amountABigInt = parseUnits(amountA, tokenAInfo.decimals)
    const allowanceA = tokenAAllowance?.amount || BigInt(0)
    return amountABigInt > allowanceA
  }, [tokenAInfo, amountA, tokenAAllowance])

  const needsApprovalB = useMemo(() => {
    if (isKUBPair || !tokenBInfo || !amountB) return false
    const amountBBigInt = parseUnits(amountB, tokenBInfo.decimals)
    const allowanceB = tokenBAllowance?.amount || BigInt(0)
    return amountBBigInt > allowanceB
  }, [isKUBPair, tokenBInfo, amountB, tokenBAllowance])

  // Validation
  const isValid = useMemo(() => {
    if (!tokenAInfo || !amountA || !amountB) return false

    const amountABigInt = parseUnits(amountA, tokenAInfo.decimals)
    const amountBBigInt = parseUnits(amountB, isKUBPair ? 18 : tokenBInfo?.decimals || 18)

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

  return (
    <Card>
      <View gap={16} padding={8}>
        <Text variant="title-3">{isKUBPair ? 'Add KUB Liquidity' : 'Add Liquidity'}</Text>

        {pairExists?.canCreate && <Text>This will create a new liquidity pair!</Text>}
        {error && <Text color="critical">{error}</Text>}

        {/* Token A Input */}
        <View gap={4}>
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

        {/* Token B Input */}
        <View gap={4}>
          <View direction="row" justify="space-between">
            <Text>{isKUBPair ? 'KUB' : tokenBInfo?.symbol || 'Token B'}</Text>
            {isKUBPair
              ? kubBalance && (
                  <Text>Balance: {formatUnits(kubBalance.value, 18)} KUB</Text>
                )
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

        {/* Pool Info */}
        {pairInfo && !pairExists?.canCreate && (
          <View gap={2}>
            <Text>Current Pool Ratio</Text>
            <Text>
              1 {tokenAInfo?.symbol} = {/*{formatUnits(*/}
              {/*  (BigInt(pairInfo.reserve1) * BigInt(10 ** (tokenAInfo?.decimals || 18))) /*/}
              {/*    BigInt(pairInfo.reserve0),*/}
              {/*  isKUBPair ? 18 : tokenBInfo?.decimals || 18*/}
              {/*)}{' '}*/}
              {isKUBPair ? 'KUB' : tokenBInfo?.symbol}
            </Text>
          </View>
        )}

        {/* Action Button */}
        {!account ? (
          <Button fullWidth>Connect Wallet</Button>
        ) : !isValid ? (
          <Button fullWidth disabled>
            {!amountA || !amountB ? 'Enter Amounts' : 'Insufficient Balance'}
          </Button>
        ) : isApprovingA ? (
          <Button fullWidth loading>
            Approving {tokenAInfo?.symbol}...
          </Button>
        ) : isApprovingB ? (
          <Button fullWidth loading>
            Approving {tokenBInfo?.symbol}...
          </Button>
        ) : needsApprovalA ? (
          <Button fullWidth onClick={() => handleAddLiquidity()}>
            Approve {tokenAInfo?.symbol}
          </Button>
        ) : needsApprovalB ? (
          <Button fullWidth onClick={() => handleAddLiquidity()}>
            Approve {tokenBInfo?.symbol}
          </Button>
        ) : (
          <Button
            fullWidth
            disabled={!isValid || isAddingLiquidity}
            loading={isAddingLiquidity}
            onClick={handleAddLiquidity}
          >
            {pairExists?.canCreate ? 'Create Pair & Add Liquidity' : 'Add Liquidity'}
          </Button>
        )}
      </View>
    </Card>
  )
}
