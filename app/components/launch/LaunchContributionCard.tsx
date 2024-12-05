import { useState, useEffect } from 'react'
import { Text, Card, Button, View } from 'reshaped'
import { usePonderSDK } from '@ponderfinance/sdk'
import { formatEther, parseEther } from 'viem'

interface LaunchContributionCardProps {
  launchId: bigint
}

export default function LaunchContributionCard({
  launchId,
}: LaunchContributionCardProps) {
  const sdk = usePonderSDK()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [launchInfo, setLaunchInfo] = useState<{
    totalRaised: bigint
    launched: boolean
    tokenAddress: string
    name: string
  } | null>(null)

  useEffect(() => {
    const fetchLaunchInfo = async () => {
      if (!sdk) return

      try {
        const info = await sdk.launcher.getLaunchInfo(launchId)
        setLaunchInfo({
          totalRaised: info.totalRaised,
          launched: info.launched,
          tokenAddress: info.tokenAddress,
          name: info.name,
        })
      } catch (err: any) {
        setError(err.message || 'Failed to fetch launch info')
      }
    }

    fetchLaunchInfo()
  }, [sdk, launchId])

  const handleContribute = async () => {
    if (!sdk || !amount) return

    try {
      setIsLoading(true)
      setError('')

      const tx = await sdk.launcher.contribute(launchId, parseEther(amount))

      setAmount('')
    } catch (err: any) {
      setError(err.message || 'Failed to contribute')
    } finally {
      setIsLoading(false)
    }
  }

  if ( !launchInfo) {
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

  return (
    <Card>
      <View gap={16}>
        <View gap={8}>
          <Text variant="title-3">Contribute to {launchInfo.name}</Text>
          <Text>Total Raised: {formatEther(launchInfo.totalRaised)} KUB</Text>

          {error && <Text>{error}</Text>}

          <View gap={4}>
            <Text>Amount (KUB)</Text>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full p-2 border rounded"
            />
          </View>
        </View>

        <Button
          onClick={handleContribute}
          disabled={isLoading || !amount}
          loading={isLoading}
          fullWidth
        >
          Contribute
        </Button>
      </View>
    </Card>
  )
}
