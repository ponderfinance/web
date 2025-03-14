import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { usePonderSDK } from '@ponderfinance/sdk'
import { useForm } from 'react-hook-form'
import { Address, formatUnits, parseUnits } from 'viem'
import { z } from 'zod'
import { erc20Abi } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { useAccount } from 'wagmi'

const removeLiquiditySchema = z.object({
  pair: z.string().startsWith('0x').length(42),
  amount: z.string().min(1),
})

type FormValues = z.infer<typeof removeLiquiditySchema>

interface PairInfo {
  token0: Address
  token1: Address
  token0Symbol: string
  token1Symbol: string
  token0Decimals: number
  token1Decimals: number
  reserves: [bigint, bigint]
  totalSupply: bigint
  userBalance: bigint
  allowance: bigint
}

export default function RemoveLiquidityForm() {
  const sdk = usePonderSDK()
  const account = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string>('')
  const [pairInfo, setPairInfo] = useState<PairInfo>()
  const [expectedAmounts, setExpectedAmounts] = useState<[string, string]>(['0', '0'])

  const {
    handleSubmit,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>()

  const pairAddress = watch('pair')
  const amount = watch('amount')

  // Fetch pair information
  useEffect(() => {
    const fetchPairInfo = async () => {
      if (!sdk || !account.address || !pairAddress?.length) return

      try {
        const pair = sdk.getPair(pairAddress as Address)
        const [token0, token1, reserves, totalSupply, userBalance, allowance] =
          await Promise.all([
            pair.token0(),
            pair.token1(),
            pair.getReserves(),
            pair.totalSupply(),
            pair.balanceOf(account.address),
            pair.allowance(account.address, sdk.router.address),
          ])

        // Get token details
        const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] =
          await Promise.all([
            sdk.publicClient.readContract({
              address: token0,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: token1,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: token0,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
            sdk.publicClient.readContract({
              address: token1,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
          ])

        setPairInfo({
          token0,
          token1,
          token0Symbol,
          token1Symbol,
          token0Decimals,
          token1Decimals,
          reserves: [reserves.reserve0, reserves.reserve1],
          totalSupply,
          userBalance,
          allowance,
        })
      } catch (err) {
        console.error('Error fetching pair info:', err)
        setError('Failed to fetch pair information')
      }
    }

    fetchPairInfo()
  }, [sdk, account.address, pairAddress, isApproving])

  // Calculate expected output amounts
  useEffect(() => {
    const calculateAmounts = async () => {
      if (!pairInfo || !amount) {
        setExpectedAmounts(['0', '0'])
        return
      }

      try {
        const lpAmount = parseUnits(amount, 18)
        const amount0 = (lpAmount * pairInfo.reserves[0]) / pairInfo.totalSupply
        const amount1 = (lpAmount * pairInfo.reserves[1]) / pairInfo.totalSupply

        setExpectedAmounts([
          formatUnits(amount0, pairInfo.token0Decimals),
          formatUnits(amount1, pairInfo.token1Decimals),
        ])
      } catch (err) {
        console.error('Error calculating amounts:', err)
        setExpectedAmounts(['0', '0'])
      }
    }

    calculateAmounts()
  }, [pairInfo, amount])

  const handleApprove = async (lpToken: Address, spender: Address, amount: bigint) => {
    if (!sdk || !sdk.walletClient || !account.address) return

    try {
      const hash = await sdk.walletClient.writeContract({
        address: lpToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
        chain: CURRENT_CHAIN,
        account: account.address,
      })

      await sdk.publicClient.waitForTransactionReceipt({ hash })
    } catch (err: any) {
      throw new Error(`Approval failed: ${err.message}`)
    }
  }

  const onSubmit = async (data: FormValues) => {
    if (!sdk || !pairInfo || !account.address) return

    try {
      const validatedData = removeLiquiditySchema.parse(data)
      setIsLoading(true)
      setError('')

      const lpAmount = parseUnits(validatedData.amount, 18)

      // Check balance
      if (lpAmount > pairInfo.userBalance) {
        throw new Error('Insufficient LP token balance')
      }

      // Handle approval if needed
      if (lpAmount > pairInfo.allowance) {
        setIsApproving(true)
        await handleApprove(validatedData.pair as Address, sdk.router.address, lpAmount)
        setIsApproving(false)
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 minutes

      // Calculate minimum amounts with 1% slippage tolerance
      const amount0Min =
        (parseUnits(expectedAmounts[0], pairInfo.token0Decimals) * BigInt(99)) /
        BigInt(100)
      const amount1Min =
        (parseUnits(expectedAmounts[1], pairInfo.token1Decimals) * BigInt(99)) /
        BigInt(100)

      const hash = await sdk.router.removeLiquidity({
        tokenA: pairInfo.token0,
        tokenB: pairInfo.token1,
        liquidity: lpAmount,
        amountAMin: amount0Min,
        amountBMin: amount1Min,
        to: account.address,
        deadline,
      })

      await sdk.publicClient.waitForTransactionReceipt({ hash })
      reset()
      setExpectedAmounts(['0', '0'])
    } catch (err: any) {
      console.error('Remove liquidity error:', err)
      setError(err.message || 'Failed to remove liquidity')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <View gap={16}>
          <View gap={8}>
            <Text variant="title-3">Remove Liquidity</Text>

            {error && <Text>{error}</Text>}

            <View gap={4}>
              <Text>LP Token Address</Text>
              <input
                type="text"
                placeholder="0x..."
                {...register('pair')}
                className="w-full p-2 border rounded"
              />
              {pairInfo && (
                <Text>
                  {pairInfo.token0Symbol}/{pairInfo.token1Symbol} - Balance:{' '}
                  {formatUnits(pairInfo.userBalance, 18)}
                </Text>
              )}
              {errors.pair && <Text>Invalid pair address</Text>}
            </View>

            <View gap={4}>
              <Text>LP Amount to Remove</Text>
              <input
                type="text"
                placeholder="0.0"
                {...register('amount')}
                className="w-full p-2 border rounded"
              />
              {errors.amount && <Text>Invalid amount</Text>}
            </View>

            {pairInfo && expectedAmounts[0] !== '0' && (
              <View gap={2}>
                <Text>You will receive:</Text>
                <Text>
                  {expectedAmounts[0]} {pairInfo.token0Symbol}
                </Text>
                <Text>
                  {expectedAmounts[1]} {pairInfo.token1Symbol}
                </Text>
                <Text>
                  Minimum received (1% slippage):
                  <br />
                  {(Number(expectedAmounts[0]) * 0.99).toFixed(6)} {pairInfo.token0Symbol}
                  <br />
                  {(Number(expectedAmounts[1]) * 0.99).toFixed(6)} {pairInfo.token1Symbol}
                </Text>
              </View>
            )}
          </View>

          <Button
            type="submit"
            disabled={isLoading || isApproving}
            loading={isLoading || isApproving}
            fullWidth
          >
            {isApproving
              ? 'Approving...'
              : isLoading
                ? 'Removing...'
                : 'Remove Liquidity'}
          </Button>
        </View>
      </form>
    </Card>
  )
}
