'use client'

import { Button, Text, View } from 'reshaped'
import { Token } from '@/src/types'
import { formatUnits } from 'viem'
import { useAccount, useBalance, useChainId } from 'wagmi'

interface AmountInputProps {
  amount: string
  onAmountChange: (amount: string) => void
  selectedToken: Token | null
  sourceChain: { id: number } | null
}

export const AmountInput = ({
  amount,
  onAmountChange,
  selectedToken,
  sourceChain,
}: AmountInputProps) => {
  const { address } = useAccount()
  const chainId = useChainId()
  
  // Ensure token address is properly formatted
  const tokenAddress = selectedToken?.address as `0x${string}` | undefined
  
  // Use wagmi's useBalance hook to get token balance
  const { data: balance, error, isError, isLoading } = useBalance({
    address,
    token: tokenAddress,
    chainId: sourceChain?.id,
  })

  console.log('AmountInput hook params:', {
    tokenAddress,
    userAddress: address,
    selectedToken,
    sourceChainId: sourceChain?.id,
    currentChainId: chainId,
    balance: balance?.formatted,
    error: error?.message,
    isError,
    isLoading
  })

  const handleMaxClick = () => {
    if (!selectedToken || !balance) return
    onAmountChange(balance.formatted)
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!value || /^\d*\.?\d*$/.test(value)) {
      onAmountChange(value)
    }
  }

  return (
    <View direction="column" gap={2}>
      <View direction="row" justify="space-between" align="center">
        <Text variant="body-2">Amount</Text>
        <Button
          variant="ghost"
          size="small"
          onClick={handleMaxClick}
          disabled={!balance}
        >
          <Text variant="caption-2">MAX</Text>
        </Button>
      </View>
      <View direction="row" gap={2} align="center">
        <input
          type="text"
          value={amount}
          onChange={handleAmountChange}
          placeholder="0.0"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            outline: 'none',
            color: 'var(--rs-color-neutral)',
          }}
        />
        {selectedToken && (
          <Text variant="body-1">{selectedToken.symbol}</Text>
        )}
      </View>
      {selectedToken && (
        <Text variant="caption-2" color="neutral-faded">
          Balance: {balance?.formatted || '0.00'} {selectedToken.symbol}
          {isLoading && ' (Loading...)'}
          {isError && ` (Error: ${error?.message})`}
          {sourceChain?.id !== chainId && ' (Switch network to view balance)'}
        </Text>
      )}
    </View>
  )
} 