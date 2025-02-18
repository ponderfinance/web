import { Button, Link, Skeleton, Text, View } from 'reshaped'
import { useStakingInfo } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { shortenNumber } from '@/src/app/utils/numbers'

export const XKOIButton = () => {
  const { address } = useAccount()
  const { data: stakingInfo, isLoading: isLoadingInfo } = useStakingInfo(address)

  if (!stakingInfo?.userShares) return null

  return (
    <Button variant="outline" rounded={true} color="primary">
      <Link href="/xkoi" attributes={{ style: { textDecoration: 'none' } }}>
        <View direction="row" gap={2} align="center" justify="center">
          <Skeleton height={5} width={5} borderRadius="circular" />
          <View direction="row" gap={1}>
            <Text variant="caption-1">
              {shortenNumber(formatUnits(stakingInfo?.userShares, 18))}
            </Text>
            <Text variant="caption-1">xKOI</Text>
          </View>
        </View>
      </Link>
    </Button>
  )
}
