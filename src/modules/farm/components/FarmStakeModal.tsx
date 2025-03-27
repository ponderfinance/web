import { useState, useCallback, useRef, useEffect } from 'react'
import { Modal, View, Text, TextField, Button, useToggle, Dismissible } from 'reshaped'
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

export default function FarmStakeModal({
  poolId,
  lpToken,
  position,
  active,
  onClose,
}: StakeModalProps) {
  const sdk = usePonderSDK()
  const { address } = useAccount()
  const inputRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [isStaking, setIsStaking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvalTrigger, setApprovalTrigger] = useState(0)

  const { data: stakeInfo } = useStakeInfo(poolId, address)
  const { allowance, approve, isApproved } = useTokenApproval(
    lpToken,
    sdk.masterChef.address,
    approvalTrigger
  )
  const { mutate: stake, isPending: isStakeLoading } = useStake()
  const { mutate: unstake, isPending: isUnstakeLoading } = useUnstake()

  const handleSubmit = useCallback(async () => {
    if (!amount || !address) {
      setError('Please enter an amount')
      return
    }

    try {
      setError(null)
      const parsedAmount = parseEther(amount)

      if (isStaking) {
        if (!isApproved(parsedAmount)) {
          try {
            await approve.mutate({
              token: lpToken,
              spender: sdk.masterChef.address,
              amount: parsedAmount,
            })
            setApprovalTrigger(prev => prev + 1)
            return
          } catch (err) {
            setError('Approval failed')
            return
          }
        }

        await stake({
          poolId,
          amount: parsedAmount,
        })
      } else {
        await unstake({
          poolId,
          amount: parsedAmount,
        })
      }

      setAmount('')
      onClose()
    } catch (err) {
      console.error('Failed to stake/unstake:', err)
      setError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }, [
    amount,
    address,
    isStaking,
    isApproved,
    approve,
    stake,
    unstake,
    lpToken,
    sdk.masterChef.address,
    poolId,
    onClose,
  ])

  useEffect(() => {
    if (isStaking && amount) {
      const parsedAmount = parseEther(amount)
      const needsApproval = !isApproved(parsedAmount)
    }
  }, [isApproved, isStaking, amount, approvalTrigger])

  const maxAmount = isStaking ? position.userLPBalance : stakeInfo?.amount || BigInt(0)

  const handleMaxClick = useCallback(() => {
    setAmount(formatEther(maxAmount))
  }, [maxAmount])

  const handleAmountChange = useCallback(({ value }: { value: string }) => {
    setError(null)
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }, [])

  const parsedAmount = amount ? parseEther(amount) : BigInt(0)
  const needsApproval = isStaking && !isApproved(parsedAmount)
  const isLoading = isStakeLoading || isUnstakeLoading || approve.isPending

  const isValid = amount && parsedAmount <= maxAmount

  const handleOpen = useCallback(() => {
    setError(null)
    inputRef.current?.focus()
  }, [])

  return (
    <Modal
      active={active}
      onClose={onClose}
      onOpen={handleOpen}
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
              onClick={() => setIsStaking(true)}
              fullWidth
            >
              Stake
            </Button>
            <Button
              variant={!isStaking ? 'solid' : 'outline'}
              onClick={() => setIsStaking(false)}
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
              <Button variant="outline" onClick={handleMaxClick}>
                MAX
              </Button>
            </View>
          </View>

          {error && <Text variant="caption-1">{error}</Text>}

          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            loading={isLoading}
            fullWidth
          >
            {needsApproval ? 'Approve LP Token' : isStaking ? 'Stake LP' : 'Unstake LP'}
          </Button>
        </View>
      </View>
    </Modal>
  )
} 