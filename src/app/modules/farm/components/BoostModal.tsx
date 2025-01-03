import { useState, useCallback } from 'react'
import { View, Text, Button, Modal } from 'reshaped'
import { formatEther, parseEther, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { usePonderSDK } from '@ponderfinance/sdk'

interface BoostModalProps {
  poolId: number
  active: boolean
  onClose: () => void
  ponderRequired: bigint
  currentBoost: bigint
  onBoost: (amount: bigint) => Promise<void>
  isBoostLoading: boolean
}

export default function BoostModal({
  poolId,
  active,
  onClose,
  ponderRequired,
  currentBoost,
  onBoost,
  isBoostLoading,
}: BoostModalProps) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sdk = usePonderSDK()
  const { address } = useAccount()

  const handleAmountChange = (value: string) => {
    setAmount(value)
    setError(null)
  }

  const handleBoost = async () => {
    try {
      if (!amount) {
        setError('Please enter an amount')
        return
      }

      const parsedAmount = parseEther(amount)
      if (parsedAmount <= BigInt(0)) {
        setError('Amount must be greater than 0')
        return
      }

      // Check PONDER balance
      if (address) {
        const balance = await sdk.ponder.balanceOf(address)
        if (parsedAmount > balance) {
          setError('Insufficient PONDER balance')
          return
        }
      }

      await onBoost(parsedAmount)
      setAmount('')
      onClose()
    } catch (err) {
      console.error('Boost error:', err)
      setError('Failed to boost. Please try again.')
    }
  }

  const handleMax = async () => {
    if (address) {
      const balance = await sdk.ponder.balanceOf(address)
      setAmount(formatEther(balance))
    }
  }

  return (
    <Modal active={active} onClose={onClose}>
      <View gap={4} padding={4}>
        <Text variant="title-3">Boost Pool {poolId}</Text>

        <View gap={2}>
          <Text variant="caption-1">Current PONDER Staked</Text>
          <Text>{formatEther(currentBoost)} PONDER</Text>
        </View>

        <View gap={2}>
          <Text variant="caption-1">Required for Max Boost</Text>
          <Text>{formatEther(ponderRequired)} PONDER</Text>
        </View>

        <View gap={2}>
          <View direction="row" justify="space-between">
            <Text variant="caption-1">Amount to Stake</Text>
            <Button size="small" variant="outline" onClick={handleMax}>
              MAX
            </Button>
          </View>

          <input
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="Enter PONDER amount"
            type="number"
            min="0"
            step="0.000000000000000001"
          />

          {error && (
            <Text variant="caption-1" color="warning">
              {error}
            </Text>
          )}
        </View>

        <View direction="row" gap={2}>
          <Button variant="outline" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button
            onClick={handleBoost}
            disabled={isBoostLoading || !amount}
            loading={isBoostLoading}
            fullWidth
          >
            Boost
          </Button>
        </View>
      </View>
    </Modal>
  )
}
