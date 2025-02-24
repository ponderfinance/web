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
import { formatNumber } from '@/src/app/utils/numbers'
import Image from 'next/image'

function PendingFeesCard({ feeInfo }: { feeInfo: any }) {
  return (
    <View
      direction="column"
      gap={8}
      borderColor="neutral-faded"
      padding={8}
      paddingInline={8}
      borderRadius="large"
    >
      <Text variant="title-5" weight="regular">
        Pending Fees
      </Text>
      <View direction="row" justify="space-between">
        <Text>KOI</Text>
        <Text>
          {feeInfo?.pendingFees.ponder
            ? formatUnits(feeInfo.pendingFees.ponder, 18)
            : '0'}{' '}
          KOI
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
    <View
      direction="column"
      gap={8}
      borderColor="neutral-faded"
      padding={8}
      paddingInline={8}
      borderRadius="large"
    >
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
        Note: Fees can be distributed once per day. Collection and conversion can be done
        anytime.
      </Text>
    </View>
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

      // Load pairs in batches of 50
      const batchSize = 50
      const promises = []

      for (let i = 0; i < Number(pairLength); i += batchSize) {
        const end = Math.min(i + batchSize, Number(pairLength))
        const batchPromises = Array.from({ length: end - i }, (_, index) =>
          sdk.factory.allPairs(i + index)
        )
        promises.push(Promise.all(batchPromises))
      }

      const results = await Promise.all(promises)
      const allPairs = results.flat()
      setSelectedPairs(allPairs)
      return allPairs // Return the pairs for immediate use
    } catch (error) {
      console.error('Failed to load pairs:', error)
      return [] // Return empty array in case of error
    } finally {
      setIsLoadingPairs(false)
    }
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
    <View gap={6}>
      <PendingFeesCard feeInfo={feeInfo} />
      <ActionsCard
        onCollect={handleCollectFees}
        onDistribute={() => distributeFees()}
        isCollecting={isCollecting}
        isDistributing={isDistributing}
        isLoadingPairs={isLoadingPairs}
        hasPendingFees={!!hasPendingFees}
      />
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
              xKOI (staked KOI) governs Ponder Finance, with 100% of protocol fees (0.05% from
              swaps, 0.01%–0.05% from launch token swaps) distributed proportionally to
              staked xKOI holders through immutable smart contracts.
            </Text>
          </View>
        </View>
        <View
          direction={{ s: 'column', m: 'row' }}
          justify="space-between"
          align="center"
        >
          <View
            direction="column"
            gap={4}
            padding={5}
            borderRadius="medium"
            borderColor="neutral-faded"
          >
            <View gap={1}>
              <Text variant="caption-1" color="neutral-faded">
                Your Staked Balance
              </Text>
              <Text variant="featured-1">
                {formatNumber(formatUnits(stakingInfo?.userShares, 18))}
              </Text>
            </View>

            <View grow={false}>
              <Button
                onClick={activate}
                size="medium"
                fullWidth={true}
                variant="solid"
                color="primary"
              >
                <View paddingInline={6}>Stake</View>
              </Button>
            </View>
          </View>
          <View
            direction="column"
            gap={4}
            backgroundColor="elevation-overlay"
            padding={5}
            borderRadius="medium"
          >
            <View gap={1}>
              <Text variant="caption-1" color="neutral-faded">
                Your Unclaimed Rewards
              </Text>
              <Text variant="featured-1">
                {formatNumber(formatUnits(stakingInfo?.pendingFees || BigInt(0), 18))}
              </Text>
            </View>

            <View grow={false}>
              <Button
                onClick={() => claimFees()}
                disabled={isClaimingFees || stakingInfo?.pendingFees <= BigInt(0)}
                loading={isClaimingFees}
                size="medium"
                fullWidth={true}
                variant="solid"
                color="primary"
              >
                <View paddingInline={6}>Claim</View>
              </Button>
            </View>
          </View>
        </View>

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

      <FeeManagement />
    </View>
  )
}
