'use client'

import { Button, Text, View } from 'reshaped'

interface BridgeActionsProps {
  isApproving: boolean
  isBridging: boolean
  onApprove: () => void
  onBridge: () => void
  allowance: bigint | undefined
  amount: string
  selectedToken: { decimals: number } | null
}

export const BridgeActions = ({
  isApproving,
  isBridging,
  onApprove,
  onBridge,
  allowance,
  amount,
  selectedToken,
}: BridgeActionsProps) => {
  // Safely parse the amount, defaulting to 0 if invalid
  const parsedAmount = selectedToken && amount ? (() => {
    try {
      const floatAmount = parseFloat(amount)
      if (isNaN(floatAmount)) return BigInt(0)
      return BigInt(Math.floor(floatAmount * Math.pow(10, selectedToken.decimals)))
    } catch {
      return BigInt(0)
    }
  })() : BigInt(0)

  const needsApproval = !allowance || allowance < parsedAmount

  const isDisabled = !amount || !selectedToken || isApproving || isBridging || parsedAmount === BigInt(0)

  return (
    <View direction="column" gap={2}>
      {isApproving || isBridging ? (
        <Button
          variant="solid"
          fullWidth
          rounded
          disabled
        >
          <Text>{isApproving ? 'Approving...' : 'Bridging...'}</Text>
        </Button>
      ) : (
        <Button
          variant="solid"
          fullWidth
          rounded
          onClick={needsApproval ? onApprove : onBridge}
          disabled={isDisabled}
        >
          <Text>{needsApproval ? 'Approve' : 'Bridge'}</Text>
        </Button>
      )}
    </View>
  )
} 