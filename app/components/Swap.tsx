import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { usePonderSDK } from '@/app/providers/ponder'
import { useForm } from 'react-hook-form'
import { Address, formatUnits, parseUnits } from 'viem'
import { z } from 'zod'
import { erc20Abi } from 'viem'
import { bitkubTestnetChain } from '@/app/constants/chains'
import { useAccount } from 'wagmi'

const swapSchema = z.object({
  tokenIn: z.string().startsWith('0x').length(42),
  tokenOut: z.string().startsWith('0x').length(42),
  amountIn: z.string().min(1),
})

type FormValues = z.infer<typeof swapSchema>

interface TokenInfo {
  decimals: number
  symbol: string
  balance: bigint
  allowance: bigint
}

export default function SwapInterface() {
  const { sdk, isReady } = usePonderSDK()
  const account = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string>('')
  const [tokenInInfo, setTokenInInfo] = useState<TokenInfo>()
  const [tokenOutInfo, setTokenOutInfo] = useState<TokenInfo>()
  const [expectedOutput, setExpectedOutput] = useState<string>('')

  const {
    handleSubmit,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>()

  const tokenInAddress = watch('tokenIn')
  const tokenOutAddress = watch('tokenOut')
  const amountIn = watch('amountIn')

  // Fetch token information
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!sdk || !account.address) return

      try {
        if (tokenInAddress?.length === 42) {
          const [decimals, symbol, balance, allowance] = await Promise.all([
            sdk.publicClient.readContract({
              address: tokenInAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
            sdk.publicClient.readContract({
              address: tokenInAddress as Address,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: tokenInAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [account.address],
            }),
            sdk.publicClient.readContract({
              address: tokenInAddress as Address,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [account.address, sdk.router.address],
            }),
          ])

          setTokenInInfo({
            decimals,
            symbol,
            balance,
            allowance,
          })
        }

        if (tokenOutAddress?.length === 42) {
          const [decimals, symbol, balance] = await Promise.all([
            sdk.publicClient.readContract({
              address: tokenOutAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
            sdk.publicClient.readContract({
              address: tokenOutAddress as Address,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: tokenOutAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [account.address],
            }),
          ])

          setTokenOutInfo({
            decimals,
            symbol,
            balance,
            allowance: BigInt(0), // Not needed for output token
          })
        }
      } catch (err) {
        console.error('Error fetching token info:', err)
      }
    }

    fetchTokenInfo()
  }, [sdk, account.address, tokenInAddress, tokenOutAddress, isApproving])

  // Calculate expected output amount
  useEffect(() => {
    const calculateOutput = async () => {
      if (!sdk || !tokenInAddress || !tokenOutAddress || !amountIn || !tokenInInfo) return

      try {
        const path = [tokenInAddress as Address, tokenOutAddress as Address]
        const amounts = await sdk.router.getAmountsOut(
          parseUnits(amountIn, tokenInInfo.decimals),
          path
        )

        if (tokenOutInfo) {
          setExpectedOutput(formatUnits(amounts[1], tokenOutInfo.decimals))
        }
      } catch (err) {
        console.error('Error calculating output:', err)
        setExpectedOutput('')
      }
    }

    calculateOutput()
  }, [sdk, tokenInAddress, tokenOutAddress, amountIn, tokenInInfo, tokenOutInfo])

  const handleApprove = async (token: Address, spender: Address, amount: bigint) => {
    if (!sdk || ! sdk.walletClient || !account.address) return

    try {
      const hash = await sdk.walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
        chain: bitkubTestnetChain,
        account: account.address,
      })
      await sdk.publicClient.waitForTransactionReceipt({ hash })
    } catch (err: any) {
      throw new Error(`Approval failed: ${err.message}`)
    }
  }

  const onSubmit = async (data: FormValues) => {
    if (!sdk || !tokenInInfo || !tokenOutInfo) return
    if (!account.address) {
      setError('Wallet not connected')
      return
    }

    try {
      const validatedData = swapSchema.parse(data)
      setIsLoading(true)
      setError('')

      const amountInWei = parseUnits(validatedData.amountIn, tokenInInfo.decimals)

      // Check balance
      if (amountInWei > tokenInInfo.balance) {
        throw new Error(`Insufficient ${tokenInInfo.symbol} balance`)
      }

      // Handle approval if needed
      if (amountInWei > tokenInInfo.allowance) {
        setIsApproving(true)
        await handleApprove(
          validatedData.tokenIn as Address,
          sdk.router.address,
          amountInWei
        )
        setIsApproving(false)
      }

      const path = [validatedData.tokenIn as Address, validatedData.tokenOut as Address]
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 minutes

      const minOutput = expectedOutput
        ? (parseUnits(expectedOutput, tokenOutInfo.decimals) * BigInt(95)) / BigInt(100) // 5% slippage
        : BigInt(0)

      const hash = await sdk.router.swapExactTokensForTokens({
        amountIn: amountInWei,
        amountOutMin: minOutput,
        path,
        to: account.address,
        deadline,
      })

      await sdk.publicClient.waitForTransactionReceipt({ hash })
      reset()
      setExpectedOutput('')
    } catch (err: any) {
      console.error('Swap error:', err)
      if (err instanceof z.ZodError) {
        setError('Invalid input format')
      } else {
        setError(err.message || 'Failed to swap')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isReady) {
    return (
      <Card>
        <View align="center" justify="center">
          <Text>Loading...</Text>
        </View>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <View gap={16}>
          <View gap={8}>
            <Text variant="title-3">Swap</Text>

            {error && <Text>{error}</Text>}

            <View gap={4}>
              <Text>Token In</Text>
              <input
                type="text"
                placeholder="0x..."
                {...register('tokenIn')}
                className="w-full p-2 border rounded"
              />
              {tokenInInfo && (
                <Text>
                  {tokenInInfo.symbol} - Balance:{' '}
                  {formatUnits(tokenInInfo.balance, tokenInInfo.decimals)}
                </Text>
              )}
              {errors.tokenIn && <Text>Invalid token address</Text>}
            </View>

            <View gap={4}>
              <Text>Amount In</Text>
              <input
                type="text"
                placeholder="0.0"
                {...register('amountIn')}
                className="w-full p-2 border rounded"
              />
              {errors.amountIn && <Text>Invalid amount</Text>}
            </View>

            <View gap={4}>
              <Text>Token Out</Text>
              <input
                type="text"
                placeholder="0x..."
                {...register('tokenOut')}
                className="w-full p-2 border rounded"
              />
              {tokenOutInfo && (
                <Text>
                  {tokenOutInfo.symbol} - Balance:{' '}
                  {formatUnits(tokenOutInfo.balance, tokenOutInfo.decimals)}
                </Text>
              )}
              {errors.tokenOut && <Text>Invalid token address</Text>}
            </View>

            {expectedOutput && (
              <View gap={2}>
                <Text>Expected Output</Text>
                <Text>
                  {expectedOutput} {tokenOutInfo?.symbol}
                </Text>
                <Text>
                  Minimum received (5% slippage):{' '}
                  {(Number(expectedOutput) * 0.95).toFixed(6)} {tokenOutInfo?.symbol}
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
            {isApproving ? 'Approving...' : isLoading ? 'Swapping...' : 'Swap'}
          </Button>
        </View>
      </form>
    </Card>
  )
}
