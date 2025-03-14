import React, { useState, useEffect, useMemo } from 'react'
import { Text, Button, View, Actionable } from 'reshaped'
import {
  type Address,
  formatUnits,
  parseUnits,
  isAddress,
  encodeFunctionData,
} from 'viem'
import { useAccount, useBalance } from 'wagmi'
import {
  useGasEstimate,
  useTokenBalance,
  useTokenInfo,
  useTokenAllowance,
  useTransaction,
  usePonderSDK,
} from '@ponderfinance/sdk'
import { usePrivy } from '@privy-io/react-auth'
import { TokenBalanceDisplay } from '@/src/modules/swap/components/TokenBalanceDisplay'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { InterfaceTabs } from '@/src/modules/swap/components/InterfaceTabs'
import TokenSelector from '@/src/components/TokenSelector'
import { formatNumber, roundDecimal } from '@/src/utils/numbers'

interface SendInterfaceProps {
  defaultTokenToSend?: Address
  className?: string
}

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const

const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)

const KUB_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export function SendInterface({
  defaultTokenToSend = KUB_ADDRESS,
  className,
}: SendInterfaceProps) {
  const sdk = usePonderSDK()
  const { address: account } = useAccount()

  // Form state
  const [tokenToSend, setTokenToSend] = useState<Address>(defaultTokenToSend)
  const [recipientAddress, setRecipientAddress] = useState<string>('')
  const [amountToSend, setAmountToSend] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { login } = usePrivy()

  // Helper function to check if token is native KUB
  const isNativeKUB = useMemo(() => {
    return !!tokenToSend && tokenToSend.toLowerCase() === KUB_ADDRESS.toLowerCase()
  }, [tokenToSend])

  // Token information - skip for native KUB
  const { data: tokenInfo } = useTokenInfo(!isNativeKUB ? tokenToSend : ('' as Address))

  // Handle both ERC20 and native KUB balances
  const { data: tokenBalance } = useTokenBalance(
    !isNativeKUB ? tokenToSend : ('' as Address),
    account
  )

  // Fetch native KUB balance
  const { data: nativeBalance } = useBalance({
    address: account,
  })

  // Determine the effective balance based on token type
  const effectiveBalance = useMemo(() => {
    if (!tokenToSend) return BigInt(0)

    if (isNativeKUB) {
      return nativeBalance?.value || BigInt(0)
    }

    return tokenBalance ?? BigInt(0)
  }, [tokenToSend, tokenBalance, nativeBalance, isNativeKUB])

  const parsedAmount = useMemo(() => {
    if ((!tokenInfo && !isNativeKUB) || !amountToSend) return BigInt(0)

    try {
      // For native KUB, use 18 decimals
      const decimals = isNativeKUB ? 18 : tokenInfo!.decimals
      return parseUnits(amountToSend, decimals)
    } catch {
      return BigInt(0)
    }
  }, [amountToSend, tokenInfo, isNativeKUB])

  // Gas estimation for native token or ERC20
  const { data: gasEstimate } = useGasEstimate(
    account && isAddress(recipientAddress)
      ? {
          to: isNativeKUB ? (recipientAddress as Address) : tokenToSend,
          value: isNativeKUB ? parsedAmount : BigInt(0),
          data: isNativeKUB
            ? '0x'
            : encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [recipientAddress as Address, parsedAmount],
              }),
        }
      : undefined,
    Boolean(account && recipientAddress && parsedAmount > BigInt(0))
  )

  const [txHash, setTxHash] = useState<string>()
  const { data: txStatus } = useTransaction(txHash as `0x${string}`)

  // Validation states
  const isValidSend = useMemo(() => {
    if (!parsedAmount || !effectiveBalance || !account || !recipientAddress) return false
    if (!isAddress(recipientAddress)) return false

    // Convert effectiveBalance to BigInt to ensure type safety
    const balanceBigInt = BigInt(effectiveBalance.toString())

    // For native KUB, keep some for gas
    if (isNativeKUB) {
      const gasBuffer = gasEstimate?.estimate
        ? BigInt(gasEstimate.estimate.toString())
        : parseUnits('0.01', 18) // 0.01 KUB as buffer if estimate not available

      return parsedAmount <= balanceBigInt - gasBuffer && parsedAmount > BigInt(0)
    }

    return parsedAmount <= balanceBigInt && parsedAmount > BigInt(0)
  }, [
    parsedAmount,
    effectiveBalance,
    account,
    recipientAddress,
    isNativeKUB,
    gasEstimate,
  ])

  const handleAmountInput = (value: string) => {
    if (!tokenInfo && !isNativeKUB) return
    setError(null)

    // Validate numeric input with decimals
    if (!/^\d*\.?\d*$/.test(value)) return

    // For native KUB, use 18 decimals
    const decimals = isNativeKUB ? 18 : tokenInfo!.decimals

    const parts = value.split('.')
    if (parts[1] && parts[1].length > decimals) return

    // Validate maximum amount
    try {
      const parsedAmount = parseUnits(value || '0', decimals)
      if (parsedAmount > MAX_UINT256) return
    } catch {
      return
    }

    setAmountToSend(value)
  }

  const handleAddressInput = (value: string) => {
    setError(null)
    setRecipientAddress(value)
  }

  const handleSend = async () => {
    if (!account || !parsedAmount || !isAddress(recipientAddress) || !sdk) return
    setError(null)
    setIsProcessing(true)

    try {
      let tx: `0x${string}` | undefined

      if (isNativeKUB) {
        // Native token transfer
        tx = await sdk.walletClient?.sendTransaction({
          to: recipientAddress as Address,
          value: parsedAmount,
          account,
          chain: CURRENT_CHAIN,
        })
      } else {
        // ERC20 transfer
        tx = await sdk.walletClient?.writeContract({
          address: tokenToSend,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipientAddress as Address, parsedAmount],
          account,
          chain: CURRENT_CHAIN,
        })
      }

      setTxHash(tx)
      await sdk.publicClient.waitForTransactionReceipt({
        hash: tx!,
        confirmations: 1,
      })

      setAmountToSend('')
      setRecipientAddress('')
    } catch (err: any) {
      console.error('Send error:', err)
      setError(parseSendError(err))
    } finally {
      setIsProcessing(false)
    }
  }

  const parseSendError = (error: any): string => {
    const message = error.message || error.toString()
    if (message.includes('insufficient funds')) {
      return 'Insufficient funds for transfer'
    }
    if (message.includes('rejected')) {
      return 'Transaction rejected by user'
    }
    if (message.includes('exceeds balance')) {
      return 'Amount exceeds token balance'
    }
    if (message.includes('transfer amount exceeds allowance')) {
      return 'Transfer amount exceeds allowance'
    }
    return `Send failed: ${message}`
  }

  // Reset on successful transaction
  useEffect(() => {
    if (txStatus?.state === 'confirmed') {
      setAmountToSend('')
      setTxHash(undefined)
      setError(null)
    }
  }, [txStatus])

  // Handle max button click
  const handleMaxAmount = () => {
    if (!effectiveBalance) return

    // For native KUB, use 18 decimals and leave some for gas
    if (isNativeKUB) {
      const decimals = 18
      const gasBuffer = gasEstimate?.estimate || parseUnits('0.01', 18)
      const maxAmount = effectiveBalance - gasBuffer

      if (maxAmount > BigInt(0)) {
        setAmountToSend(formatUnits(maxAmount, decimals))
      }
    } else if (tokenInfo) {
      // For ERC20 tokens
      setAmountToSend(formatUnits(effectiveBalance, tokenInfo.decimals))
    }
  }

  return (
    <View align="center" width="100%" className={className}>
      <View width={{ s: '100%', m: '480px' }}>
        <View gap={2} borderRadius="large">
          <InterfaceTabs />
          <View maxHeight="600px" overflow="auto" gap={1}>
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              borderColor="neutral-faded"
            >
              <Text color="neutral-faded" variant="body-3">
                You're sending
              </Text>
              <View direction="row" gap={8} wrap={false}>
                <View grow={true} align="center">
                  <input
                    value={amountToSend}
                    onChange={(e) => handleAmountInput(e.target.value)}
                    placeholder="0"
                    disabled={!tokenToSend}
                    className="flex w-full h-full text-4xl bg-[rgba(0,0,0,0)] focus:outline-0"
                  />
                </View>

                <TokenSelector
                  onSelectToken={setTokenToSend}
                  tokenAddress={tokenToSend}
                />
              </View>
              <View>
                {effectiveBalance && (
                  <View direction="row" align="center" justify="end" gap={2}>
                    {/* Display balance based on whether it's native KUB or ERC20 */}
                    {isNativeKUB ? (
                      <Text color="neutral-faded" variant="body-3" maxLines={1}>
                        {formatNumber(roundDecimal(formatUnits(effectiveBalance, 18), 2))}{' '}
                        KUB
                      </Text>
                    ) : (
                      tokenInfo && (
                        <TokenBalanceDisplay
                          tokenInBalance={effectiveBalance}
                          tokenInInfo={tokenInfo}
                        />
                      )
                    )}
                    {effectiveBalance > BigInt(0) && (
                      <Actionable onClick={handleMaxAmount}>
                        <View
                          backgroundColor="primary-faded"
                          padding={1}
                          borderRadius="circular"
                        >
                          <Text variant="caption-2" color="primary" weight="bold">
                            MAX
                          </Text>
                        </View>
                      </Actionable>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Recipient Address Section */}
            <View
              gap={2}
              padding={4}
              paddingTop={6}
              paddingBottom={6}
              borderRadius="large"
              backgroundColor="elevation-base"
            >
              <Text color="neutral-faded" variant="body-3">
                To
              </Text>
              <View direction="row" gap={8} wrap={false}>
                <input
                  value={recipientAddress}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  placeholder="Wallet address"
                  className="flex w-full h-full text-xl bg-[rgba(0,0,0,0)] focus:outline-0"
                />
              </View>
            </View>

            {/* Transaction Details */}
            {gasEstimate && (
              <View gap={4} className="bg-gray-50 p-4 rounded mt-4">
                <View direction="row" justify="space-between">
                  <Text>Network Fee</Text>
                  <Text>{gasEstimate.estimateInKUB} KUB</Text>
                </View>
              </View>
            )}

            {/* Error Display */}
            {error && (
              <Text color="critical" align="center" className="mt-4">
                {error}
              </Text>
            )}

            {/* Action Button */}
            <View gap={4} className="mt-4">
              {!account ? (
                <Button
                  fullWidth
                  size="large"
                  variant="solid"
                  color="primary"
                  /*//@ts-ignore*/
                  onClick={login}
                >
                  Connect Wallet
                </Button>
              ) : !tokenToSend ? (
                <Button fullWidth size="large" disabled>
                  Select Token
                </Button>
              ) : !amountToSend || !recipientAddress ? (
                <Button fullWidth size="large" disabled>
                  Enter Amount and Recipient
                </Button>
              ) : !isValidSend ? (
                <Button fullWidth size="large" disabled>
                  {isNativeKUB && parsedAmount > effectiveBalance
                    ? 'Insufficient KUB (Keep some for gas)'
                    : 'Invalid Send'}
                </Button>
              ) : isProcessing || (!!txHash && txStatus?.state === 'pending') ? (
                <Button fullWidth size="large" loading disabled>
                  Sending...
                </Button>
              ) : (
                <Button
                  fullWidth
                  size="large"
                  disabled={!isValidSend || isProcessing}
                  onClick={handleSend}
                  variant="solid"
                  color="primary"
                  attributes={{ style: { borderRadius: 'var(--rs-radius-large)' } }}
                >
                  Send
                </Button>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

export default SendInterface
