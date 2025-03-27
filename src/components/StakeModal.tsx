import { useState, useCallback, useRef, useEffect } from 'react'
import { Modal, View, Text, TextField, Button, Dismissible, Icon, useToast } from 'reshaped'
import { formatEther, parseEther, type Address } from 'viem'
import {
  usePonderSDK,
  useStakeInfo,
  useStake,
  useUnstake,
  useTokenBalance,
  useTokenApproval,
} from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import { X } from '@phosphor-icons/react'

interface StakeModalProps {
  poolId: number
  lpToken: Address
  position: {
    userLPBalance: bigint
    token0: { symbol: string }
    token1: { symbol: string }
  }
  active: boolean
  onClose: () => void
}

export default function StakeModal({
  poolId,
  lpToken,
  position,
  active,
  onClose,
}: StakeModalProps) {
  const sdk = usePonderSDK()
  const { address } = useAccount()
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const [amount, setAmount] = useState('')
  const [isStaking, setIsStaking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track explicit approval requests for this amount to avoid infinite loops
  const [approvalRequested, setApprovalRequested] = useState(false)

  const { data: stakeInfo } = useStakeInfo(poolId, address)
  const { allowance, approve, isApproved } = useTokenApproval(
    lpToken,
    sdk.masterChef.address
  )
  const { mutate: stake, isPending: isStakeLoading } = useStake()
  const { mutate: unstake, isPending: isUnstakeLoading } = useUnstake()

  // Reset approval requested state when amount changes
  useEffect(() => {
    setApprovalRequested(false);
  }, [amount]);

  // Simplified approval handler - only handles the approval transaction
  const handleApprove = useCallback(async () => {
    if (!amount || !address) {
      setError('Please enter an amount')
      return
    }

    try {
      setError(null)
      const parsedAmount = parseEther(amount)

      // Prevent double approvals
      setApprovalRequested(true)

      // Execute approval
      await approve.mutateAsync({
        token: lpToken,
        spender: sdk.masterChef.address,
        amount: parsedAmount,
      })

      // Force allowance to refresh after approval
      await allowance.refetch()

    } catch (err) {
      if (err instanceof Error && err.message === 'Already approved') {
        // If already approved, mark as successful
        setApprovalRequested(true)
      } else {
        console.error('Failed to approve:', err)
        setError(err instanceof Error ? err.message : 'Approval failed')
        // Reset approval requested flag on error
        setApprovalRequested(false)
      }
    }
  }, [amount, address, approve, allowance, lpToken, sdk.masterChef.address])

  const handleSubmit = useCallback(async () => {
    if (!amount || !address) {
      setError('Please enter an amount')
      return
    }

    try {
      setError(null)
      const parsedAmount = parseEther(amount)

      // Additional validation to prevent submitting with zero tokens
      if (parsedAmount <= BigInt(0)) {
        setError('Amount must be greater than 0')
        return
      }

      if (isStaking) {
        // Check if user has LP tokens to stake
        if (position.userLPBalance <= BigInt(0)) {
          setError('You have no LP tokens to stake')
          return
        }

        // Make sure amount is not greater than available balance
        if (parsedAmount > position.userLPBalance) {
          setError('Insufficient LP balance')
          return
        }

        // Always double-check approval directly
        if (!isApproved(parsedAmount)) {
          setError('Token approval required first')
          return
        }

        // Use callback pattern instead of await
        stake(
          {
            poolId,
            amount: parsedAmount,
          },
          {
            onSuccess: () => {
              setAmount('')
              onClose()

              // Show success toast
              const id = toast.show({
                color: 'positive',
                title: 'Stake successful',
                text: 'You have successfully staked your LP tokens.',
                actionsSlot: (
                  <Button onClick={() => toast.hide(id)} variant="ghost">
                    <Icon svg={X} />
                  </Button>
                ),
              })
            },
            onError: (err) => {
              console.error('Failed to stake:', err)
              setError(err instanceof Error ? err.message : 'Transaction failed')
            },
          }
        )
      } else {
        // Check if user has staked LP tokens to unstake
        if (!stakeInfo?.amount || stakeInfo.amount <= BigInt(0)) {
          setError('You have no staked LP tokens to unstake')
          return
        }

        // Make sure amount is not greater than staked balance
        if (parsedAmount > stakeInfo.amount) {
          setError('Insufficient staked LP balance')
          return
        }

        // Use callback pattern instead of await
        unstake(
          {
            poolId,
            amount: parsedAmount,
          },
          {
            onSuccess: () => {
              setAmount('')
              onClose()

              // Show success toast
              const id = toast.show({
                color: 'positive',
                title: 'Unstake successful',
                text: 'You have successfully unstaked your LP tokens.',
                actionsSlot: (
                  <Button onClick={() => toast.hide(id)} variant="ghost">
                    <Icon svg={X} />
                  </Button>
                ),
              })
            },
            onError: (err) => {
              console.error('Failed to unstake:', err)
              setError(err instanceof Error ? err.message : 'Transaction failed')
            },
          }
        )
      }
    } catch (err) {
      console.error('Failed to stake/unstake:', err)
      setError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }, [amount, address, isStaking, stake, unstake, poolId, onClose, isApproved, toast])

  // Handle switching between stake/unstake modes
  const handleStakingModeChange = useCallback((staking: boolean) => {
    if (staking !== isStaking) {
      setAmount('')
      setError(null)
      setApprovalRequested(false)
    }
    setIsStaking(staking)
  }, [isStaking])

  const maxAmount = isStaking ? position.userLPBalance : stakeInfo?.amount || BigInt(0)

  const handleMaxClick = useCallback(() => {
    setAmount(formatEther(maxAmount))
    setApprovalRequested(false)
  }, [maxAmount])

  const handleAmountChange = useCallback(({ value }: { value: string }) => {
    setError(null)
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }, [])

  const parsedAmount = amount ? parseEther(amount) : BigInt(0)

  // Simple check if current amount is approved
  const amountIsApproved = isApproved && parsedAmount > BigInt(0) && isApproved(parsedAmount);

  // Need approval if staking and not approved (unless we just requested approval)
  const needsApproval = isStaking && parsedAmount > BigInt(0) && !amountIsApproved && !approvalRequested;

  const isLoading = isStakeLoading || isUnstakeLoading || approve.isPending

  // Improved validation to check if user actually has tokens
  const isValid = amount &&
    parsedAmount > BigInt(0) &&
    parsedAmount <= maxAmount &&
    (isStaking ? position.userLPBalance > BigInt(0) : stakeInfo?.amount && stakeInfo.amount > BigInt(0))

  // Reset states when modal opens/closes
  useEffect(() => {
    if (active) {
      // Focus the input field when modal opens
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)

      // Set initial staking mode based on token availability
      if (position.userLPBalance <= BigInt(0) && stakeInfo?.amount && stakeInfo.amount > BigInt(0)) {
        // If no LP tokens but has staked tokens, select unstake tab
        setIsStaking(false);
      } else if (position.userLPBalance > BigInt(0) && (!stakeInfo?.amount || stakeInfo.amount <= BigInt(0))) {
        // If has LP tokens but no staked tokens, select stake tab
        setIsStaking(true);
      }
      // Otherwise keep current selection
    } else {
      // Clear states when modal closes
      setAmount('')
      setError(null)
      setApprovalRequested(false)
    }
  }, [active, position.userLPBalance, stakeInfo?.amount])

  // Log for debugging
  useEffect(() => {
    if (amount && isApproved) {
      const parsedAmt = parseEther(amount);
      console.log('Current approval state:', {
        amount,
        approvalRequested,
        isApproved: isApproved(parsedAmt),
        needsApproval,
        allowanceData: allowance.data ? formatEther(allowance.data) : 'none'
      });
    }
  }, [amount, approvalRequested, isApproved, needsApproval, allowance.data]);

  return (
    <Modal
      active={active}
      onClose={onClose}
      size="400px"
      padding={6}
      ariaLabel={`${isStaking ? 'Stake' : 'Unstake'} LP tokens`}
    >
      <View gap={6}>
        <Dismissible onClose={onClose} closeAriaLabel="Close modal">
          <Modal.Title>
            {isStaking ? 'Stake' : 'Unstake'} {position.token0.symbol}/
            {position.token1.symbol} LP
          </Modal.Title>
        </Dismissible>

        <View gap={4}>
          <Button.Group>
            <Button
              variant={isStaking ? 'solid' : 'outline'}
              onClick={() => handleStakingModeChange(true)}
              disabled={position.userLPBalance <= BigInt(0)}
              fullWidth
            >
              Stake
            </Button>
            <Button
              variant={!isStaking ? 'solid' : 'outline'}
              onClick={() => handleStakingModeChange(false)}
              disabled={!stakeInfo?.amount || stakeInfo.amount <= BigInt(0)}
              fullWidth
            >
              Unstake
            </Button>
          </Button.Group>

          <View gap={2}>
            <View direction="row" align="center" justify="space-between">
              <Text>Amount</Text>
              <Text color="neutral-faded">Balance: {formatEther(maxAmount)} LP</Text>
            </View>

            <View direction="row" gap={2}>
              <TextField
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.0"
                name="amount"
                inputAttributes={{
                  ref: inputRef,
                  inputMode: 'decimal',
                  autoComplete: 'off',
                  pattern: '^[0-9]*[.,]?[0-9]*$',
                }}
              />
              <Button variant="outline" onClick={handleMaxClick} disabled={maxAmount <= BigInt(0)}>
                MAX
              </Button>
            </View>
          </View>

          {isStaking && position.userLPBalance <= BigInt(0) && (
            <Text variant="caption-1" color="critical" align="center">
              You don't have any LP tokens to stake
            </Text>
          )}

          {!isStaking && (!stakeInfo?.amount || stakeInfo.amount <= BigInt(0)) && (
            <Text variant="caption-1" color="critical" align="center">
              You don't have any staked LP tokens to unstake
            </Text>
          )}

          <Button
            onClick={needsApproval ? handleApprove : handleSubmit}
            disabled={!isValid || isLoading || maxAmount <= BigInt(0)}
            loading={isLoading}
            fullWidth
          >
            {needsApproval
              ? 'Approve LP Token'
              : (isStaking ? 'Stake LP' : 'Unstake LP')
            }
          </Button>
        </View>
      </View>
    </Modal>
  )
}
