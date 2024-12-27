import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { useSwap, useContribute, usePonderSDK } from '@ponderfinance/sdk'
import { formatEther, parseEther, type Address } from 'viem'

interface LaunchContributionCardProps {
  launchId: bigint
}

type ContributionToken = 'PONDER' | 'KUB'

interface LaunchInfo {
  totalRaised: bigint
  launched: boolean
  tokenAddress: Address
  name: string
  ponderMetrics?: {
    requiredAmount: bigint
    lpAllocation: bigint
    protocolLPAllocation: bigint
    burnAmount: bigint
  }
}

export default function LaunchContributionCard({
  launchId,
}: LaunchContributionCardProps) {
  const sdk = usePonderSDK()
  const contribute = useContribute()
  const swap = useSwap()

  const [selectedToken, setSelectedToken] = useState<ContributionToken>('PONDER')
  const [amount, setAmount] = useState<string>('')
  const [launchInfo, setLaunchInfo] = useState<LaunchInfo | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)
  const [isApproving, setIsApproving] = useState(false)
  const [hasApproved, setHasApproved] = useState(false)
  const [balances, setBalances] = useState<{
    ponder: bigint
    kub: bigint
  }>({
    ponder: BigInt(0),
    kub: BigInt(0),
  })

  // Fetch launch info and required PONDER
  useEffect(() => {
    const fetchLaunchInfo = async () => {
      if (!sdk?.walletClient?.account) return

      try {
        setIsLoadingMetrics(true)

        // First get basic launch info
        const info = await sdk.launcher.getLaunchInfo(launchId)

        // Set initial info without metrics
        setLaunchInfo({
          totalRaised: info.totalRaised,
          launched: info.launched,
          tokenAddress: info.tokenAddress as Address,
          name: info.name,
        })

        // Then fetch PONDER metrics
        const metrics = await sdk.launcher.calculatePonderRequirements()

        // Update with metrics
        setLaunchInfo((prev) =>
          prev
            ? {
                ...prev,
                ponderMetrics: metrics,
              }
            : null
        )
      } catch (err) {
        console.error('Failed to fetch launch info:', err)
      } finally {
        setIsLoadingMetrics(false)
      }
    }

    fetchLaunchInfo()
  }, [sdk?.walletClient?.account, launchId])

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!sdk?.walletClient?.account) return

      try {
        const [ponderBalance, kubBalance] = await Promise.all([
          sdk.ponder.balanceOf(sdk.walletClient.account.address),
          sdk.publicClient.getBalance({ address: sdk.walletClient.account.address }),
        ])

        setBalances({
          ponder: ponderBalance,
          kub: kubBalance,
        })
      } catch (err) {
        console.error('Failed to fetch balances:', err)
      }
    }

    fetchBalances()
  }, [sdk?.walletClient?.account])

  // Check approval status
  useEffect(() => {
    const checkApproval = async () => {
      if (!sdk?.walletClient?.account || !amount || selectedToken !== 'PONDER') {
        setHasApproved(false)
        return
      }

      try {
        const contributionAmount = parseEther(amount)

        const allowance = await sdk.ponder.allowance(
          sdk.walletClient.account.address,
          sdk.launcher.address
        )

        setHasApproved(allowance >= contributionAmount)
      } catch (err) {
        console.error('Failed to check approval:', err)
        setHasApproved(false)
      }
    }

    checkApproval()
  }, [sdk?.walletClient?.account, amount, selectedToken])

  const handleApprove = async () => {
    if (!sdk?.walletClient?.account || !amount) return

    try {
      setIsApproving(true)
      const amountToApprove = parseEther(amount)

      const tx = await sdk.ponder.approve(sdk.launcher.address, amountToApprove)

      const receipt = await sdk.publicClient.waitForTransactionReceipt({ hash: tx })

      setHasApproved(true)
    } catch (err) {
      console.error('Approval failed:', err)
      throw err
    } finally {
      setIsApproving(false)
    }
  }

  const handleContribute = async () => {
    if (!sdk?.walletClient?.account || !amount || !launchInfo?.ponderMetrics) return

    try {
      const contributionAmount = parseEther(amount)

      if (selectedToken === 'PONDER') {
        // Check PONDER balance and allowance
        const [ponderBalance, allowance] = await Promise.all([
          sdk.ponder.balanceOf(sdk.walletClient.account.address),
          sdk.ponder.allowance(sdk.walletClient.account.address, sdk.launcher.address),
        ])

        if (ponderBalance < contributionAmount) {
          throw new Error('Insufficient PONDER balance')
        }

        // Check if we need approval for the contribution amount
        if (allowance < contributionAmount) {
          const approvalTx = await sdk.ponder.approve(
            sdk.launcher.address,
            contributionAmount
          )
          await sdk.publicClient.waitForTransactionReceipt({ hash: approvalTx })
        }
      } else {
        // KUB flow remains the same...
      }

      // Now contribute
      const result = await contribute.mutateAsync({
        launchId,
        amount: contributionAmount,
        type: selectedToken,
      })

      // Rest of the success handling...
    } catch (err) {
      console.error('Operation failed:', err)
      throw err
    }
  }

  if (!sdk?.walletClient?.account) {
    return (
      <Card>
        <View align="center" justify="center">
          <Text>Please connect your wallet</Text>
        </View>
      </Card>
    )
  }

  if (!launchInfo) {
    return (
      <Card>
        <View align="center" justify="center">
          <Text>Loading...</Text>
        </View>
      </Card>
    )
  }

  if (launchInfo.launched) {
    return (
      <Card>
        <View align="center" justify="center">
          <Text>Launch completed</Text>
        </View>
      </Card>
    )
  }

  const isLoading = contribute.isPending || swap.isPending
  const error = contribute.error || swap.error
  const needsApproval = selectedToken === 'PONDER' && !hasApproved

  return (
    <Card>
      <View gap={16}>
        <View gap={8}>
          <Text variant="title-3">Contribute to {launchInfo.name}</Text>
          <Text>Total Raised: {formatEther(launchInfo.totalRaised)} KUB</Text>

          {isLoadingMetrics ? (
            <Text>Calculating required PONDER amount...</Text>
          ) : launchInfo.ponderMetrics ? (
            <Text>
              Required PONDER: {formatEther(launchInfo.ponderMetrics.requiredAmount)}{' '}
              PONDER
            </Text>
          ) : (
            <Text>Failed to calculate PONDER requirement</Text>
          )}

          {error && (
            <Text>{error instanceof Error ? error.message : 'Failed to contribute'}</Text>
          )}

          <View gap={4}>
            <Text>Select Token</Text>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as ContributionToken)}
              className="w-full p-2 border rounded"
            >
              <option value="PONDER">PONDER ({formatEther(balances.ponder)})</option>
              <option value="KUB">KUB ({formatEther(balances.kub)})</option>
            </select>
          </View>

          <View gap={4}>
            <Text>Amount</Text>
            <div className="relative w-full">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                type="number"
                step="0.000000000000000001"
                className="w-full p-2 border rounded pr-16"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
                {selectedToken}
              </span>
            </div>
          </View>
        </View>

        {needsApproval ? (
          <Button
            onClick={handleApprove}
            disabled={isApproving || !amount}
            loading={isApproving}
            fullWidth
          >
            {isApproving ? 'Approving...' : 'Approve PONDER'}
          </Button>
        ) : (
          <Button
            onClick={handleContribute}
            disabled={
              isLoading || !amount || isLoadingMetrics || !launchInfo.ponderMetrics
            }
            loading={isLoading}
            fullWidth
          >
            {isLoading
              ? selectedToken === 'KUB'
                ? 'Swapping and Contributing...'
                : 'Contributing...'
              : 'Contribute'}
          </Button>
        )}

        {(contribute.isSuccess || swap.isSuccess) && (
          <View>
            <Text color="positive">
              Successfully contributed!{' '}
              {contribute.data &&
                `Received ${formatEther(contribute.data.contribution.amount)} tokens`}
            </Text>
          </View>
        )}
      </View>
    </Card>
  )
}
