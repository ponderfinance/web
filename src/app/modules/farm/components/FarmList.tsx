import { useState, useEffect, useCallback } from 'react'
import { View, Text, Button, Badge } from 'reshaped'
import { useAccount } from 'wagmi'
import { formatEther, formatUnits, parseEther, type Address } from 'viem'
import { useTokenApproval } from '@ponderfinance/sdk'
import { erc20Abi } from 'viem'
import {
  usePonderSDK,
  useFarmMetrics,
  usePoolInfo,
  useStakeInfo,
  usePendingRewards,
  useBoostStake,
  useBoostUnstake,
  useHarvest,
} from '@ponderfinance/sdk'
import StakeModal from '../../../components/StakeModal'

interface TokenInfo {
  address: Address
  symbol: string
  decimals: number
}

interface PoolPosition {
  lpToken: Address
  token0: TokenInfo
  token1: TokenInfo
  userLPBalance: bigint
  totalSupply: bigint
  reserve0: bigint
  reserve1: bigint
  poolShare: string
  token0Amount: string
  token1Amount: string
}

interface MetricsCardProps {
  title: string
  value: string
  subtitle?: string
}

interface BoostInfo {
  currentMultiplier: number
  maxMultiplier: number
  ponderRequired: bigint
  ponderStaked: bigint
  additionalRewards: bigint
}

interface BoostDisplayProps {
  boost: BoostInfo
  onBoost: () => void
  onUnboost: () => void
  isBoostLoading: boolean
  isUnboostLoading: boolean
}

const BoostDisplay = ({
  boost,
  onBoost,
  onUnboost,
  isBoostLoading,
  isUnboostLoading,
}: BoostDisplayProps) => (
  <View gap={2} padding={4} backgroundColor="neutral-faded">
    <View direction="row" justify="space-between" align="center">
      <Text variant="caption-1">Boost Multiplier</Text>
      <Badge color={boost.ponderStaked > BigInt(0) ? 'primary' : 'neutral'}>
        {(boost.currentMultiplier / 10000).toFixed(2)}x
      </Badge>
    </View>

    <View direction="row" justify="space-between">
      <Text variant="caption-1">KOI Staked</Text>
      <Text variant="caption-1">{formatEther(boost.ponderStaked)}</Text>
    </View>

    <View direction="row" justify="space-between">
      <Text variant="caption-1">Required for Max Boost</Text>
      <Text variant="caption-1">{formatEther(boost.ponderRequired)}</Text>
    </View>

    {boost.additionalRewards > BigInt(0) && (
      <View direction="row" justify="space-between">
        <Text variant="caption-1">Additional Rewards</Text>
        <Text variant="caption-1" color="primary">
          +{formatEther(boost.additionalRewards)} PONDER
        </Text>
      </View>
    )}

    <View direction="row" gap={2}>
      <Button
        variant="outline"
        onClick={onBoost}
        disabled={isBoostLoading}
        loading={isBoostLoading}
        fullWidth
      >
        Boost
      </Button>
      {boost.ponderStaked > BigInt(0) && (
        <Button
          variant="outline"
          onClick={onUnboost}
          disabled={isUnboostLoading}
          loading={isUnboostLoading}
          fullWidth
        >
          Unboost
        </Button>
      )}
    </View>
  </View>
)

const MetricsCard = ({ title, value, subtitle }: MetricsCardProps) => (
  <View grow borderRadius="medium" padding={4} backgroundColor="neutral-faded">
    <Text variant="caption-1">{title}</Text>
    <Text variant="body-1">{value}</Text>
    {subtitle && <Text variant="caption-2">{subtitle}</Text>}
  </View>
)

interface FarmMetricsProps {
  metrics: {
    totalValueLocked: bigint
    rewardsPerDay: bigint
    averageApr: number
    activePools: number
  }
}

// const FarmMetrics = ({ metrics }: FarmMetricsProps) => (
//   <View direction="row" wrap gap={4}>
//     <MetricsCard
//       title="Total Value Locked"
//       value={`$${formatEther(metrics.totalValueLocked)}`}
//     />
//     <MetricsCard
//       title="Daily Rewards"
//       value={formatEther(metrics.rewardsPerDay)}
//       subtitle="KOI"
//     />
//     <MetricsCard title="Average APR" value={`${metrics.averageApr}%`} />
//     <MetricsCard title="Active Farms" value={metrics.activePools.toString()} />
//   </View>
// )

interface PoolCardProps {
  pid: number
  address: Address | undefined
  position: PoolPosition | null
  onManage: (pid: number) => void
}

const PoolCard = ({ pid, address, position, onManage }: PoolCardProps) => {
  const { data: pool, isLoading, error } = usePoolInfo(pid)
  const { data: stakeInfo } = useStakeInfo(pid, address)
  const { data: pendingRewards } = usePendingRewards(pid, address)
  const { mutateAsync: harvest, isPending: isHarvesting } = useHarvest()
  const { mutateAsync: boostStake, isPending: isBoostLoading } = useBoostStake()
  const { mutateAsync: boostUnstake, isPending: isUnboostLoading } = useBoostUnstake()

  const sdk = usePonderSDK()
  const ponderToken = sdk.ponder.address
  const { approve, isApproved } = useTokenApproval(
    ponderToken,
    sdk.masterChef.address,
    !!stakeInfo?.boost.ponderRequired
  )
  const handleHarvest = useCallback(async () => {
    try {
      await harvest({ poolId: pid })
    } catch (err) {
      console.error('Failed to harvest:', err)
    }
  }, [harvest, pid])

  const handleBoost = useCallback(async () => {
    if (!stakeInfo?.boost.ponderRequired || !ponderToken) return
    try {
      // Check if approval needed
      if (!isApproved(stakeInfo.boost.ponderRequired)) {
        await approve.mutateAsync({
          token: ponderToken,
          spender: sdk.masterChef.address,
          amount: stakeInfo.boost.ponderRequired,
        })
      }

      // Perform boost
      const result = await boostStake({
        poolId: pid,
        amount: stakeInfo.boost.ponderRequired,
      })
      console.log('Boost completed:', result)
    } catch (err) {
      if (err instanceof Error && err.message === 'Already approved') {
        // If already approved, proceed with boost
        try {
          const result = await boostStake({
            poolId: pid,
            amount: stakeInfo.boost.ponderRequired,
          })
          console.log('Boost completed:', result)
        } catch (boostErr) {
          console.error('Failed to boost:', boostErr)
        }
      } else {
        console.error('Failed to approve/boost:', err)
      }
    }
  }, [boostStake, pid, stakeInfo, sdk, ponderToken, approve, isApproved])

  const handleUnboost = useCallback(async () => {
    if (!stakeInfo?.ponderStaked) return

    try {
      const result = await boostUnstake({
        poolId: pid,
        amount: stakeInfo.ponderStaked,
      })
    } catch (err) {
      console.error('Failed to unboost:', err)
    }
  }, [boostUnstake, pid, stakeInfo])

  if (isLoading) {
    return (
      <View padding={4} borderRadius="medium">
        <Text>Loading pool {pid}...</Text>
      </View>
    )
  }

  if (error || !pool) {
    return (
      <View padding={4} borderRadius="medium">
        <Text color="neutral-faded">
          {error ? `Error: ${error.message}` : `No data for pool ${pid}`}
        </Text>
      </View>
    )
  }

  const hasStakedBalance = stakeInfo?.amount && stakeInfo.amount > BigInt(0)
  const hasPendingRewards = pendingRewards?.total && pendingRewards.total > BigInt(0)

  const boostInfo = stakeInfo?.boost && {
    currentMultiplier: pool.boostMultiplier,
    maxMultiplier: pool.boostMultiplier,
    ponderRequired: stakeInfo.boost.ponderRequired,
    ponderStaked: stakeInfo.ponderStaked,
    additionalRewards: stakeInfo.boost.additionalRewards,
  }

  return (
    <View padding={4} borderRadius="medium" backgroundColor="neutral-faded">
      <View gap={4}>
        <View direction="row" justify="space-between" align="start">
          <View gap={1}>
            {position ? (
              <>
                <Text variant="title-4">
                  {position.token0.symbol}/{position.token1.symbol} LP
                </Text>
                <Text variant="caption-1">Your Share: {position.poolShare}%</Text>
                <Text variant="caption-1">
                  {position.token0Amount} {position.token0.symbol} +{' '}
                  {position.token1Amount} {position.token1.symbol}
                </Text>
              </>
            ) : (
              <Text variant="title-4">Pool #{pid}</Text>
            )}
            <Text variant="caption-1">TVL: ${formatEther(pool.totalStakedUSD)}</Text>
          </View>

          <View align="end">
            <Text variant="title-4">{pool.apr}% APR</Text>
            <Text variant="caption-1">{formatEther(pool.rewardsPerDay)} PONDER/day</Text>
          </View>
        </View>

        {address && (
          <View gap={4}>
            <View gap={2}>
              <View direction="row" justify="space-between">
                <Text>Available LP:</Text>
                <Text>{position ? formatEther(position.userLPBalance) : '0'} LP</Text>
              </View>

              {stakeInfo && (
                <View direction="row" justify="space-between">
                  <Text>Staked LP:</Text>
                  <Text>{formatEther(stakeInfo.amount)} LP</Text>
                </View>
              )}

              {pendingRewards && (
                <View direction="row" justify="space-between">
                  <Text>Pending Rewards:</Text>
                  <Text>{formatEther(pendingRewards.total)} PONDER</Text>
                </View>
              )}
            </View>

            {/* Boost section */}
            {boostInfo && hasStakedBalance && (
              <BoostDisplay
                boost={boostInfo}
                onBoost={handleBoost}
                onUnboost={handleUnboost}
                isBoostLoading={isBoostLoading}
                isUnboostLoading={isUnboostLoading}
              />
            )}

            <View direction="row" gap={2}>
              <Button variant="outline" onClick={() => onManage(pid)} fullWidth>
                {hasStakedBalance ? 'Manage Stake' : 'Stake LP'}
              </Button>

              {hasPendingRewards && (
                <Button
                  onClick={handleHarvest}
                  disabled={isHarvesting}
                  loading={isHarvesting}
                  fullWidth
                >
                  Harvest
                </Button>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

export default function FarmList() {
  const sdk = usePonderSDK()
  const { address } = useAccount()
  const [selectedPool, setSelectedPool] = useState<number | null>(null)
  const [poolLength, setPoolLength] = useState<number>(0)
  const [positions, setPositions] = useState<Record<string, PoolPosition>>({})
  const [isLoading, setIsLoading] = useState(true)
  const { data: metrics } = useFarmMetrics()

  // Fetch pool length
  useEffect(() => {
    const fetchPoolLength = async () => {
      try {
        const length = await sdk.masterChef.poolLength()
        setPoolLength(Number(length))
      } catch (err) {
        console.error('Failed to fetch pool length:', err)
        setPoolLength(0)
      }
    }

    fetchPoolLength()
  }, [sdk])

  // Fetch liquidity positions for each pool
  useEffect(() => {
    const fetchPositions = async () => {
      if (!sdk || !address || !poolLength) return

      try {
        setIsLoading(true)
        const positionsMap: Record<string, PoolPosition> = {}

        const fetchPoolPosition = async (pid: number) => {
          const pool = await sdk.masterChef.poolInfo(BigInt(pid))
          const lpToken = pool.lpToken
          const pair = sdk.getPair(lpToken)

          const [
            lpBalance,
            token0,
            token1,
            reserves,
            totalSupply,
            token0Symbol,
            token1Symbol,
            token0Decimals,
            token1Decimals,
          ] = await Promise.all([
            pair.balanceOf(address),
            pair.token0(),
            pair.token1(),
            pair.getReserves(),
            pair.totalSupply(),
            sdk.publicClient.readContract({
              address: await pair.token0(),
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: await pair.token1(),
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: await pair.token0(),
              abi: erc20Abi,
              functionName: 'decimals',
            }),
            sdk.publicClient.readContract({
              address: await pair.token1(),
              abi: erc20Abi,
              functionName: 'decimals',
            }),
          ])

          const poolShare =
            totalSupply > BigInt(0)
              ? ((Number(lpBalance) / Number(totalSupply)) * 100).toFixed(2)
              : '0'

          const token0Amount = formatUnits(
            totalSupply > BigInt(0)
              ? (lpBalance * reserves.reserve0) / totalSupply
              : BigInt(0),
            token0Decimals
          )

          const token1Amount = formatUnits(
            totalSupply > BigInt(0)
              ? (lpBalance * reserves.reserve1) / totalSupply
              : BigInt(0),
            token1Decimals
          )

          return {
            lpToken,
            token0: {
              address: token0,
              symbol: token0Symbol,
              decimals: token0Decimals,
            },
            token1: {
              address: token1,
              symbol: token1Symbol,
              decimals: token1Decimals,
            },
            userLPBalance: lpBalance,
            totalSupply,
            reserve0: reserves.reserve0,
            reserve1: reserves.reserve1,
            poolShare,
            token0Amount,
            token1Amount,
          }
        }

        // Fetch all pools in parallel
        const poolPromises = Array.from({ length: poolLength }, (_, i) =>
          fetchPoolPosition(i)
        )

        const poolPositions = await Promise.all(poolPromises)

        poolPositions.forEach((position, index) => {
          positionsMap[index] = position
        })

        setPositions(positionsMap)
      } catch (err) {
        console.error('Error fetching positions:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPositions()
  }, [sdk, address, poolLength])

  if (!address) {
    return (
      <View align="center" justify="center" padding={8}>
        <Text>Connect wallet to view farms</Text>
      </View>
    )
  }

  return (
    <View gap={4}>
      {/*{metrics && <FarmMetrics metrics={metrics} />}*/}

      <View gap={4}>
        {Array.from({ length: poolLength }, (_, pid) => (
          <PoolCard
            key={pid}
            pid={pid}
            address={address}
            position={positions[pid] || null}
            onManage={setSelectedPool}
          />
        ))}
      </View>

      {selectedPool !== null && positions[selectedPool] && (
        <StakeModal
          poolId={selectedPool}
          lpToken={positions[selectedPool].lpToken}
          position={positions[selectedPool]}
          active={selectedPool !== null}
          onClose={() => setSelectedPool(null)}
        />
      )}
    </View>
  )
}
