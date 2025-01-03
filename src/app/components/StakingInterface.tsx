import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { useAccount } from 'wagmi'
import { Address, formatUnits, formatEther, parseUnits } from 'viem'
import { erc20Abi } from 'viem'
import { bitkubTestnetChain, CURRENT_CHAIN } from '@/src/app/constants/chains'
import { usePonderSDK } from '@ponderfinance/sdk'

interface StakingInterfaceProps {
  pid: number
  lpToken: Address
  token0Symbol: string
  token1Symbol: string
  depositFee: number
}

export default function StakingInterface({
  pid,
  lpToken,
  token0Symbol,
  token1Symbol,
  depositFee,
}: StakingInterfaceProps) {
  const sdk = usePonderSDK()
  const account = useAccount()
  const [lpBalance, setLpBalance] = useState<bigint>(BigInt(0))
  const [stakedAmount, setStakedAmount] = useState<bigint>(BigInt(0))
  const [allowance, setAllowance] = useState<bigint>(BigInt(0))
  const [isLoading, setIsLoading] = useState(true)
  const [isApproving, setIsApproving] = useState(false)
  const [isStaking, setIsStaking] = useState(false)
  const [isUnstaking, setIsUnstaking] = useState(false)
  const [error, setError] = useState<string>('')
  const [stakeAmount, setStakeAmount] = useState<string>('')
  const [unstakeAmount, setUnstakeAmount] = useState<string>('')

  useEffect(() => {
    const fetchBalances = async () => {
      if (!sdk || !account.address) return

      try {
        const [balance, userInfo, lpAllowance] = await Promise.all([
          sdk.publicClient.readContract({
            address: lpToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account.address],
          }),
          sdk.masterChef.userInfo(BigInt(pid), account.address),
          sdk.publicClient.readContract({
            address: lpToken,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account.address, sdk.masterChef.address],
          }),
        ])

        setLpBalance(balance)
        setStakedAmount(userInfo.amount)
        setAllowance(lpAllowance)
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
  }, [sdk, account.address, pid, lpToken, isApproving, isStaking, isUnstaking])

  const handleApprove = async () => {
    if (!sdk || !sdk.walletClient || !account.address) return

    try {
      setIsApproving(true)
      setError('')

      const hash = await sdk.walletClient.writeContract({
        address: lpToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [sdk.masterChef.address, BigInt(2) ** BigInt(256) - BigInt(1)], // Max approval
        chain: CURRENT_CHAIN,
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

  const handleStake = async () => {
    if (!sdk || !account.address || !stakeAmount) return

    try {
      setIsStaking(true)
      setError('')

      const amount = parseUnits(stakeAmount, 18)
      if (amount > lpBalance) {
        throw new Error('Insufficient LP token balance')
      }

      const hash = await sdk.masterChef.deposit(BigInt(pid), amount)
      await sdk.publicClient.waitForTransactionReceipt({ hash })
      setStakeAmount('')
    } catch (err: any) {
      console.error('Staking error:', err)
      setError(err.message || 'Failed to stake')
    } finally {
      setIsStaking(false)
    }
  }

  const handleUnstake = async () => {
    if (!sdk || !account.address || !unstakeAmount) return

    try {
      setIsUnstaking(true)
      setError('')

      const amount = parseUnits(unstakeAmount, 18)
      if (amount > stakedAmount) {
        throw new Error('Insufficient staked amount')
      }

      const hash = await sdk.masterChef.withdraw(BigInt(pid), amount)
      await sdk.publicClient.waitForTransactionReceipt({ hash })
      setUnstakeAmount('')
    } catch (err: any) {
      console.error('Unstaking error:', err)
      setError(err.message || 'Failed to unstake')
    } finally {
      setIsUnstaking(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Loading staking interface...</Text>
        </View>
      </Card>
    )
  }

  if (!account.address) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Please connect your wallet to stake</Text>
        </View>
      </Card>
    )
  }

  return (
    <Card>
      <View padding={16} gap={16}>
        <View gap={4}>
          <Text variant="title-3">Stake LP Tokens</Text>
          <Text>
            {token0Symbol}/{token1Symbol} Pool
          </Text>
          {depositFee > 0 && <Text>Deposit Fee: {depositFee}%</Text>}
        </View>

        {error && <Text>{error}</Text>}

        <View gap={12}>
          <View gap={4}>
            <Text>Available to Stake: {formatEther(lpBalance)} LP</Text>
            <View direction="row" gap={8}>
              <input
                type="text"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="Amount to stake"
                className="flex-1 p-2 border rounded"
              />
              {parseUnits(stakeAmount || '0', 18) > allowance ? (
                <Button
                  onClick={handleApprove}
                  disabled={isApproving}
                  loading={isApproving}
                >
                  Approve
                </Button>
              ) : (
                <Button
                  onClick={handleStake}
                  disabled={
                    !stakeAmount || isStaking || parseUnits(stakeAmount, 18) > lpBalance
                  }
                  loading={isStaking}
                >
                  Stake
                </Button>
              )}
            </View>
          </View>

          <View gap={4}>
            <Text>Currently Staked: {formatEther(stakedAmount)} LP</Text>
            <View direction="row" gap={8}>
              <input
                type="text"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                placeholder="Amount to unstake"
                className="flex-1 p-2 border rounded"
              />
              <Button
                onClick={handleUnstake}
                disabled={
                  !unstakeAmount ||
                  isUnstaking ||
                  parseUnits(unstakeAmount, 18) > stakedAmount
                }
                loading={isUnstaking}
              >
                Unstake
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Card>
  )
}
