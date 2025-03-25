// src/lib/services/tokenPriceService.ts
// Server-only service for token pricing - this should never be imported in client components

import { formatUnits } from 'viem'
import { getRedisClient } from '@/src/lib/redis/client'
import {
  detectNeedsDecimalNormalization,
  getStablecoinAddresses,
  normalizePrice,
} from '@/src/lib/utils/tokenPriceUtils'

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

  /**
   * Get reliable USD price for a token with multiple fallback mechanisms
   * This is a more comprehensive version of getTokenPriceUSD that tries multiple sources
   */
  async getReliableTokenUsdPrice(
    token: { id: string; address: string; decimals?: number; symbol?: string },
    prismaClient?: any
  ): Promise<number> {
    const tokenId = token.id
    const tokenAddress = token.address
    const tokenDecimals = token.decimals || 18
    const tokenSymbol = token.symbol || 'Unknown'

    // Track attempt methods for debugging
    const attemptMethods: string[] = []

    // 1. Try Redis cache first (fastest)
    attemptMethods.push('cache')
    try {
      const cachedPrice = await this.getCachedTokenPrice(tokenId)
      if (cachedPrice !== null && cachedPrice > 0) {
        return cachedPrice
      }
    } catch (error) {
      console.warn(`Cache lookup failed for ${tokenSymbol} (${tokenId})`, error)
    }

    // Import Prisma if not provided
    if (!prismaClient) {
      const { PrismaClient } = await import('@prisma/client')
      prismaClient = new PrismaClient()
    }

    // 2. Try database stored value
    attemptMethods.push('database')
    try {
      const tokenData = await prismaClient.token.findUnique({
        where: { id: tokenId },
        select: { priceUSD: true },
      })

      if (tokenData?.priceUSD && parseFloat(tokenData.priceUSD) > 0) {
        // Cache this value for future use
        await this.cacheTokenPrice(tokenId, parseFloat(tokenData.priceUSD))
        return parseFloat(tokenData.priceUSD)
      }
    } catch (error) {
      console.warn(`DB lookup failed for ${tokenSymbol} (${tokenId})`, error)
    }

    // 3. Try from stablecoin pairs (using existing method)
    attemptMethods.push('stablecoin pairs')
    try {
      const priceFromPairs = await this.getPriceFromStablecoinPairs(
        tokenId,
        tokenDecimals,
        prismaClient
      )

      if (priceFromPairs > 0) {
        await this.cacheTokenPrice(tokenId, priceFromPairs)
        return priceFromPairs
      }
    } catch (error) {
      console.warn(`Stablecoin pair lookup failed for ${tokenSymbol} (${tokenId})`, error)
    }

    // 4. Try reference tokens (tokens with reliable prices)
    attemptMethods.push('reference tokens')
    try {
      // Get list of tokens that have known prices
      const tokensWithPrices = await prismaClient.token.findMany({
        where: {
          priceUSD: { not: null },
          id: { not: tokenId }, // Exclude the current token
        },
        select: {
          id: true,
          address: true,
          symbol: true,
          priceUSD: true,
          decimals: true,
        },
        orderBy: [
          { createdAt: 'asc' }, // Older tokens are typically more established
        ],
        take: 10,
      })

      // Filter to tokens with valid prices
      const referenceTokens = tokensWithPrices.filter(
        (t: { priceUSD: string }) => t.priceUSD && parseFloat(t.priceUSD) > 0
      )

      for (const refToken of referenceTokens) {
        const refTokenPrice = parseFloat(refToken.priceUSD as string)

        // Find pair between our token and this reference token
        const pair = await prismaClient.pair.findFirst({
          where: {
            OR: [
              {
                token0Id: tokenId,
                token1Id: refToken.id,
              },
              {
                token0Id: refToken.id,
                token1Id: tokenId,
              },
            ],
          },
          include: {
            token0: true,
            token1: true,
          },
        })

        if (pair) {
          // Get the most recent price snapshot
          const snapshot = await prismaClient.priceSnapshot.findFirst({
            where: { pairId: pair.id },
            orderBy: { timestamp: 'desc' },
          })

          if (snapshot) {
            const isToken0 = pair.token0Id === tokenId
            const refIsToken0 = pair.token0Id === refToken.id

            if (isToken0 && !refIsToken0) {
              // Our token is token0, reference token is token1
              // token0Price is "how much token1 per token0"
              // Multiply: (token1 per token0) * (USD per token1) = USD per token0
              const price = parseFloat(snapshot.token0Price) * refTokenPrice

              if (price > 0) {
                await this.cacheTokenPrice(tokenId, price)
                console.log(
                  `Found ${tokenSymbol} price via reference token ${refToken.symbol}: $${price}`
                )
                return price
              }
            } else if (!isToken0 && refIsToken0) {
              // Our token is token1, reference token is token0
              // token1Price is "how much token0 per token1"
              // Multiply: (token0 per token1) * (USD per token0) = USD per token1
              const price = parseFloat(snapshot.token1Price) * refTokenPrice

              if (price > 0) {
                await this.cacheTokenPrice(tokenId, price)
                console.log(
                  `Found ${tokenSymbol} price via reference token ${refToken.symbol}: $${price}`
                )
                return price
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Reference token lookup failed for ${tokenSymbol} (${tokenId})`, error)
    }

    // 5. Try price derived from token0Price/token1Price in most liquid pair
    attemptMethods.push('price snapshots')
    try {
      // Find most liquid pair for this token
      const mostLiquidPair = await prismaClient.pair.findFirst({
        where: {
          OR: [{ token0Id: tokenId }, { token1Id: tokenId }],
        },
        orderBy: [
          { reserve0: 'desc' }, // Order by liquidity
        ],
        include: {
          token0: true,
          token1: true,
        },
      })

      if (mostLiquidPair) {
        const snapshot = await prismaClient.priceSnapshot.findFirst({
          where: { pairId: mostLiquidPair.id },
          orderBy: { timestamp: 'desc' },
        })

        if (snapshot) {
          const isToken0 = mostLiquidPair.token0Id === tokenId
          const counterpartToken = isToken0
            ? mostLiquidPair.token1
            : mostLiquidPair.token0

          // Try to get counterpart token's price
          const counterpartPrice = await this.getTokenPriceUSD(
            counterpartToken.id,
            counterpartToken.decimals
          )

          if (counterpartPrice > 0) {
            let price: number

            if (isToken0) {
              // Our token is token0, formula: token0Price * counterpartPrice
              price = parseFloat(snapshot.token0Price) * counterpartPrice
            } else {
              // Our token is token1, formula: counterpartPrice / token1Price
              const token1Price = parseFloat(snapshot.token1Price)
              price = token1Price > 0 ? counterpartPrice / token1Price : 0
            }

            if (price > 0) {
              await this.cacheTokenPrice(tokenId, price)
              return price
            }
          }
        }
      }
    } catch (error) {
      console.warn(
        `Price snapshot approach failed for ${tokenSymbol} (${tokenId})`,
        error
      )
    }

    // 6. If all else fails, return 0
    console.warn(
      `Failed to determine price for ${tokenSymbol} (${tokenId}) after trying: ${attemptMethods.join(', ')}`
    )
    return 0
  },

  /**
   * Get reliable counterpart token price for use in token price chart calculations
   * This is specifically designed for the tokenPriceChart resolver
   */
  async getCounterpartTokenPrice(
    counterpartToken: { id: string; address: string; decimals: number; symbol: string },
    isCounterpartStablecoin: boolean,
    prismaClient: any
  ): Promise<number> {
    // For stablecoins, we can apply a reasonable assumption that price is ~$1
    // but still try to get the actual market price first
    if (isCounterpartStablecoin) {
      const price = await this.getReliableTokenUsdPrice(counterpartToken, prismaClient)
      // If we found a price, use it
      if (price > 0) {
        return price
      }
      // For stablecoins with no reliable price data, assume ~$1
      return 1.0
    }

    // For non-stablecoins, use our comprehensive price lookup
    return await this.getReliableTokenUsdPrice(counterpartToken, prismaClient)
  },

  // Re-export the utility functions for convenience on the server
  getStablecoinAddresses,
  normalizePrice,
  detectNeedsDecimalNormalization,
}
