import { View, Text } from 'reshaped'
import { formatUnits } from 'viem'
import type { SwapDetailsProps } from '../types/swap'

export function SwapDetails({
  route,
  minimumReceived,
  tokenOutInfo,
  tokenInInfo,
  gasEstimate,
}: SwapDetailsProps) {
  const showPriceImpactWarning = (route?.priceImpact || 0) > 2
  const showCriticalPriceImpactWarning = (route?.priceImpact || 0) > 5

  const getPriceImpactColor = () => {
    if (showCriticalPriceImpactWarning) return 'critical'
    if (showPriceImpactWarning) return 'warning'
    return 'neutral'
  }

  return (
    <View gap={4} className="bg-neutral-50 rounded-lg p-4">
      {/* Price Impact */}
      <View direction="row" justify="space-between" align="center">
        <Text variant="body-2">Price Impact</Text>
        <Text
          variant="body-2"
          color={getPriceImpactColor()}
          weight={showPriceImpactWarning ? 'medium' : 'regular'}
        >
          {route.priceImpact.toFixed(2)}%
        </Text>
      </View>

      {/* Minimum Received */}
      <View direction="row" justify="space-between" align="center">
        <Text variant="body-2">Minimum Received</Text>
        <Text variant="body-2" color="neutral">
          {minimumReceived?.formatted} {tokenOutInfo?.symbol}
        </Text>
      </View>

      {/* Network Fee */}
      {gasEstimate && (
        <View direction="row" justify="space-between" align="center">
          <Text variant="body-2">Network Fee</Text>
          <Text variant="body-2" color="neutral">
            {gasEstimate.estimateInKUB} KUB
          </Text>
        </View>
      )}

      {/* Trading Fee */}
      {route.totalFee > BigInt(0) && tokenInInfo && (
        <View direction="row" justify="space-between" align="center">
          <Text variant="body-2">Trading Fee</Text>
          <Text variant="body-2" color="neutral">
            {formatUnits(route.totalFee, tokenInInfo.decimals || 18)} {tokenInInfo.symbol}
          </Text>
        </View>
      )}

      {/* Price Impact Warning */}
      {showPriceImpactWarning && (
        <Text
          variant="body-2"
          color={showCriticalPriceImpactWarning ? 'critical' : 'warning'}
          align="center"
          className="mt-2"
        >
          {showCriticalPriceImpactWarning
            ? `Warning: High price impact (${route.priceImpact.toFixed(2)}% loss)`
            : `High price impact (${route.priceImpact.toFixed(2)}% loss). Consider reducing trade size.`}
        </Text>
      )}
    </View>
  )
}

export function SwapDetailsSkeleton() {
  return (
    <View gap={4} className="bg-neutral-50 rounded-lg p-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <View key={i} direction="row" justify="space-between" align="center">
          <View className="h-4 w-24 bg-neutral-200 rounded" />
          <View className="h-4 w-20 bg-neutral-200 rounded" />
        </View>
      ))}
    </View>
  )
}

export default function SwapDetailsWithFallback(props: SwapDetailsProps) {
  if (!props.route) return <SwapDetailsSkeleton />

  try {
    return <SwapDetails {...props} />
  } catch (error) {
    console.error('SwapDetails Error:', error)
    return (
      <View gap={2} className="bg-red-50 rounded-lg p-4">
        <Text color="critical">Failed to load swap details.</Text>
        <Text variant="body-2" color="neutral">
          Please try refreshing the page.
        </Text>
      </View>
    )
  }
}
