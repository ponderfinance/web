import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { usePonderSDK } from '@/app/providers/ponder'
import { useAccount } from 'wagmi'
import { formatEther, parseUnits } from 'viem'
import { erc20Abi } from 'viem'
import { bitkubTestnetChain } from '@/app/constants/chains'

interface BoostInterfaceProps {
  pid: number
  boostMultiplier: number
}

export default function BoostInterface({ pid, boostMultiplier }: BoostInterfaceProps) {
  const { sdk, isReady } = usePonderSDK()
  const account = useAccount()
  const [ponderBalance, setPonderBalance] = useState<bigint>(BigInt(0))
  const [boostedAmount, setBoostedAmount] = useState<bigint>(BigInt(0))
  const [allowance, setAllowance] = useState<bigint>(BigInt(0))
  const [isLoading, setIsLoading] = useState(true)
  const [isApproving, setIsApproving] = useState(false)
  const [isBoosting, setIsBoosting] = useState(false)
  const [isUnboosting, setIsUnboosting] = useState(false)
  const [error, setError] = useState<string>('')
  const [boostAmount, setBoostAmount] = useState<string>('')
  const [unboostAmount, setUnboostAmount] = useState<string>('')

  useEffect(() => {
    const fetchBalances = async () => {
      if (!sdk || !account.address) return

      try {
        const ponder = await sdk.masterChef.ponder()
        const [balance, userInfo, tokenAllowance] = await Promise.all([
          sdk.publicClient.readContract({
            address: ponder,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account.address],
          }),
          sdk.masterChef.userInfo(BigInt(pid), account.address),
          sdk.publicClient.readContract({
            address: ponder,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account.address, sdk.masterChef.address],
          }),
        ])

        setPonderBalance(balance)
        setBoostedAmount(userInfo.ponderStaked)
        setAllowance(tokenAllowance)
        setIsLoading(false)
      } catch (err: any) {
        console.error('Error fetching balances:', err)
        setError(err.message || 'Failed to fetch balances')
        setIsLoading(false)
      }
    }

    fetchBalances()
    const interval = setInterval(fetchBalances, 10000)
    return () => clearInterval(interval)
  }, [sdk, account.address, pid, isApproving, isBoosting, isUnboosting])

  const handleApprove = async () => {
    if (!sdk || !sdk.walletClient || !account.address) return

    try {
      setIsApproving(true)
      setError('')

      const ponder = await sdk.masterChef.ponder()
      const hash = await sdk.walletClient.writeContract({
        address: ponder,
        abi: erc20Abi,
        functionName: 'approve',
        args: [sdk.masterChef.address, BigInt(2) ** BigInt(256) - BigInt(1)],
        chain: bitkubTestnetChain,
        account: account.address,
      })

      await sdk.publicClient.waitForTransactionReceipt({ hash })
    } catch (err: any) {
      console.error('Approval error:', err)
      setError(err.message || 'Failed to approve')
    } finally {
      setIsApproving(false)
    }
  }

  const handleBoost = async () => {
    if (!sdk || !account.address || !boostAmount) return

    try {
      setIsBoosting(true)
      setError('')

      const amount = parseUnits(boostAmount, 18)
      if (amount > ponderBalance) {
        throw new Error('Insufficient PONDER balance')
      }

      const hash = await sdk.masterChef.boostStake(BigInt(pid), amount)
      await sdk.publicClient.waitForTransactionReceipt({ hash })
      setBoostAmount('')
    } catch (err: any) {
      console.error('Boost error:', err)
      setError(err.message || 'Failed to boost')
    } finally {
      setIsBoosting(false)
    }
  }

  const handleUnboost = async () => {
    if (!sdk || !account.address || !unboostAmount) return

    try {
      setIsUnboosting(true)
      setError('')

      const amount = parseUnits(unboostAmount, 18)
      if (amount > boostedAmount) {
        throw new Error('Insufficient boosted amount')
      }

      const hash = await sdk.masterChef.boostUnstake(BigInt(pid), amount)
      await sdk.publicClient.waitForTransactionReceipt({ hash })
      setUnboostAmount('')
    } catch (err: any) {
      console.error('Unboost error:', err)
      setError(err.message || 'Failed to unboost')
    } finally {
      setIsUnboosting(false)
    }
  }

  if (!isReady || isLoading) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Loading boost interface...</Text>
        </View>
      </Card>
    )
  }

  if (!account.address) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Please connect your wallet to boost rewards</Text>
        </View>
      </Card>
    )
  }

  return (
    <Card>
      <View padding={16} gap={16}>
        <View gap={4}>
          <Text variant="title-3">Boost Your Rewards</Text>
          <Text>
            Stake PONDER tokens to boost your farming rewards up to {boostMultiplier}x
          </Text>
        </View>

        {error && <Text>{error}</Text>}

        <View gap={12}>
          <View gap={4}>
            <Text>Available PONDER: {formatEther(ponderBalance)}</Text>
            <View direction="row" gap={8}>
              <input
                type="text"
                value={boostAmount}
                onChange={(e) => setBoostAmount(e.target.value)}
                placeholder="Amount to stake"
                className="flex-1 p-2 border rounded"
              />
              {parseUnits(boostAmount || '0', 18) > allowance ? (
                <Button
                  onClick={handleApprove}
                  disabled={isApproving}
                  loading={isApproving}
                >
                  Approve
                </Button>
              ) : (
                <Button
                  onClick={handleBoost}
                  disabled={
                    !boostAmount ||
                    isBoosting ||
                    parseUnits(boostAmount, 18) > ponderBalance
                  }
                  loading={isBoosting}
                >
                  Boost
                </Button>
              )}
            </View>
          </View>

          <View gap={4}>
            <Text>Currently Boosting: {formatEther(boostedAmount)} PONDER</Text>
            <View direction="row" gap={8}>
              <input
                type="text"
                value={unboostAmount}
                onChange={(e) => setUnboostAmount(e.target.value)}
                placeholder="Amount to unstake"
                className="flex-1 p-2 border rounded"
              />
              <Button
                onClick={handleUnboost}
                disabled={
                  !unboostAmount ||
                  isUnboosting ||
                  parseUnits(unboostAmount, 18) > boostedAmount
                }
                loading={isUnboosting}
              >
                Unboost
              </Button>
            </View>
          </View>

          <View gap={2}>
            <Text>Current Boost Multiplier</Text>
            <Text>
              {boostedAmount > BigInt(0)
                ? `${((Number(boostedAmount) / 1e18) * (boostMultiplier - 1) + 1).toFixed(2)}x`
                : '1.00x'}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  )
}
