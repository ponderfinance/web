import { View, Text } from 'reshaped'
import type { RouteDisplayProps } from '../types/swap'

export function RouteDisplay({
  route,
  tokenInInfo,
  tokenOutInfo,
  className,
}: RouteDisplayProps) {
  // Don't render anything if no route or direct swap
  if (!route || route.hops.length <= 1) return null

  const getTokenSymbol = (index: number) => {
    if (index === 0) return tokenInInfo?.symbol || 'Unknown'
    if (index === route.hops.length - 1) return tokenOutInfo?.symbol || 'Unknown'
    return `Token ${index}`
  }

  return (
    <View gap={2} className={className}>
      <Text variant="body-2" weight="medium" align="center">
        Route
      </Text>

      <View direction="row" justify="center" align="center" wrap gap={2}>
        {route.path.map((token: string, index: number) => (
          <View key={token} direction="row" align="center" gap={2}>
            {/* Token Name */}
            <View className="bg-neutral-100 rounded px-2 py-1">
              <Text variant="caption-1" color="neutral">
                {getTokenSymbol(index)}
              </Text>
            </View>

            {/* Arrow between tokens */}
            {index < route.path.length - 1 && (
              <Text variant="caption-1" color="neutral">
                →
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Routing Info */}
      {route.hops.length > 1 && (
        <Text variant="caption-1" color="neutral" align="center" className="mt-1">
          Best route found using {route.hops.length - 1} hop
          {route.hops.length > 2 ? 's' : ''}
        </Text>
      )}
    </View>
  )
}

export function RouteDisplaySkeleton() {
  return (
    <View gap={2} className="animate-pulse">
      <View className="h-4 w-16 bg-neutral-200 rounded mx-auto" />
      <View direction="row" justify="center" gap={2}>
        <View className="h-6 w-20 bg-neutral-200 rounded" />
        <View className="h-6 w-4 bg-neutral-200 rounded" />
        <View className="h-6 w-20 bg-neutral-200 rounded" />
      </View>
    </View>
  )
}

export default function RouteDisplayWithFallback(props: RouteDisplayProps) {
  if (!props.route) return null

  try {
    return <RouteDisplay {...props} />
  } catch (error) {
    console.error('RouteDisplay Error:', error)
    return (
      <View align="center">
        <Text variant="caption-1" color="critical">
          Failed to display route
        </Text>
      </View>
    )
  }
}
