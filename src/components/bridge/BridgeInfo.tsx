'use client'

import { Text, View } from 'reshaped'
import { Chain, Token } from '@/src/types'
import { formatUnits } from 'viem'
import { motion } from 'framer-motion'

interface BridgeInfoProps {
  sourceChain: Chain | null
  destChain: Chain | null
  selectedToken: Token | null
  amount: string
  fee: bigint | null
}

const ConfirmationDot = ({ delay }: { delay: number }) => (
  <motion.div
    style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#4CAF50',
      margin: '0 2px',
    }}
    animate={{
      scale: [1, 1.2, 1],
      opacity: [1, 0.5, 1],
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      delay,
    }}
  />
)

const ConfirmationDots = ({ count }: { count: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <ConfirmationDot key={i} delay={i * 0.1} />
    ))}
  </div>
)

const getEstimatedTime = (sourceChain: Chain, destChain: Chain): string => {
  // Ethereum to Bitkub Chain or vice versa
  if ((sourceChain.id === 1 && destChain.id === 96) || (sourceChain.id === 96 && destChain.id === 1)) {
    return '10-30 minutes'
  }
  return '5-15 minutes'
}

const getRequiredConfirmations = (chain: Chain): number => {
  // Ethereum requires more confirmations for security
  if (chain.id === 1) return 12
  // Bitkub Chain requires fewer confirmations
  if (chain.id === 96) return 6
  return 6
}

export const BridgeInfo = ({
  sourceChain,
  destChain,
  selectedToken,
  amount,
  fee,
}: BridgeInfoProps) => {
  if (!sourceChain || !destChain || !selectedToken || !amount) {
    return null
  }

  const requiredConfirmations = getRequiredConfirmations(sourceChain)

  return (
    <View direction="column" gap={2}>
      <Text variant="body-2">Bridge Information</Text>
      <View direction="column" gap={1}>
        <View direction="row" justify="space-between">
          <Text variant="body-2" color="neutral-faded">From</Text>
          <Text variant="body-2">{sourceChain.name}</Text>
        </View>
        <View direction="row" justify="space-between">
          <Text variant="body-2" color="neutral-faded">To</Text>
          <Text variant="body-2">{destChain.name}</Text>
        </View>
        <View direction="row" justify="space-between">
          <Text variant="body-2" color="neutral-faded">Amount</Text>
          <Text variant="body-2">
            {amount} {selectedToken.symbol}
          </Text>
        </View>
        <View direction="row" justify="space-between">
          <Text variant="body-2" color="neutral-faded">Bridge Fee</Text>
          <Text variant="body-2">
            {fee ? `${formatUnits(fee, selectedToken.decimals)} ${selectedToken.symbol}` : 'Calculating...'}
          </Text>
        </View>
        <View direction="row" justify="space-between" align="center">
          <Text variant="body-2" color="neutral-faded">Required Confirmations</Text>
          <ConfirmationDots count={requiredConfirmations} />
        </View>
        <View direction="row" justify="space-between">
          <Text variant="body-2" color="neutral-faded">Estimated Time</Text>
          <Text variant="body-2">{getEstimatedTime(sourceChain, destChain)}</Text>
        </View>
      </View>
    </View>
  )
} 