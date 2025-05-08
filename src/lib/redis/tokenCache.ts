import { getRedisClient } from './client'

const TOKEN_PREFIX = 'token:'

/**
 * Get cached token price
 * This is a read-only function - all updates should come from the indexer
 */
export async function getCachedTokenPrice(tokenId: string): Promise<string | null> {
  try {
    const redis = getRedisClient()
    const key = `${TOKEN_PREFIX}${tokenId}:priceUSD`

    const result = await redis.get(key)
    console.log(`Cache ${result ? 'HIT' : 'MISS'} for token ${tokenId} price`)
    return result
  } catch (error) {
    console.error(`Error getting cached priceUSD for token ${tokenId}:`, error)
    return null
  }
}

/**
 * Get multiple cached token prices at once
 * This is a read-only function - all updates should come from the indexer
 */
export async function getCachedTokenPricesBulk(
  tokenIds: string[]
): Promise<Record<string, string>> {
  if (tokenIds.length === 0) return {}

  try {
    const redis = getRedisClient()
    // Use MGET for better performance
    const keys = tokenIds.map((id) => `${TOKEN_PREFIX}${id}:priceUSD`)
    const values = await redis.mget(...keys)

    const result: Record<string, string> = {}
    tokenIds.forEach((id, index) => {
      if (values[index]) {
        result[id] = values[index]
      }
    })

    return result
  } catch (error) {
    console.error('Redis bulk get error for token prices:', error)
    return {}
  }
}
