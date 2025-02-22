import { Button, Link, Skeleton, Text, View } from 'reshaped'
import { useStakingInfo } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { shortenNumber } from '@/src/app/utils/numbers'
import Image from "next/image";

export const XKOIButton = () => {
  const { address } = useAccount()
  const { data: stakingInfo, isLoading: isLoadingInfo } = useStakingInfo(address)

  if (!stakingInfo?.userShares) return null

  return (
    <Button variant="outline" rounded={true} color="neutral">
      <Link href="/xkoi" attributes={{ style: { textDecoration: 'none' } }}>
        <View direction="row" gap={2} align="center" justify="center">
          <Image height={32} width={32} src={'/xkoi-logo.png'} alt={'xKoi Coin'} />
          <View direction="row" gap={1}>
            <Text variant="caption-1" color="neutral">
              {shortenNumber(formatUnits(stakingInfo?.userShares, 18))}
            </Text>
            <Text variant="caption-1" color="neutral">xKOI</Text>
          </View>
        </View>
      </Link>
    </Button>
  )
}
