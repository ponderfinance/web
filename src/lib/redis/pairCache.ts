import { PrismaClient } from '@prisma/client'
import { getRedisClient } from './client'

const CACHE_TTL = 5 * 60 // 5 minutes in seconds
const PREFIX = 'pair:'

/**
 * Cache pair reserveUSD values
 */
export async function cachePairReserveUSD(
  pairId: string,
  reserveUSD: string
): Promise<void> {
  try {
    const redis = getRedisClient()
    const key = `${PREFIX}${pairId}:reserveUSD`

    await redis.set(key, reserveUSD, 'EX', CACHE_TTL)
  } catch (error) {
    console.error(`Error caching reserveUSD for pair ${pairId}:`, error)
    // Continue execution even if caching fails
  }
}

export async function getCachedPairReserveUSD(pairId: string): Promise<string | null> {
  try {
    const redis = getRedisClient()
    const key = `${PREFIX}${pairId}:reserveUSD`

    const result = await redis.get(key)
    console.log(`Cache ${result ? 'HIT' : 'MISS'} for pair ${pairId}`)
    return result
  } catch (error) {
    console.error(`Error getting cached reserveUSD for pair ${pairId}:`, error)
    return null
  }
}

export async function getCachedPairReserveUSDBulk(
  pairIds: string[]
): Promise<Record<string, string>> {
  if (pairIds.length === 0) return {}

  try {
    const redis = getRedisClient()
    // Use MGET instead of pipeline for better performance
    const keys = pairIds.map((id) => `${PREFIX}${id}:reserveUSD`)
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

/**
 * Cache multiple pair reserveUSD values in a single operation
 */
export async function cachePairReserveUSDBulk(
  pairs: Array<{ id: string; reserveUSD: string }>,
  ttl = CACHE_TTL
): Promise<void> {
  if (pairs.length === 0) return

  try {
    const redis = getRedisClient()
    const pipeline = redis.pipeline()

    for (const pair of pairs) {
      const key = `${PREFIX}${pair.id}:reserveUSD`
      pipeline.set(key, pair.reserveUSD, 'EX', ttl)
    }

    await pipeline.exec()
  } catch (error) {
    console.error('Error bulk caching pair reserveUSD values:', error)
  }
}

export async function preloadCacheFromSnapshots(prisma: PrismaClient): Promise<void> {
  try {
    console.log('Preloading pair reserveUSD cache from existing snapshots...')

    // Get all pairs
    const pairs = await prisma.pair.findMany()
    console.log(`Found ${pairs.length} pairs to cache`)

    // For each pair, get the latest snapshot
    const pairsToCache: Array<{ id: string; reserveUSD: string }> = []

    for (const pair of pairs) {
      const latestSnapshot = await prisma.pairReserveSnapshot.findFirst({
        where: { pairId: pair.id },
        orderBy: { timestamp: 'desc' },
      })

      if (latestSnapshot) {
        pairsToCache.push({
          id: pair.id,
          reserveUSD: latestSnapshot.reserveUSD,
        })
        console.log(
          `Found snapshot for pair ${pair.id} with reserveUSD: ${latestSnapshot.reserveUSD}`
        )
      }
    }

    // Bulk cache all found values
    if (pairsToCache.length > 0) {
      await cachePairReserveUSDBulk(pairsToCache)
      console.log(`Successfully cached reserveUSD for ${pairsToCache.length} pairs`)

      // Verify a few random entries to confirm caching worked
      if (pairsToCache.length > 0) {
        const redis = getRedisClient()
        const samplePair = pairsToCache[0]
        const key = `pair:${samplePair.id}:reserveUSD`
        const cachedValue = await redis.get(key)
        console.log(`Verification - Cached value for ${samplePair.id}: ${cachedValue}`)
      }
    } else {
      console.log('No snapshots found to cache')
    }
  } catch (error) {
    console.error('Error preloading cache from snapshots:', error)
  }
}
