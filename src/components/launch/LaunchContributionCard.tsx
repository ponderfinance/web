import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { useSwap, useContribute, usePonderSDK, useRemainingToRaise } from '@ponderfinance/sdk'
import { formatEther, parseEther, type Address } from 'viem'
import { useFragment, useLazyLoadQuery } from 'react-relay'
import { graphql } from 'relay-runtime'
import type { LaunchContributionCard_launch$key } from '@/src/__generated__/LaunchContributionCard_launch.graphql'
import type { LaunchContributionCardQuery } from '@/src/__generated__/LaunchContributionCardQuery.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'

interface LaunchContributionCardProps {
  launchId: bigint
}

type ContributionToken = 'KOI' | 'KUB'

const LaunchContributionCardFragment = graphql`
  fragment LaunchContributionCard_launch on Launch {
    id
    launchId
    tokenAddress
    creatorAddress
    imageURI
    kubRaised
    ponderRaised
    status
    kubPairAddress
    ponderPairAddress
    hasDualPools
    ponderPoolSkipped
    kubLiquidity
    ponderLiquidity
    ponderBurned
    lpWithdrawn
    lpWithdrawnAt
    completedAt
    cancelledAt
    createdAt
    updatedAt
  }
`

const LaunchContributionCardQuery = graphql`
  query LaunchContributionCardQuery($launchId: Int!) {
    launch(launchId: $launchId) {
      ...LaunchContributionCard_launch
    }
  }
`

// Constants from the contract
const TARGET_RAISE = BigInt('5555000000000000000000') // 5555 KUB
const MAX_PONDER_PERCENT = BigInt('2000') // 20% in basis points
const BASIS_POINTS = BigInt('10000')
const MIN_KUB_CONTRIBUTION = BigInt('10000000000000000') // 0.01 KUB
const MIN_PONDER_CONTRIBUTION = BigInt('100000000000000000') // 0.1 PONDER
const PONDER_TO_KUB_RATIO = BigInt('10') // 1 PONDER = 0.1 KUB

export default function LaunchContributionCard({
  launchId,
}: LaunchContributionCardProps) {
  const sdk = usePonderSDK()
  const contribute = useContribute()
  const swap = useSwap()
  const { data: remainingData } = useRemainingToRaise(launchId)

  const [selectedToken, setSelectedToken] = useState<ContributionToken>('KOI')
  const [amount, setAmount] = useState<string>('')
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)
  const [isApproving, setIsApproving] = useState(false)
  const [hasApproved, setHasApproved] = useState(false)
  const [balances, setBalances] = useState<{
    koi: bigint
    kub: bigint
  }>({
    koi: BigInt(0),
    kub: BigInt(0),
  })

  // Fetch launch info using Relay
  const data = useLazyLoadQuery<LaunchContributionCardQuery>(LaunchContributionCardQuery, {
    launchId: Number(launchId),
  })

  // Fetch PONDER metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!sdk?.walletClient?.account) return

      try {
        setIsLoadingMetrics(true)
        const metrics = await sdk.launcher.calculatePonderRequirements()
        // Store metrics in state if needed
      } catch (err) {
        console.error('Failed to fetch PONDER metrics:', err)
      } finally {
        setIsLoadingMetrics(false)
      }
    }

    fetchMetrics()
  }, [sdk?.walletClient?.account])

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
          koi: ponderBalance,
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
      if (!sdk?.walletClient?.account || !amount || selectedToken !== 'KOI') {
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

  if (!data?.launch) {
    return (
      <Card>
        <View align="center" justify="center">
          <Text>Loading...</Text>
        </View>
      </Card>
    )
  }

  const launch = useFragment<LaunchContributionCard_launch$key>(
    LaunchContributionCardFragment,
    data.launch
  )

  const calculateMaxContribution = async () => {
    if (!remainingData) return '0'

    try {
      if (selectedToken === 'KUB') {
        // For KUB, max is either remaining KUB or user's balance
        const maxKub = remainingData.remainingKub > balances.kub ? balances.kub : remainingData.remainingKub
        return formatEther(maxKub)
      } else {
        // For KOI, remainingPonder is in KUB terms
        // Use calculatePonderRequirements to get the actual PONDER amount needed
        const metrics = await sdk.launcher.calculatePonderRequirements()
        const maxPonder = metrics.requiredAmount > balances.koi ? balances.koi : metrics.requiredAmount
        return formatEther(maxPonder)
      }
    } catch (err) {
      console.error('Failed to calculate max contribution:', err)
      return '0'
    }
  }

  const handleMaxClick = async () => {
    const maxAmount = await calculateMaxContribution()
    setAmount(maxAmount)
  }

  const handleContribute = async () => {
    if (!sdk?.walletClient?.account || !amount) return

    try {
      const contributionAmount = parseEther(amount)

      // Validate minimum contribution
      if (selectedToken === 'KUB' && contributionAmount < MIN_KUB_CONTRIBUTION) {
        throw new Error(`Minimum KUB contribution is ${formatEther(MIN_KUB_CONTRIBUTION)} KUB`)
      }
      if (selectedToken === 'KOI' && contributionAmount < MIN_PONDER_CONTRIBUTION) {
        throw new Error(`Minimum KOI contribution is ${formatEther(MIN_PONDER_CONTRIBUTION)} KOI`)
      }

      if (selectedToken === 'KOI') {
        // Check KOI balance and allowance
        const [koiBalance, allowance] = await Promise.all([
          sdk.ponder.balanceOf(sdk.walletClient.account.address),
          sdk.ponder.allowance(sdk.walletClient.account.address, sdk.launcher.address),
        ])

        if (koiBalance < contributionAmount) {
          throw new Error('Insufficient KOI balance')
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
        // Check KUB balance
        const kubBalance = await sdk.publicClient.getBalance({ 
          address: sdk.walletClient.account.address 
        })
        
        if (kubBalance < contributionAmount) {
          throw new Error('Insufficient KUB balance')
        }
      }

      // Now contribute
      const result = await contribute.mutateAsync({
        launchId,
        amount: contributionAmount,
        type: selectedToken === 'KOI' ? 'PONDER' : 'KUB', // Map KOI to PONDER for the contract
      })

      // Reset form
      setAmount('')
      setHasApproved(false)
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

  if (launch.status === 'COMPLETED' || launch.status === 'CANCELLED') {
    return (
      <Card>
        <View align="center" justify="center">
          <Text>Launch {launch.status.toLowerCase()}</Text>
        </View>
      </Card>
    )
  }

  const isLoading = contribute.isPending || swap.isPending
  const error = contribute.error || swap.error
  const needsApproval = selectedToken === 'KOI' && !hasApproved

  return (
    <Card>
      <View gap={16}>
        <View gap={8}>
          <Text variant="title-3">Contribute to Launch #{launch.launchId}</Text>
          <Text>Total Raised: {formatEther(BigInt(launch.kubRaised))} KUB</Text>
          <Text>KOI Raised: {formatEther(BigInt(launch.ponderRaised))} KOI</Text>

          {isLoadingMetrics ? (
            <Text>Calculating required KOI amount...</Text>
          ) : (
            <Text>Required KOI: {formatEther(BigInt(launch.ponderRaised))} KOI</Text>
          )}

          {error && (
            <Text color="critical">
              {error instanceof Error ? error.message : 'Failed to contribute'}
            </Text>
          )}

          <View gap={4}>
            <Text>Select Token</Text>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as ContributionToken)}
              className="w-full p-2 border rounded"
            >
              <option value="KOI">KOI ({formatEther(balances.koi)})</option>
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
            <Button onClick={handleMaxClick} variant="outline" fullWidth>
              MAX
            </Button>
          </View>
        </View>

        {needsApproval ? (
          <Button
            onClick={handleApprove}
            disabled={isApproving || !amount}
            loading={isApproving}
            fullWidth
          >
            {isApproving ? 'Approving...' : 'Approve KOI'}
          </Button>
        ) : (
          <Button
            onClick={handleContribute}
            disabled={isLoading || !amount || isLoadingMetrics}
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
