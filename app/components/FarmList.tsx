import { useState, useEffect } from 'react'
import { Text, Card, View, Button } from 'reshaped'
import { usePonderSDK } from '@/app/providers/ponder'
import { useAccount } from 'wagmi'
import { Address, formatUnits, formatEther } from 'viem'
import { erc20Abi } from 'viem'

interface FarmPool {
  pid: number
  lpToken: Address
  token0Symbol: string
  token1Symbol: string
  allocPoint: bigint
  totalStaked: bigint
  depositFee: number
  boostMultiplier: number
  userStaked: bigint
  userPonderStaked: bigint
  pendingRewards: bigint
  apr: string
}

interface FarmListProps {
  onManageFarm?: (farm: {
    pid: number
    lpToken: Address
    token0Symbol: string
    token1Symbol: string
    depositFee: number
    boostMultiplier: number
  }) => void
}

export default function FarmList({ onManageFarm }: FarmListProps) {
  const { sdk, isReady } = usePonderSDK()
  const account = useAccount()
  const [farms, setFarms] = useState<FarmPool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedPool, setSelectedPool] = useState<number | null>(null)
  const [isHarvesting, setIsHarvesting] = useState(false)

  useEffect(() => {
    const fetchFarms = async () => {
      if (!sdk) return

      try {
        setIsLoading(true)
        const poolLength = await sdk.masterChef.poolLength()
        const totalAllocPoint = await sdk.masterChef.totalAllocPoint()
        const ponderPerSecond = await sdk.masterChef.ponderPerSecond()

        const farmData: FarmPool[] = []

        for (let pid = 0; pid < Number(poolLength); pid++) {
          // Get pool info
          const poolInfo = await sdk.masterChef.poolInfo(BigInt(pid))

          // Get LP token info
          const pair = sdk.getPair(poolInfo.lpToken)
          const [token0, token1] = await Promise.all([pair.token0(), pair.token1()])

          // Get token symbols
          const [token0Symbol, token1Symbol] = await Promise.all([
            sdk.publicClient.readContract({
              address: token0,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: token1,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
          ])

          // Calculate APR (simplified - would need price data for accurate calculation)
          const dailyRewards =
            Number(ponderPerSecond * BigInt(86400) * poolInfo.allocPoint) /
            Number(totalAllocPoint)
          const yearlyRewards = dailyRewards * 365
          // Note: This is a simplified APR calculation. In production, you'd want to:
          // 1. Get PONDER token price
          // 2. Get LP token price/TVL
          // 3. Calculate true APR based on prices
          const apr = ((yearlyRewards / Number(poolInfo.totalStaked)) * 100).toFixed(2)

          // Get user info if connected
          let userStaked = BigInt(0)
          let userPonderStaked = BigInt(0)
          let pendingRewards = BigInt(0)

          if (account.address) {
            const userInfo = await sdk.masterChef.userInfo(BigInt(pid), account.address)
            userStaked = userInfo.amount
            userPonderStaked = userInfo.ponderStaked
            pendingRewards = await sdk.masterChef.pendingPonder(
              BigInt(pid),
              account.address
            )
          }

          farmData.push({
            pid,
            lpToken: poolInfo.lpToken,
            token0Symbol,
            token1Symbol,
            allocPoint: poolInfo.allocPoint,
            totalStaked: poolInfo.totalStaked,
            depositFee: poolInfo.depositFeeBP / 100, // Convert basis points to percentage
            boostMultiplier: poolInfo.boostMultiplier / 10000, // Convert to multiplier (e.g., 20000 -> 2x)
            userStaked,
            userPonderStaked,
            pendingRewards,
            apr,
          })
        }

        setFarms(farmData)
      } catch (err: any) {
        console.error('Error fetching farms:', err)
        setError(err.message || 'Failed to fetch farm data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFarms()
    const interval = setInterval(fetchFarms, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [sdk, account.address])

  const handleHarvest = async (pid: number) => {
    if (!sdk || !account.address) return

    try {
      setIsHarvesting(true)
      setSelectedPool(pid)

      // Deposit 0 to harvest rewards
      const tx = await sdk.masterChef.deposit(BigInt(pid), BigInt(0))
      await sdk.publicClient.waitForTransactionReceipt({ hash: tx })
    } catch (err: any) {
      console.error('Harvest error:', err)
      setError(err.message || 'Failed to harvest rewards')
    } finally {
      setIsHarvesting(false)
      setSelectedPool(null)
    }
  }

  if (!isReady || isLoading) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>Loading farms...</Text>
        </View>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <View align="center" justify="center" padding={8}>
          <Text>{error}</Text>
        </View>
      </Card>
    )
  }

  return (
    <View gap={16}>
      <Text variant="title-3">Active Farms</Text>
      {farms.length === 0 ? (
        <Card>
          <View align="center" justify="center" padding={8}>
            <Text>No active farms</Text>
          </View>
        </Card>
      ) : (
        farms.map((farm) => (
          <Card key={farm.pid}>
            <View padding={16} gap={12}>
              <View gap={4}>
                <Text variant="title-4">
                  {farm.token0Symbol}/{farm.token1Symbol} LP Farm
                </Text>
                <Text>Pool ID: {farm.pid}</Text>
              </View>

              <View gap={8}>
                <View direction="row">
                  <Text>APR:</Text>
                  <Text>{farm.apr}%</Text>
                </View>

                <View direction="row">
                  <Text>Total Staked:</Text>
                  <Text>{formatEther(farm.totalStaked)} LP</Text>
                </View>

                <View direction="row">
                  <Text>Deposit Fee:</Text>
                  <Text>{farm.depositFee}%</Text>
                </View>

                <View direction="row">
                  <Text>Boost Multiplier:</Text>
                  <Text>Up to {farm.boostMultiplier}x</Text>
                </View>

                {account.address ? (
                  <View gap={8}>
                    <View direction="row">
                      <Text>Your Stake:</Text>
                      <View gap={2} align="end">
                        <Text>{formatEther(farm.userStaked)} LP</Text>
                        {farm.userPonderStaked > 0 && (
                          <Text>+ {formatEther(farm.userPonderStaked)} PONDER Boost</Text>
                        )}
                      </View>
                    </View>

                    <View direction="row">
                      <Text>Pending Rewards:</Text>
                      <Text>{formatEther(farm.pendingRewards)} PONDER</Text>
                    </View>

                    <View direction="row" gap={8}>
                      <Button
                        onClick={() => handleHarvest(farm.pid)}
                        disabled={farm.pendingRewards === BigInt(0) || isHarvesting}
                        loading={isHarvesting && selectedPool === farm.pid}
                      >
                        Harvest
                      </Button>

                      <Button
                        onClick={() =>
                          onManageFarm?.({
                            pid: farm.pid,
                            lpToken: farm.lpToken,
                            token0Symbol: farm.token0Symbol,
                            token1Symbol: farm.token1Symbol,
                            depositFee: farm.depositFee,
                            boostMultiplier: farm.boostMultiplier,
                          })
                        }
                      >
                        Manage Position
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Text align="center">Connect wallet to view your position</Text>
                )}
              </View>
            </View>
          </Card>
        ))
      )}
    </View>
  )
}
