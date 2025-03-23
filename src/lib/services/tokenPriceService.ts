// src/lib/services/tokenPriceService.ts
// Server-only service for token pricing - this should never be imported in client components

import { formatUnits } from 'viem'
import { getRedisClient } from '@/src/lib/redis/client'
import {
  detectNeedsDecimalNormalization,
  getStablecoinAddresses,
  normalizePrice,
} from '@/src/lib/utils/tokePriceUtils'

// Constants
const CACHE_TTL_SECONDS = 300 // 5 minutes
const STABLECOIN_ADDRESSES = getStablecoinAddresses()

// Interface for token info
interface TokenInfo {
  decimals: number
  symbol: string
  address: string
}

/**
 * Service for handling token prices and conversions to USD
 * This service is meant to be used ONLY on the server
 */
export const TokenPriceService = {
  /**
   * Get the price of a token in USD
   * This uses caching when available and falls back to other methods
   */
  async getTokenPriceUSD(tokenId: string, tokenDecimals?: number): Promise<number> {
    try {
      // Try to get price from cache first
      const cachedPrice = await this.getCachedTokenPrice(tokenId)
      if (cachedPrice !== null) {
        return cachedPrice
      }

      // If we get here, we need to check with the database and blockchain

      // Import the server-only modules dynamically to avoid bundling issues
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      // Get the token info to verify decimals
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
      })

      if (!token) return 0

      // Get token decimals if not provided
      if (tokenDecimals === undefined) {
        tokenDecimals = token.decimals || 18
      }

      // 1. Try to get from stablecoin pairs in our database
      let priceFromPairs = await this.getPriceFromStablecoinPairs(
        tokenId,
        tokenDecimals,
        prisma
      )
      if (priceFromPairs > 0) {
        // Cache this price for future use
        await this.cacheTokenPrice(tokenId, priceFromPairs)
        return priceFromPairs
      }

      // 2. Try to get from price oracle if needed
      // This part would depend on your blockchain specific code

      // 3. If all else fails, return zero
      return 0
    } catch (error) {
      console.error(`Error getting USD price for token ${tokenId}:`, error)
      return 0
    }
  },

  /**
   * Get token price from stablecoin pairs in the database
   */
  async getPriceFromStablecoinPairs(
    tokenId: string,
    tokenDecimals?: number,
    prismaClient?: any
  ): Promise<number> {
    try {
      // Import Prisma if not provided
      if (!prismaClient) {
        const { PrismaClient } = await import('@prisma/client')
        prismaClient = new PrismaClient()
      }

      // Find the token
      const token = await prismaClient.token.findUnique({
        where: { id: tokenId },
      })

      if (!token) return 0

      // Get token decimals if not provided
      if (tokenDecimals === undefined) {
        tokenDecimals = token.decimals || 18
      }

      // Find pairs where this token is paired with a stablecoin
      const pairs = await prismaClient.pair.findMany({
        where: {
          OR: [
            {
              token0Id: tokenId,
              token1: {
                address: {
                  in: STABLECOIN_ADDRESSES,
                },
              },
            },
            {
              token1Id: tokenId,
              token0: {
                address: {
                  in: STABLECOIN_ADDRESSES,
                },
              },
            },
          ],
        },
        include: {
          token0: true,
          token1: true,
        },
      })

      // If no stablecoin pairs found
      if (pairs.length === 0) return 0

      // Get the most liquid pair (highest reserves)
      let bestPair = pairs[0]
      let highestReserves = 0

      for (const pair of pairs) {
        const isToken0 = pair.token0Id === tokenId
        const stablecoinReserve = parseFloat(isToken0 ? pair.reserve1 : pair.reserve0)
        if (stablecoinReserve > highestReserves) {
          highestReserves = stablecoinReserve
          bestPair = pair
        }
      }

      // Calculate price based on reserves
      const isToken0 = bestPair.token0Id === tokenId
      const pairToken = isToken0 ? bestPair.token0 : bestPair.token1
      const stablecoin = isToken0 ? bestPair.token1 : bestPair.token0

      // Get reserves
      const tokenReserveRaw = isToken0 ? bestPair.reserve0 : bestPair.reserve1
      const stablecoinReserveRaw = isToken0 ? bestPair.reserve1 : bestPair.reserve0

      // Get decimals
      const tokenDecimalsFinal = pairToken.decimals || 18
      const stablecoinDecimals = stablecoin.decimals || 18

      try {
        // Use viem to format the values
        const { formatUnits } = await import('viem')

        const tokenReserve = parseFloat(
          formatUnits(BigInt(tokenReserveRaw), tokenDecimalsFinal)
        )
        const stablecoinReserve = parseFloat(
          formatUnits(BigInt(stablecoinReserveRaw), stablecoinDecimals)
        )

        // Calculate price
        if (tokenReserve > 0) {
          return stablecoinReserve / tokenReserve
        }
      } catch (error) {
        console.error(`Error formatting reserves for token ${tokenId}:`, error)
      }

      return 0
    } catch (error) {
      console.error(
        `Error getting price from stablecoin pairs for token ${tokenId}:`,
        error
      )
      return 0
    }
  },

  /**
   * Get cached token price from Redis
   */
  async getCachedTokenPrice(tokenId: string): Promise<number | null> {
    try {
      const redis = getRedisClient()
      const cacheKey = `token:${tokenId}:priceUSD`

      const cachedValue = await redis.get(cacheKey)
      if (cachedValue) {
        return parseFloat(cachedValue)
      }

      return null
    } catch (error) {
      console.error(`Cache error for token ${tokenId}:`, error)
      return null
    }
  },

  /**
   * Cache a token price in Redis with expiration
   */
  async cacheTokenPrice(
    tokenId: string,
    price: number,
    ttlSeconds: number = CACHE_TTL_SECONDS
  ): Promise<void> {
    try {
      const redis = getRedisClient()
      const cacheKey = `token:${tokenId}:priceUSD`

      // Store the price with an expiration time
      await redis.set(cacheKey, price.toString(), 'EX', ttlSeconds)
    } catch (error) {
      console.error(`Error caching price for token ${tokenId}:`, error)
      // Non-blocking - we don't throw here as caching failures shouldn't break the app
    }
  },

  /**
   * Cache multiple token prices in a batch operation
   */
  async cacheTokenPricesBulk(
    prices: Array<{ tokenId: string; price: number }>,
    ttlSeconds: number = CACHE_TTL_SECONDS
  ): Promise<void> {
    try {
      const redis = getRedisClient()
      const pipeline = redis.pipeline()

      // Add all prices to the pipeline
      for (const { tokenId, price } of prices) {
        const cacheKey = `token:${tokenId}:priceUSD`
        pipeline.set(cacheKey, price.toString(), 'EX', ttlSeconds)
      }

      // Execute all commands in the pipeline
      await pipeline.exec()
    } catch (error) {
      console.error('Error caching token prices in bulk:', error)
      // Non-blocking - we don't throw here as caching failures shouldn't break the app
    }
  },

  // Re-export the utility functions for convenience on the server
  getStablecoinAddresses,
  normalizePrice,
  detectNeedsDecimalNormalization,
}
