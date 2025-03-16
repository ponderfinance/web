import { getRedisClient } from './client'
import { PrismaClient } from '@prisma/client'
import { USDT_ADDRESS } from '@/src/lib/graphql/oracleUtils'

const TOKEN_CACHE_TTL = 5 * 60 // 5 minutes in seconds
const TOKEN_PREFIX = 'token:'

/**
 * Cache token price values
 */
export async function cacheTokenPrice(tokenId: string, priceUSD: string): Promise<void> {
  try {
    const redis = getRedisClient()
    const key = `${TOKEN_PREFIX}${tokenId}:priceUSD`

    await redis.set(key, priceUSD, 'EX', TOKEN_CACHE_TTL)
  } catch (error) {
    console.error(`Error caching priceUSD for token ${tokenId}:`, error)
    // Continue execution even if caching fails
  }
}

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

/**
 * Cache multiple token price values in a single operation
 */
export async function cacheTokenPricesBulk(
  tokens: Array<{ id: string; priceUSD: string }>,
  ttl = TOKEN_CACHE_TTL
): Promise<void> {
  if (tokens.length === 0) return

  try {
    const redis = getRedisClient()
    const pipeline = redis.pipeline()

    for (const token of tokens) {
      const key = `${TOKEN_PREFIX}${token.id}:priceUSD`
      pipeline.set(key, token.priceUSD, 'EX', ttl)
    }

    await pipeline.exec()
  } catch (error) {
    console.error('Error bulk caching token price values:', error)
  }
}

/**
 * Preload token price cache from database snapshots
 */
export async function preloadTokenPriceCache(prisma: PrismaClient): Promise<void> {
  try {
    console.log('Preloading token price cache from pair snapshots...')

    // Get all tokens
    const tokens = await prisma.token.findMany({
      select: { id: true, address: true },
    })

    console.log(`Found ${tokens.length} tokens to check for price data`)

    // Find token prices from pairs with USDT
    const usdtPairs = await prisma.pair.findMany({
      where: {
        OR: [
          { token0: { address: USDT_ADDRESS.toLowerCase() } },
          { token1: { address: USDT_ADDRESS.toLowerCase() } },
        ],
      },
      include: {
        token0: { select: { id: true, address: true } },
        token1: { select: { id: true, address: true } },
      },
    })

    const tokenPrices: Array<{ id: string; priceUSD: string }> = []

    // Get price snapshots for tokens paired with USDT
    for (const pair of usdtPairs) {
      try {
        const nonUsdtToken =
          pair.token0.address.toLowerCase() === USDT_ADDRESS.toLowerCase()
            ? pair.token1
            : pair.token0

        const latestSnapshot = await prisma.priceSnapshot.findFirst({
          where: { pairId: pair.id },
          orderBy: { timestamp: 'desc' },
        })

        if (latestSnapshot) {
          // Calculate price based on which token is USDT in the pair
          const priceUSD =
            pair.token0.address.toLowerCase() === USDT_ADDRESS.toLowerCase()
              ? latestSnapshot.token1Price // USDT is token0, so we want token1 price in terms of USDT
              : latestSnapshot.token0Price // USDT is token1, so we want token0 price in terms of USDT

          tokenPrices.push({
            id: nonUsdtToken.id,
            priceUSD,
          })
        }
      } catch (error) {
        console.error(`Error processing pair ${pair.id}:`, error)
      }
    }

    // Cache all found prices in bulk
    if (tokenPrices.length > 0) {
      await cacheTokenPricesBulk(tokenPrices)
      console.log(`Successfully cached prices for ${tokenPrices.length} tokens`)
    } else {
      console.log('No token prices found from snapshots')
    }
  } catch (error) {
    console.error('Error preloading token price cache:', error)
  }
}
