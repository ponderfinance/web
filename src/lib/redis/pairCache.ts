import { getRedisClient } from './client'

const PREFIX = 'pair:'

/**
 * Get cached pair reserveUsd value
 * This is a read-only function - all updates should come from the indexer
 */
export async function getCachedPairReserveUSD(pairId: string): Promise<string | null> {
  try {
    const redis = getRedisClient()
    const key = `${PREFIX}${pairId}:reserveUsd`

    const result = await redis.get(key)
    console.log(`Cache ${result ? 'HIT' : 'MISS'} for pair ${pairId}`)
    return result
  } catch (error) {
    console.error(`Error getting cached reserveUsd for pair ${pairId}:`, error)
    return null
  }
}

/**
 * Get multiple pair reserveUsd values at once
 * This is a read-only function - all updates should come from the indexer
 */
export async function getCachedPairReserveUSDBulk(
  pairIds: string[]
): Promise<Record<string, string>> {
  if (pairIds.length === 0) return {}

  try {
    const redis = getRedisClient()
    // Use MGET instead of pipeline for better performance
    const keys = pairIds.map((id) => `${PREFIX}${id}:reserveUsd`)
    const values = await redis.mget(...keys)

    const result: Record<string, string> = {}
    pairIds.forEach((id, index) => {
      if (values[index]) {
        result[id] = values[index]
      }
    })

    return result
  } catch (error) {
    console.error('Redis bulk get error:', error)
    return {}
  }
}
