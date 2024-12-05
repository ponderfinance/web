import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { usePonderSDK } from '@ponderfinance/sdk'
import { useForm } from 'react-hook-form'
import { Address, formatUnits, parseUnits } from 'viem'
import { z } from 'zod'
import { erc20Abi } from 'viem'
import { bitkubTestnetChain } from '@/app/constants/chains'
import { useAccount } from 'wagmi'
import { ponderrouterAbi } from '@ponderfinance/dex'

const addLiquiditySchema = z.object({
  tokenA: z.string().startsWith('0x').length(42),
  tokenB: z.string().startsWith('0x').length(42),
  amountA: z.string().min(1),
  amountB: z.string().min(1),
})

type FormValues = z.infer<typeof addLiquiditySchema>

interface TokenInfo {
  decimals: number
  symbol: string
  balance: bigint
  allowance: bigint
}

interface PairInfo {
  exists: boolean
  reserve0: bigint
  reserve1: bigint
  isNewPair: boolean
}

export default function AddLiquidityForm() {
  const sdk = usePonderSDK()
  const account = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [isApprovingA, setIsApprovingA] = useState(false)
  const [isApprovingB, setIsApprovingB] = useState(false)
  const [error, setError] = useState<string>('')
  const [debug, setDebug] = useState<string>('')
  const [tokenAInfo, setTokenAInfo] = useState<TokenInfo>()
  const [tokenBInfo, setTokenBInfo] = useState<TokenInfo>()
  const [pairInfo, setPairInfo] = useState<PairInfo>()

  const {
    handleSubmit,
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>()

  const tokenAAddress = watch('tokenA')
  const tokenBAddress = watch('tokenB')
  const amountA = watch('amountA')
  const amountB = watch('amountB')

  // Token info fetching
  useEffect(() => {
    const fetchTokenInfo = async () => {
      if (!sdk || !account.address) {
        console.log('Missing requirements:', {
          sdk: !!sdk,
          accountAddress: account.address,
        })
        return
      }

      try {
        if (tokenAAddress?.length === 42) {
          console.log('Fetching Token A info for:', tokenAAddress)
          const [decimalsA, symbolA, balanceA, allowanceA] = await Promise.all([
            sdk.publicClient.readContract({
              address: tokenAAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
            sdk.publicClient.readContract({
              address: tokenAAddress as Address,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: tokenAAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [account.address],
            }),
            sdk.publicClient.readContract({
              address: tokenAAddress as Address,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [account.address, sdk.router.address],
            }),
          ])

          console.log('Token A details:', {
            symbol: symbolA,
            decimals: decimalsA,
            balance: balanceA.toString(),
            allowance: allowanceA.toString(),
          })

          setTokenAInfo({
            decimals: decimalsA,
            symbol: symbolA,
            balance: balanceA,
            allowance: allowanceA,
          })
        }

        if (tokenBAddress?.length === 42) {
          console.log('Fetching Token B info for:', tokenBAddress)
          const [decimalsB, symbolB, balanceB, allowanceB] = await Promise.all([
            sdk.publicClient.readContract({
              address: tokenBAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
            sdk.publicClient.readContract({
              address: tokenBAddress as Address,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: tokenBAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [account.address],
            }),
            sdk.publicClient.readContract({
              address: tokenBAddress as Address,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [account.address, sdk.router.address],
            }),
          ])

          console.log('Token B details:', {
            symbol: symbolB,
            decimals: decimalsB,
            balance: balanceB.toString(),
            allowance: allowanceB.toString(),
          })

          setTokenBInfo({
            decimals: decimalsB,
            symbol: symbolB,
            balance: balanceB,
            allowance: allowanceB,
          })
        }
      } catch (err) {
        console.error('Token info fetch error:', err)
        setError('Failed to fetch token information')
      }
    }

    fetchTokenInfo()
    const interval = setInterval(fetchTokenInfo, 10000)
    return () => clearInterval(interval)
  }, [sdk, account.address, tokenAAddress, tokenBAddress, isApprovingA, isApprovingB])

  // Pair info fetching
  useEffect(() => {
    const fetchPairInfo = async () => {
      if (!sdk || !tokenAAddress || !tokenBAddress) return
      if (tokenAAddress.length !== 42 || tokenBAddress.length !== 42) return

      try {
        console.log('Fetching pair info for tokens:', { tokenAAddress, tokenBAddress })
        const pairAddress = await sdk.factory.getPair(
          tokenAAddress as Address,
          tokenBAddress as Address
        )

        console.log('Pair address:', pairAddress)

        if (pairAddress === '0x0000000000000000000000000000000000000000') {
          setPairInfo({
            exists: false,
            reserve0: BigInt(0),
            reserve1: BigInt(0),
            isNewPair: true,
          })
          return
        }

        const pair = sdk.getPair(pairAddress)
        const { reserve0, reserve1 } = await pair.getReserves()

        console.log('Pair reserves:', {
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString(),
        })

        setPairInfo({
          exists: true,
          reserve0,
          reserve1,
          isNewPair: reserve0 === BigInt(0) && reserve1 === BigInt(0),
        })
      } catch (err) {
        console.error('Pair info fetch error:', err)
        setError('Failed to fetch pair information')
      }
    }

    fetchPairInfo()
  }, [sdk, tokenAAddress, tokenBAddress])

  const handleApprove = async (token: Address, spender: Address, amount: bigint) => {
    if (!sdk || !account.address || !sdk.walletClient) {
      const error = 'Missing requirements for approval'
      console.error(error, {
        sdk: !!sdk,
        accountAddress: account.address,
        walletClient: !!sdk?.walletClient,
      })
      throw new Error(error)
    }

    console.log('Approval request:', {
      token,
      spender,
      amount: amount.toString(),
      routerAddress: sdk.router.address,
      chainId: bitkubTestnetChain.id,
    })

    try {
      const hash = await sdk.walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
        chain: bitkubTestnetChain,
        account: account.address,
      })

      console.log('Approval transaction hash:', hash)
      const receipt = await sdk.publicClient.waitForTransactionReceipt({ hash })
      console.log('Approval receipt:', receipt)

      if (receipt.status !== 'success') {
        throw new Error('Approval transaction failed')
      }
    } catch (err: any) {
      console.error('Approval error:', err)
      throw new Error(`Approval failed: ${err.message}`)
    }
  }

  const onSubmit = async (data: FormValues) => {
    if (!sdk || !tokenAInfo || !tokenBInfo) {
      console.error('Missing requirements:', {
        sdk: !!sdk,
        tokenAInfo: !!tokenAInfo,
        tokenBInfo: !!tokenBInfo,
      })
      setError('SDK or token info is missing')
      return
    }
    if (!account.address) {
      setError('Wallet not connected')
      return
    }

    try {
      console.log('Form submission data:', data)
      const validatedData = addLiquiditySchema.parse(data)

      setIsLoading(true)
      setError('')
      setDebug('')

      console.log('Chain verification:', {
        expectedChain: bitkubTestnetChain.id,
        routerChain: sdk.router.chainId,
      })

      // Parse input amounts
      const amountADesired = parseUnits(validatedData.amountA, tokenAInfo.decimals)
      const amountBDesired = parseUnits(validatedData.amountB, tokenBInfo.decimals)

      console.log('Parsed amounts:', {
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        tokenAAllowance: tokenAInfo.allowance.toString(),
        tokenBAllowance: tokenBInfo.allowance.toString(),
      })

      // Check token balances
      if (amountADesired > tokenAInfo.balance) {
        throw new Error(`Insufficient ${tokenAInfo.symbol} balance`)
      }
      if (amountBDesired > tokenBInfo.balance) {
        throw new Error(`Insufficient ${tokenBInfo.symbol} balance`)
      }

      // Sort tokens and align corresponding amounts
      const [token0, token1] = [validatedData.tokenA, validatedData.tokenB].sort() as [
        Address,
        Address,
      ]
      const amount0Desired =
        token0 === validatedData.tokenA ? amountADesired : amountBDesired
      const amount1Desired =
        token1 === validatedData.tokenB ? amountBDesired : amountADesired

      console.log('Sorted tokens and aligned amounts:', {
        token0,
        token1,
        amount0Desired: amount0Desired.toString(),
        amount1Desired: amount1Desired.toString(),
      })

      // Handle token approvals
      if (amount0Desired > tokenAInfo.allowance) {
        console.log(`Approving ${tokenAInfo.symbol} for ${sdk.router.address}`)
        setDebug('Approving token A...')
        setIsApprovingA(true)
        await handleApprove(token0 as Address, sdk.router.address, amount0Desired)
        setIsApprovingA(false)
      }

      if (amount1Desired > tokenBInfo.allowance) {
        console.log(`Approving ${tokenBInfo.symbol} for ${sdk.router.address}`)
        setDebug('Approving token B...')
        setIsApprovingB(true)
        await handleApprove(token1 as Address, sdk.router.address, amount1Desired)
        setIsApprovingB(false)
      }

      // Calculate minimum amounts with slippage tolerance
      const slippageTolerance = pairInfo?.isNewPair ? BigInt(1000) : BigInt(100) // 10% for new pair, 1% otherwise
      const amount0Min =
        (amount0Desired * (BigInt(10000) - slippageTolerance)) / BigInt(10000)
      const amount1Min =
        (amount1Desired * (BigInt(10000) - slippageTolerance)) / BigInt(10000)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 minutes from now

      console.log('Slippage-adjusted minimum amounts and deadline:', {
        amount0Min: amount0Min.toString(),
        amount1Min: amount1Min.toString(),
        deadline: deadline.toString(),
      })

      // Add liquidity
      console.log('Preparing to add liquidity with params:', {
        tokenA: token0,
        tokenB: token1,
        amountADesired: amount0Desired.toString(),
        amountBDesired: amount1Desired.toString(),
        amountAMin: amount0Min.toString(),
        amountBMin: amount1Min.toString(),
        to: account.address,
        deadline: deadline.toString(),
        isNewPair: pairInfo?.isNewPair,
      })

      try {
        console.log('Simulating addLiquidity transaction...')

        const simulationResult = await sdk.publicClient.simulateContract({
          address: sdk.router.address,
          abi: ponderrouterAbi,
          functionName: 'addLiquidity',
          args: [
            token0,
            token1,
            amount0Desired,
            amount1Desired,
            amount0Min,
            amount1Min,
            account.address,
            deadline,
          ],
          account: account.address,
        })

        console.log('Simulation result:', simulationResult)
      } catch (err: any) {
        console.error('Simulation failed:', err)
        setError(`Simulation failed: ${err.reason || err.message}`)
        return
      }

      console.log('Estimating gas for addLiquidity transaction...')

      const hash = await sdk.router.addLiquidity({
        tokenA: token0,
        tokenB: token1,
        amountADesired: amount0Desired,
        amountBDesired: amount1Desired,
        amountAMin: amount0Min,
        amountBMin: amount1Min,
        to: account.address,
        deadline,
      })

      console.log('Transaction hash for addLiquidity:', hash)

      // Wait for the transaction receipt
      const receipt = await sdk.publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60_000,
      })

      console.log('Transaction receipt:', receipt)

      if (receipt.status !== 'success') {
        throw new Error('Add liquidity transaction failed')
      }

      reset()
      setDebug('Liquidity added successfully!')
    } catch (err: any) {
      console.error('Add liquidity error:', err)
      setError(err.message || 'Failed to add liquidity')
    } finally {
      setIsLoading(false)
    }
  }

  if (!sdk) {
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
            <Text variant="title-3">Add Liquidity</Text>
            {pairInfo?.isNewPair && (
              <Text>
                This will be the first liquidity addition - you are setting the initial
                price ratio!
              </Text>
            )}

            {error && <Text>{error}</Text>}
            {debug && <Text color="positive">{debug}</Text>}

            <View gap={4}>
              <Text>Token A Address</Text>
              <input
                type="text"
                placeholder="0x..."
                {...register('tokenA')}
                className="w-full p-2 border rounded"
              />
              {tokenAInfo && (
                <Text>
                  {tokenAInfo.symbol} - Balance:{' '}
                  {formatUnits(tokenAInfo.balance, tokenAInfo.decimals)}
                </Text>
              )}
              {errors.tokenA && <Text>Invalid token address</Text>}
            </View>

            <View gap={4}>
              <Text>Amount A</Text>
              <input
                type="text"
                placeholder="0.0"
                {...register('amountA')}
                className="w-full p-2 border rounded"
              />
              {errors.amountA && <Text>Invalid amount</Text>}
            </View>

            <View gap={4}>
              <Text>Token B Address</Text>
              <input
                type="text"
                placeholder="0x..."
                {...register('tokenB')}
                className="w-full p-2 border rounded"
              />
              {tokenBInfo && (
                <Text>
                  {tokenBInfo.symbol} - Balance:{' '}
                  {formatUnits(tokenBInfo.balance, tokenBInfo.decimals)}
                </Text>
              )}
              {errors.tokenB && <Text>Invalid token address</Text>}
            </View>

            <View gap={4}>
              <Text>Amount B</Text>
              <input
                type="text"
                placeholder="0.0"
                {...register('amountB')}
                className="w-full p-2 border rounded"
              />
              {errors.amountB && <Text>Invalid amount</Text>}
            </View>

            {pairInfo?.exists && !pairInfo.isNewPair && (
              <View gap={2}>
                <Text>Current Pool Ratio</Text>
                <Text>
                  1 {tokenAInfo?.symbol} ={' '}
                  {formatUnits(
                    (pairInfo.reserve1 * BigInt(10 ** (tokenAInfo?.decimals || 18))) /
                      pairInfo.reserve0,
                    tokenBInfo?.decimals || 18
                  )}{' '}
                  {tokenBInfo?.symbol}
                </Text>
              </View>
            )}

            {pairInfo?.isNewPair && amountA && amountB && (
              <View gap={2}>
                <Text>Initial Pool Ratio</Text>
                <Text>
                  1 {tokenAInfo?.symbol} ={' '}
                  {(Number(amountB) / Number(amountA)).toFixed(6)} {tokenBInfo?.symbol}
                </Text>
              </View>
            )}

            {tokenAInfo && (
              <View gap={2}>
                <Text>Token A Allowance</Text>
                <Text>
                  {formatUnits(tokenAInfo.allowance, tokenAInfo.decimals)}{' '}
                  {tokenAInfo.symbol}
                </Text>
              </View>
            )}

            {tokenBInfo && (
              <View gap={2}>
                <Text>Token B Allowance</Text>
                <Text>
                  {formatUnits(tokenBInfo.allowance, tokenBInfo.decimals)}{' '}
                  {tokenBInfo.symbol}
                </Text>
              </View>
            )}
          </View>

          <Button
            type="submit"
            disabled={isLoading || isApprovingA || isApprovingB}
            loading={isLoading || isApprovingA || isApprovingB}
            fullWidth
          >
            {isApprovingA
              ? 'Approving Token A...'
              : isApprovingB
                ? 'Approving Token B...'
                : isLoading
                  ? 'Adding Liquidity...'
                  : pairInfo?.isNewPair
                    ? 'Add Initial Liquidity'
                    : 'Add Liquidity'}
          </Button>
        </View>
      </form>
    </Card>
  )
}
