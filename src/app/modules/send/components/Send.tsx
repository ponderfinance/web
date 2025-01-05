import React, { useState, useEffect, useMemo } from 'react'
import { Text, Button, View, Actionable } from 'reshaped'
import { type Address, formatUnits, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import {
  useGasEstimate,
  useTokenBalance,
  useTokenInfo,
  useTokenAllowance,
  useTransaction,
  usePonderSDK,
} from '@ponderfinance/sdk'
import { usePrivy } from '@privy-io/react-auth'
import { TokenBalanceDisplay } from '@/src/app/modules/swap/components/TokenBalanceDisplay'
import { CURRENT_CHAIN } from '@/src/app/constants/chains'
import { InterfaceTabs } from '@/src/app/modules/swap/components/InterfaceTabs'

interface SendInterfaceProps {
  defaultTokenToSend?: Address
  className?: string
}

const MAX_UINT256 = BigInt(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)

const DEFAULT_DEADLINE_MINUTES = 20
const KUB_ADDRESS = '0x0000000000000000000000000000000000000000'

export function SendInterface({ defaultTokenToSend, className }: SendInterfaceProps) {
  const sdk = usePonderSDK()
  const { address: account } = useAccount()

  // Form state
  const [tokenToSend, setTokenToSend] = useState<Address | undefined>(defaultTokenToSend)
  const [recipientAddress, setRecipientAddress] = useState<string>('')
  const [amountToSend, setAmountToSend] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { login } = usePrivy()

  // Token information
  const { data: tokenInfo } = useTokenInfo(tokenToSend || ('' as Address))
  const { data: tokenBalance } = useTokenBalance(tokenToSend || ('' as Address), account)

  const parsedAmount = useMemo(() => {
    if (!tokenInfo || !amountToSend) return BigInt(0)
    try {
      return parseUnits(amountToSend, tokenInfo.decimals)
    } catch {
      return BigInt(0)
    }
  }, [amountToSend, tokenInfo])

  // Gas estimation
  const { data: gasEstimate } = useGasEstimate(
    account
      ? {
          to: recipientAddress as Address,
          value: parsedAmount,
          data: '0x',
        }
      : undefined,
    Boolean(account && recipientAddress && parsedAmount > BigInt(0))
  )

  const [txHash, setTxHash] = useState<string>()
  const { data: txStatus } = useTransaction(txHash as `0x${string}`)

  // Validation states
  const isValidSend = useMemo(() => {
    if (!parsedAmount || !tokenBalance || !account || !recipientAddress) return false

    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(recipientAddress)
    return parsedAmount <= tokenBalance && parsedAmount > BigInt(0) && isValidAddress
  }, [parsedAmount, tokenBalance, account, recipientAddress])

  const handleAmountInput = (value: string) => {
    if (!tokenInfo) return
    setError(null)

    // Validate numeric input with decimals
    if (!/^\d*\.?\d*$/.test(value)) return

    const parts = value.split('.')
    if (parts[1] && parts[1].length > tokenInfo.decimals) return

    // Validate maximum amount
    try {
      const parsedAmount = parseUnits(value || '0', tokenInfo.decimals)
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
    if (!account || !parsedAmount || !tokenToSend || !recipientAddress || !sdk) return
    setError(null)
    setIsProcessing(true)

    try {
      const tx = await sdk.walletClient?.sendTransaction({
        to: recipientAddress as Address,
        value: parsedAmount,
        account,
        chain: CURRENT_CHAIN,
      })

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

  return (
    <View align="center" width="100%" className={className}>
      <View width={{ s: '100%', m: '480px' }}>
        <View padding={2} gap={2} borderRadius="large">
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

                <Button
                  onClick={() => {
                    /* Token selector integration point */
                  }}
                  variant="outline"
                  disabled={isProcessing}
                  rounded={true}
                >
                  {tokenInfo?.symbol || 'Select Token'}
                </Button>
              </View>
              <View>
                {tokenBalance && tokenInfo && (
                  <View direction="row" align="center" justify="end" gap={2}>
                    <TokenBalanceDisplay
                      tokenInBalance={tokenBalance}
                      tokenInInfo={tokenInfo}
                    />
                    {tokenBalance > BigInt(0) && (
                      <Actionable
                        onClick={() => {
                          if (tokenInfo && tokenBalance) {
                            setAmountToSend(formatUnits(tokenBalance, tokenInfo.decimals))
                          }
                        }}
                      >
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
                  Invalid Send
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
