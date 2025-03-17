import { useState } from 'react'
import { Text, View, Button, TextField } from 'reshaped'
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

export function StakeInterface() {
  const { address } = useAccount()
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const sdk = usePonderSDK()

  // Get staking info
  const { data: stakingInfo, isLoading: isLoadingInfo } = useStakingInfo(address)

  // Get KOI balance and allowance
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

    console.log('am', amount)

    stake({ amount })
  }

  const handleUnstake = () => {
    if (!unstakeAmount) return
    unstake({
      shares: parseUnits(unstakeAmount, 18),
    })
  }

  const handleStakeAmountChange = ({ value }: { value: string }) => {
    setStakeAmount(value)
  }

  const handleUnstakeAmountChange = ({ value }: { value: string }) => {
    setUnstakeAmount(value)
  }

  const currentStakeAmount = stakeAmount ? parseUnits(stakeAmount, 18) : BigInt(0)

  return (
    <View gap={4} padding={4}>
      <Text variant="title-6" weight="regular">
        Stake KOI
      </Text>
      <View gap={8} borderRadius="large" borderColor="neutral-faded" padding={4}>
        <View direction="row" justify="space-between">
          <Text>Total Staked</Text>
          <Text>{stakingInfo ? formatUnits(stakingInfo.totalStaked, 18) : '0'} KOI</Text>
        </View>

        <View direction="row" justify="space-between">
          <Text>Your Stake</Text>
          <Text>{stakingInfo ? formatUnits(stakingInfo.userShares, 18) : '0'} xKOI</Text>
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

      <View direction="row" gap={8}>
        <View.Item columns={{ s: 12, m: 6 }}>
          <View padding={4} gap={2} borderColor="neutral-faded" borderRadius="large">
            <View gap={4}>
              <Text variant="body-1">Stake KOI</Text>
              <View gap={3}>
                <TextField
                  name="stakeAmount"
                  value={stakeAmount}
                  onChange={handleStakeAmountChange}
                  placeholder="Amount to stake"
                  inputAttributes={{ type: 'number' }}
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
                  fullWidth={false}
                >
                  {hasEnoughAllowance(currentStakeAmount) ? 'Stake' : 'Approve & Stake'}
                </Button>
              </View>
            </View>
            <Text variant="caption-1" color="neutral">
              Balance: {ponderBalance ? formatUnits(ponderBalance, 18) : '0'} KOI
            </Text>
          </View>
        </View.Item>

        <View.Item columns={{ s: 12, m: 6 }}>
          <View padding={4} borderColor="neutral-faded" borderRadius="large" gap={2}>
            <View gap={4}>
              <Text variant="body-1">Unstake KOI</Text>
              <View direction="column" gap={2}>
                <TextField
                  name="unstakeAmount"
                  value={unstakeAmount}
                  onChange={handleUnstakeAmountChange}
                  placeholder="Amount to unstake"
                  inputAttributes={{ type: 'number' }}
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
            </View>

            <Text variant="caption-1" color="neutral">
              Balance: {stakingInfo ? formatUnits(stakingInfo.userShares, 18) : '0'} xKOI
            </Text>
          </View>
        </View.Item>
      </View>
    </View>
  )
}
