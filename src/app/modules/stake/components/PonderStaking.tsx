import { useState } from 'react'
import { Text, View, Button } from 'reshaped'
import { useAccount } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import {
  useStakingInfo,
  useStakePonder,
  useUnstakePonder,
  useTokenBalance,
  useTokenAllowance,
  usePonderSDK,
} from '@ponderfinance/sdk'

function StakeInterface() {
  const { address } = useAccount()
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const sdk = usePonderSDK()

  // Get staking info
  const { data: stakingInfo, isLoading: isLoadingInfo } = useStakingInfo(address)

  // Get PONDER balance and allowance
  const { data: ponderBalance } = useTokenBalance(sdk.ponder.address, address, !!address)

  const { data: allowanceData } = useTokenAllowance(
    sdk.ponder.address,
    sdk.staking.address,
    address,
    !!address
  )

  // Staking mutations
  const { mutate: stake, isPending: isStaking } = useStakePonder()
  const { mutate: unstake, isPending: isUnstaking } = useUnstakePonder()

  const hasEnoughAllowance = (amount: bigint) => {
    if (!allowanceData) return false
    return allowanceData.amount >= amount
  }

  const handleStake = () => {
    if (!stakeAmount) return
    const amount = parseUnits(stakeAmount, 18)
    stake({ amount })
  }

  const handleUnstake = () => {
    if (!unstakeAmount) return
    unstake({
      shares: parseUnits(unstakeAmount, 18),
    })
  }

  if (isLoadingInfo) {
    return (
      <View padding={16} align="center">
        <Text>Loading staking info...</Text>
      </View>
    )
  }

  const currentStakeAmount = stakeAmount ? parseUnits(stakeAmount, 18) : BigInt(0)

  return (
    <View gap={16} padding={16} className="rounded-lg bg-gray-50">
      <View gap={8}>
        <Text variant="title-3">PONDER Staking</Text>
        <Text>Stake PONDER to receive xPONDER and earn protocol fees</Text>
      </View>

      <View gap={8} className="border rounded-lg p-4">
        <View direction="row" justify="space-between">
          <Text>Total Staked</Text>
          <Text>
            {stakingInfo ? formatUnits(stakingInfo.totalStaked, 18) : '0'} PONDER
          </Text>
        </View>

        <View direction="row" justify="space-between">
          <Text>Exchange Rate</Text>
          <Text>
            1 xPONDER = {stakingInfo ? stakingInfo.exchangeRate.toFixed(4) : '1'} PONDER
          </Text>
        </View>

        <View direction="row" justify="space-between">
          <Text>Your Stake</Text>
          <Text>
            {stakingInfo ? formatUnits(stakingInfo.userShares, 18) : '0'} xPONDER
          </Text>
        </View>

        <View direction="row" justify="space-between">
          <Text>Your Value</Text>
          <Text>
            {stakingInfo ? formatUnits(stakingInfo.userBalance, 18) : '0'} PONDER
          </Text>
        </View>

        <View direction="row" justify="space-between">
          <Text>Next Rebase</Text>
          <Text>
            {stakingInfo?.nextRebaseTime
              ? new Date(Number(stakingInfo.nextRebaseTime) * 1000).toLocaleString()
              : '-'}
          </Text>
        </View>
      </View>

      <View gap={8}>
        <View gap={4}>
          <Text variant="title-4">Stake PONDER</Text>
          <View direction="row" gap={8}>
            <input
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Amount to stake"
              type="number"
              className="flex-1"
            />
            <Button
              onClick={handleStake}
              disabled={
                isStaking ||
                !stakeAmount ||
                !ponderBalance ||
                currentStakeAmount > ponderBalance
              }
              loading={isStaking}
              variant={!hasEnoughAllowance(currentStakeAmount) ? 'solid' : 'outline'}
            >
              {hasEnoughAllowance(currentStakeAmount) ? 'Stake' : 'Approve & Stake'}
            </Button>
          </View>
          <Text variant="caption-1" color="neutral">
            Balance: {ponderBalance ? formatUnits(ponderBalance, 18) : '0'} PONDER
          </Text>
        </View>

        <View gap={4}>
          <Text variant="title-4">Unstake PONDER</Text>
          <View direction="row" gap={8}>
            <input
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder="Amount to unstake"
              type="number"
              className="flex-1"
            />
            <Button
              onClick={handleUnstake}
              disabled={
                isUnstaking ||
                !unstakeAmount ||
                !stakingInfo?.userShares ||
                parseUnits(unstakeAmount, 18) > stakingInfo.userShares
              }
              loading={isUnstaking}
            >
              Unstake
            </Button>
          </View>
          <Text variant="caption-1" color="neutral">
            Balance: {stakingInfo ? formatUnits(stakingInfo.userShares, 18) : '0'} xPONDER
          </Text>
        </View>
      </View>
    </View>
  )
}

export default function StakingPage() {
  return (
    <View gap={24} className="max-w-4xl mx-auto p-4">
      <View gap={8}>
        <Text variant="body-1">PONDER Staking</Text>
        <Text>
          Stake your PONDER tokens to earn protocol fees. Staked PONDER (xPONDER)
          automatically compounds your earnings through rebases.
        </Text>
      </View>

      <StakeInterface />
    </View>
  )
}
