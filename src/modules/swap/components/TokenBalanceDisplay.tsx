import React, { useMemo } from 'react'
import { formatNumber, roundDecimal } from '@/src/utils/numbers'
import { formatUnits } from 'viem'
import { Text } from 'reshaped'

export const TokenBalanceDisplay = ({
  tokenInBalance,
  tokenInInfo,
}: {
  tokenInBalance: bigint
  tokenInInfo: { decimals: number; symbol: string }
}) => {
  const formattedBalance = useMemo(() => {
    const roundedBalance = roundDecimal(
      formatUnits(tokenInBalance, tokenInInfo.decimals),
      2
    )
    const tokenSymbol =
      tokenInInfo.symbol.length > 4
        ? `${tokenInInfo.symbol.slice(0, 4)}...`
        : tokenInInfo.symbol

    return {
      balance: formatNumber(roundedBalance),
      symbol: tokenSymbol,
    }
  }, [tokenInBalance, tokenInInfo])

  return (
    <Text color="neutral-faded" variant="body-3">
      {formattedBalance.balance} {formattedBalance.symbol}
    </Text>
  )
}
