import { useState } from 'react'
import { Text, View, Button, Card, Loader, useToggle, Modal } from 'reshaped'
import { useAccount } from 'wagmi'
import { formatUnits, type Address } from 'viem'
import {
  useFeeDistributorInfo,
  useDistributeFees,
  useCollectFees,
  useFeeMetrics,
  usePonderSDK,
  useStakingInfo,
  useClaimFees,
} from '@ponderfinance/sdk'
import { StakeInterface } from '@/src/app/modules/stake/components/PonderStaking'
import { shortenNumber, formatNumber } from '@/src/app/utils/numbers'
import Image from 'next/image'

function PendingFeesCard({ feeInfo }: { feeInfo: any }) {
  return (
    <Card padding={16}>
      <View gap={8}>
        <Text variant="title-3">Pending Fees</Text>
        <View direction="row" justify="space-between">
          <Text>PONDER</Text>
          <Text>
            {feeInfo?.pendingFees.ponder
              ? formatUnits(feeInfo.pendingFees.ponder, 18)
              : '0'}{' '}
            PONDER
          </Text>
        </View>
        {feeInfo?.pendingFees.otherTokens.map((token: any) => (
          <View key={token.token} direction="row" justify="space-between">
            <Text>{token.symbol}</Text>
            <Text>
              {formatUnits(token.balance, 18)} {token.symbol}
              {token.valueInKUB && ` (≈ ${formatUnits(token.valueInKUB, 18)} KUB)`}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  )
}

function MetricsCard({ feeInfo, feeMetrics }: { feeInfo: any; feeMetrics: any }) {
  const formatTimeUntil = (timestamp: bigint) => {
    const now = BigInt(Math.floor(Date.now() / 1000))
    const diff = Number(timestamp - now)
    if (diff < 0) return 'Now'
    const hours = Math.floor(diff / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <Card padding={16}>
      <View gap={8}>
        <Text variant="title-3">Fee Metrics</Text>
        <View direction="row" justify="space-between">
          <Text>24h Volume</Text>
          <Text>
            {feeMetrics?.daily.volume ? formatUnits(feeMetrics.daily.volume, 18) : '0'}{' '}
            KUB
          </Text>
        </View>
        <View direction="row" justify="space-between">
          <Text>Last Distribution</Text>
          <Text>
            {feeInfo?.lastDistribution
              ? new Date(Number(feeInfo.lastDistribution) * 1000).toLocaleString()
              : 'Never'}
          </Text>
        </View>
        <View direction="row" justify="space-between">
          <Text>Next Distribution</Text>
          <Text>
            {feeInfo?.nextDistribution
              ? formatTimeUntil(feeInfo.nextDistribution)
              : 'N/A'}
          </Text>
        </View>
        <View direction="row" justify="space-between">
          <Text>Projected Annual Fees</Text>
          <Text>
            {feeMetrics?.projectedAnnualFees
              ? formatUnits(feeMetrics.projectedAnnualFees, 18)
              : '0'}{' '}
            KUB
          </Text>
        </View>
      </View>
    </Card>
  )
}

function ActionsCard({
  onCollect,
  onDistribute,
  isCollecting,
  isDistributing,
  isLoadingPairs,
  hasPendingFees,
}: {
  onCollect: () => void
  onDistribute: () => void
  isCollecting: boolean
  isDistributing: boolean
  isLoadingPairs: boolean
  hasPendingFees: boolean
}) {
  return (
    <Card padding={16}>
      <View gap={8}>
        <Text variant="title-3">Actions</Text>
        <View direction="row" gap={8}>
          <Button
            onClick={onDistribute}
            disabled={isDistributing || !hasPendingFees}
            loading={isDistributing}
            className="flex-1"
          >
            Distribute Fees
          </Button>
          <Button
            onClick={onCollect}
            disabled={isCollecting || isLoadingPairs}
            loading={isCollecting || isLoadingPairs}
            className="flex-1"
          >
            {isLoadingPairs ? 'Loading Pairs...' : 'Collect Protocol Fees'}
          </Button>
        </View>
        <Text variant="caption-1" color="neutral">
          Note: Fees can be distributed once per day. Collection and conversion can be
          done anytime.
        </Text>
      </View>
    </Card>
  )
}

function DistributionHistoryCard({ feeMetrics }: { feeMetrics: any }) {
  return (
    <Card padding={16}>
      <View gap={8}>
        <Text variant="title-3">Recent Distributions</Text>
        {feeMetrics?.daily.distributions && (
          <View>
            <View direction="row" justify="space-between">
              <Text>Last 24h</Text>
              <Text>{feeMetrics.daily.distributions} distributions</Text>
            </View>
            <View direction="row" justify="space-between">
              <Text>Average Size</Text>
              <Text>{formatUnits(feeMetrics.daily.avgDistributionSize, 18)} KUB</Text>
            </View>
          </View>
        )}
        {feeMetrics?.revenueGrowth && (
          <View gap={4}>
            <Text variant="title-4">Growth</Text>
            <View direction="row" justify="space-between">
              <Text>24h</Text>
              <Text>{feeMetrics.revenueGrowth.daily.toFixed(2)}%</Text>
            </View>
            <View direction="row" justify="space-between">
              <Text>7d</Text>
              <Text>{feeMetrics.revenueGrowth.weekly.toFixed(2)}%</Text>
            </View>
            <View direction="row" justify="space-between">
              <Text>30d</Text>
              <Text>{feeMetrics.revenueGrowth.monthly.toFixed(2)}%</Text>
            </View>
          </View>
        )}
      </View>
    </Card>
  )
}

function FeeManagement() {
  const { address } = useAccount()
  const sdk = usePonderSDK()
  const [selectedPairs, setSelectedPairs] = useState<Address[]>([])
  const [isLoadingPairs, setIsLoadingPairs] = useState(false)

  const { data: feeInfo, isLoading: isLoadingInfo } = useFeeDistributorInfo()
  const { data: feeMetrics } = useFeeMetrics()
  const { mutate: distributeFees, isPending: isDistributing } = useDistributeFees()
  const { mutate: collectFees, isPending: isCollecting } = useCollectFees()

  const loadActivePairs = async () => {
    setIsLoadingPairs(true)
    try {
      const pairLength = await sdk.factory.allPairsLength()
      const pairs: Address[] = []

      for (let i = 0; i < Number(pairLength); i++) {
        const pair = await sdk.factory.allPairs(i)
        pairs.push(pair)
      }

      setSelectedPairs(pairs)
    } catch (error) {
      console.error('Failed to load pairs:', error)
    }
    setIsLoadingPairs(false)
  }

  const handleCollectFees = async () => {
    if (selectedPairs.length === 0) {
      await loadActivePairs()
    }

    // Collect from each pair
    for (const pair of selectedPairs) {
      try {
        await collectFees({ pair })
      } catch (error) {
        console.error(`Failed to collect fees from pair ${pair}:`, error)
      }
    }
  }

  const hasPendingFees =
    feeInfo?.pendingFees?.ponder ||
    0 > BigInt(0) ||
    feeInfo?.pendingFees.otherTokens.some((token) => token.balance > BigInt(0))

  return (
    <View gap={24} className="max-w-4xl mx-auto">
      {/*<PendingFeesCard feeInfo={feeInfo} />*/}
      {/*<MetricsCard feeInfo={feeInfo} feeMetrics={feeMetrics} />*/}
      {/*<ActionsCard*/}
      {/*  onCollect={handleCollectFees}*/}
      {/*  onDistribute={() => distributeFees()}*/}
      {/*  isCollecting={isCollecting}*/}
      {/*  isDistributing={isDistributing}*/}
      {/*  isLoadingPairs={isLoadingPairs}*/}
      {/*  hasPendingFees={!!hasPendingFees}*/}
      {/*/>*/}
      {/*<DistributionHistoryCard feeMetrics={feeMetrics} />*/}
    </View>
  )
}

export default function FeesPage() {
  const { active, activate, deactivate } = useToggle(false)
  const { address } = useAccount()
  const { data: stakingInfo, isLoading: isLoadingInfo } = useStakingInfo(address)
  const { mutate: claimFees, isPending: isClaimingFees } = useClaimFees()

  if (!stakingInfo?.userShares) return null

  return (
    <View gap={6} maxWidth={{ s: '100%', m: '1086px' }}>
      <View
        direction="column"
        gap={8}
        borderColor="neutral-faded"
        padding={8}
        paddingInline={8}
        borderRadius="large"
      >
        <View
          direction={{ s: 'column', m: 'row' }}
          align="center"
          justify="space-between"
          gap={12}
          divided
        >
          <View direction="row" align="center" gap={4}>
            <View>
              <Image height={128} width={128} src={'/xkoi-logo.png'} alt={'xKoi Coin'} />
            </View>
            <Text variant="title-5" weight="regular">
              xKOI
            </Text>
          </View>
          <View grow={true}>
            <Text variant="body-3">
              xKOI (staked KOI) governs Ponder Finance, with protocol fees (0.05% from
              swaps, 0.01%–0.05% from launch token swaps) distributed proportionally to
              staked xKOI holders through immutable smart contracts.
            </Text>
          </View>
        </View>

        <View align="center" direction="row" gap={8}>
          <View.Item columns={{ s: 12, m: 6 }}>
            <Text variant="caption-1">Your Balance</Text>
            <Text variant="featured-1">
              {formatNumber(formatUnits(stakingInfo?.userShares, 18))}
            </Text>
          </View.Item>
          <View.Item columns={{ s: 12, m: 6 }} gapBefore={2}>
            <View direction="row" gap={2} align="center" wrap={true}></View>
          </View.Item>
        </View>

        {/* Add this section */}
        <View direction="row" justify="space-between">
          <Text>Claimable Fees</Text>
          <Text>
            {formatNumber(formatUnits(stakingInfo?.pendingFees || BigInt(0), 18))} KOI
          </Text>
        </View>
        {stakingInfo?.pendingFees > BigInt(0) && (
          <Button
            onClick={() => claimFees()}
            disabled={isClaimingFees}
            loading={isClaimingFees}
            size="small"
            fullWidth={true}
            variant="outline"
            color="primary"
          >
            {isClaimingFees ? 'Claiming...' : 'Claim Fees'}
          </Button>
        )}
        <View grow={false}>
          <Button
            onClick={activate}
            size="large"
            fullWidth={false}
            variant="solid"
            color="primary"
          >
            <View paddingInline={6}>Stake</View>
          </Button>

          <Modal
            active={active}
            onClose={deactivate}
            padding={8}
            position={{ s: 'bottom', m: 'center' }}
            size={{ s: '100%', m: '640px' }}
          >
            <View
              maxHeight="80vh"
              // attributes={{ style: { overflowY: 'scroll' } }}
            >
              <StakeInterface />
            </View>
          </Modal>
        </View>
      </View>

      <FeeManagement />
    </View>
  )
}
