// src/lib/services/tokenPriceService.ts
// Server-only service for token pricing - this should never be imported in client components

import { formatUnits, parseUnits } from 'viem'
import { getRedisClient } from '@/src/lib/redis/client'
import prismaClient from '@/src/lib/db/prisma'
import { createPublicClient, http } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { ORACLE_ABI } from '@/src/constants/abis'
import { ORACLE_ADDRESS } from '@/src/constants/addresses'
import {
  detectNeedsDecimalNormalization,
  getStablecoinAddresses,
  normalizePrice,
  isStablecoin,
  isStablecoinBySymbol,
  getStablecoinSymbols,
} from '@/src/lib/utils/tokenPriceUtils'

// Constants
const CACHE_TTL_SECONDS = 300 // 5 minutes
const STABLECOIN_ADDRESSES = getStablecoinAddresses()

// Create a viem public client for blockchain interactions
const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(CURRENT_CHAIN.rpcUrls.default.http[0]),
})

// Define types for Prisma models we use
type Token = {
  id: string;
  address: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
  priceUSD?: string | null;
}

type Pair = {
  id: string;
  address: string;
  token0Id: string;
  token1Id: string;
  reserve0: string;
  reserve1: string;
}

type PairWithTokens = Pair & {
  token0: Token
  token1: Token
}

// Interface for token info
interface TokenInfo {
  decimals: number
  address: string
}

// Define a type for any Prisma client instance
type PrismaClientType = typeof prismaClient;

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
      console.log(`Starting getTokenPriceUSD for token ${tokenId}`)
      
      // Try to get price from cache first
      const cachedPrice = await this.getCachedTokenPrice(tokenId)
      if (cachedPrice !== null && cachedPrice > 0) {
        console.log(`Using cached price ${cachedPrice} for token ${tokenId}`)
        return cachedPrice
      }

      // Get the token info
      const token = await prismaClient.token.findUnique({
        where: { id: tokenId },
        select: {
          id: true,
          address: true,
          decimals: true,
          symbol: true
        }
      })

      if (!token) {
        console.warn(`Token ${tokenId} not found in database`)
        return 0
      }

      console.log(`Found token ${token.symbol} (${token.address}) with decimals ${token.decimals}`)

      // Use our comprehensive price lookup with all fallbacks
      const price = await this.getReliableTokenUsdPrice({
        id: token.id,
        address: token.address,
        decimals: token.decimals || 18,
        symbol: token.symbol || undefined
      }, prismaClient)
      
      if (price > 0) {
        console.log(`Got valid price ${price} for token ${token.symbol}`)
        // Cache this price for future use (5 minutes TTL)
        await this.cacheTokenPrice(tokenId, price, 300)
        return price
      }

      console.warn(`Could not find valid price for token ${token.symbol} from any source`)
      return 0
    } catch (error) {
      console.error(`Error getting USD price for token ${tokenId}:`, error)
      return 0
    }
  },

  /**
   * Get prices for multiple tokens in a single batch operation
   * This is much more efficient than calling getTokenPriceUSD multiple times
   */
  async getTokenPricesUSDBulk(tokenIds: string[]): Promise<Record<string, string>> {
    try {
      const redis = getRedisClient()
      const results: Record<string, string> = {}
      
      // Step 1: Try to get all prices from Redis cache in one batch
      const cacheKeys = tokenIds.map(id => `token:${id}:priceUSD`)
      const cachedPrices = await redis.mget(cacheKeys)
      
      // Process cached results and identify missing prices
      const missingPriceIds: string[] = []
      const pricesToCache: Array<{ tokenId: string; price: string }> = []
      
      tokenIds.forEach((id, index) => {
        const cachedPrice = cachedPrices[index]
        if (cachedPrice) {
          results[id] = cachedPrice
        } else {
          missingPriceIds.push(id)
        }
      })
      
      if (missingPriceIds.length === 0) {
        return results
      }
      
      // Step 2: For missing prices, get tokens information in one batch query
      const tokens = await prismaClient.token.findMany({
        where: { id: { in: missingPriceIds } },
        select: {
          id: true,
          address: true,
          symbol: true,
          decimals: true,
          priceUSD: true
        }
      })
      
      // First use any prices already in the database
      const tokensNeedingPrices = tokens.filter((token: Token) => {
        if (token.priceUSD) {
          // Use the database price if available
          results[token.id] = token.priceUSD
          pricesToCache.push({ tokenId: token.id, price: token.priceUSD })
          return false
        }
        return true
      })
      
      if (tokensNeedingPrices.length === 0) {
        // Cache any prices we found in the database
        if (pricesToCache.length > 0) {
          await this.cacheTokenPricesBulk(
            pricesToCache.map(({ tokenId, price }) => ({
              tokenId,
              price: parseFloat(price)
            }))
          )
        }
        return results
      }

      // Step 3: Calculate missing prices in parallel
      const pricePromises = tokensNeedingPrices.map(async (token: Token) => {
        try {
          const price = await this.getReliableTokenUsdPrice({
            id: token.id,
            address: token.address,
            decimals: token.decimals || 18,
            symbol: token.symbol || undefined
          }, prismaClient)
          
          if (price > 0) {
            results[token.id] = price.toString()
            pricesToCache.push({ tokenId: token.id, price: price.toString() })
          } else {
            results[token.id] = '0'
          }
        } catch (error) {
          console.error(`Error calculating price for token ${token.id}:`, error)
          results[token.id] = '0'
        }
      })

      await Promise.all(pricePromises)

      // Cache all newly calculated prices
      if (pricesToCache.length > 0) {
        await this.cacheTokenPricesBulk(
          pricesToCache.map(({ tokenId, price }) => ({
            tokenId,
            price: parseFloat(price)
          }))
        )
      }

      return results
    } catch (error) {
      console.error('Error in getTokenPricesUSDBulk:', error)
      return {}
    }
  },

  /**
   * Get token price from stablecoin pairs in the database
   */
  async getPriceFromStablecoinPairs(
    tokenId: string,
    tokenDecimals?: number,
    prismaDb?: PrismaClientType
  ): Promise<number> {
    try {
      const prisma = prismaDb || prismaClient;

      // Get stablecoin symbols
      const stablecoinSymbols = getStablecoinSymbols();

      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        include: {
          pairsAsToken0: {
            include: {
              token0: true,
              token1: true
            },
            where: {
              token1: {
                symbol: {
                  in: stablecoinSymbols
                }
              }
            }
          },
          pairsAsToken1: {
            include: {
              token0: true,
              token1: true
            },
            where: {
              token0: {
                symbol: {
                  in: stablecoinSymbols
                }
              }
            }
          }
        }
      })

      if (!token) {
        console.warn(`Token ${tokenId} not found in database`)
        return 0
      }

      // Combine all relevant pairs
      const allPairs = [
        ...(token.pairsAsToken0 as PairWithTokens[]),
        ...(token.pairsAsToken1 as PairWithTokens[])
      ]
      if (allPairs.length === 0) {
        console.warn(`No stablecoin pairs found for token ${tokenId}`)
        return 0
      }

      console.log(`Found ${allPairs.length} stablecoin pairs for token ${tokenId}`)

      // Find the pair with the highest liquidity
      const bestPair = allPairs.reduce((best, current) => {
        const currentReserves = BigInt(current.reserve0) + BigInt(current.reserve1)
        const bestReserves = BigInt(best.reserve0) + BigInt(best.reserve1)
        return currentReserves > bestReserves ? current : best
      })

      console.log(`Selected best pair ${bestPair.address} with reserves: ${bestPair.reserve0}, ${bestPair.reserve1}`)

      // Determine if our token is token0 or token1 in the pair
      const isToken0 = bestPair.token0Id === tokenId

      // Get the stablecoin from the pair
      const stablecoin = isToken0 ? bestPair.token1 : bestPair.token0
      console.log(`Using stablecoin ${stablecoin.symbol} (${stablecoin.address})`)

      // Get reserves
      const tokenReserveRaw = isToken0 ? bestPair.reserve0 : bestPair.reserve1
      const stablecoinReserveRaw = isToken0 ? bestPair.reserve1 : bestPair.reserve0

      // Get decimals
      const tokenDecimalsFinal = tokenDecimals || token.decimals || 18
      const stablecoinDecimals = stablecoin.decimals || 18

      console.log(`Using decimals - token: ${tokenDecimalsFinal}, stablecoin: ${stablecoinDecimals}`)

      try {
        const { formatUnits, parseUnits } = await import('viem')

        // Format reserves using viem's formatUnits
        const tokenReserve = parseFloat(
          formatUnits(BigInt(tokenReserveRaw), tokenDecimalsFinal)
        )
        const stablecoinReserve = parseFloat(
          formatUnits(BigInt(stablecoinReserveRaw), stablecoinDecimals)
        )

        console.log(`Formatted reserves - token: ${tokenReserve}, stablecoin: ${stablecoinReserve}`)

        if (tokenReserve > 0) {
          // Calculate price using viem's utilities
          // First, get the amount of stablecoin for 1 unit of the token
          const oneToken = parseUnits('1', tokenDecimalsFinal)
          const priceInStablecoin = (BigInt(stablecoinReserveRaw) * oneToken) / BigInt(tokenReserveRaw)
          
          // Format the result to get the USD price
          const price = parseFloat(formatUnits(priceInStablecoin, stablecoinDecimals))
          
          console.log(`Raw reserves - token: ${tokenReserveRaw}, stablecoin: ${stablecoinReserveRaw}`)
          console.log(`Decimals - token: ${tokenDecimalsFinal}, stablecoin: ${stablecoinDecimals}`)
          console.log(`Calculated price: ${price} USD per ${token.symbol || token.address}`)
          
          // Basic sanity check - price should be positive and reasonable
          if (price > 0.000001 && price < 1000000000) {
            return price
          } else {
            console.warn(`Calculated price ${price} appears outside reasonable bounds for token ${token.symbol || token.address}`)
            return 0
          }
        } else {
          console.warn(`Token reserve is 0 for pair ${bestPair.address}`)
        }
      } catch (error) {
        console.error(`Error formatting reserves for token ${tokenId}:`, error)
      }

      return 0
    } catch (error) {
      console.error(`Error getting price from stablecoin pairs for token ${tokenId}:`, error)
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
        const price = parseFloat(cachedValue)
        // Validate the cached price
        if (!isNaN(price) && price >= 0) {
          return price
        }
      }

      return null
    } catch (error) {
      console.error(`Error getting cached price for token ${tokenId}:`, error)
      return null
    }
  },

  /**
   * Cache token price in Redis
   */
  async cacheTokenPrice(tokenId: string, price: number, ttlSeconds: number = 300): Promise<void> {
    try {
      const redis = getRedisClient()
      const cacheKey = `token:${tokenId}:priceUSD`

      // Only cache valid prices
      if (!isNaN(price) && price > 0 && price < 1e10) {
        await redis.set(cacheKey, price.toString(), 'EX', ttlSeconds)
      } else {
        console.warn(`Invalid price ${price} for token ${tokenId} - not caching`)
      }
    } catch (error) {
      console.error(`Error caching price for token ${tokenId}:`, error)
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
    prismaDb?: PrismaClientType
  ): Promise<number> {
    const tokenId = token.id
    const tokenAddress = token.address
    const tokenDecimals = token.decimals || 18
    const tokenSymbol = token.symbol || 'Unknown'

    console.log(`Starting price resolution for ${tokenSymbol} (${tokenId})`)

    // Track attempt methods for debugging
    const attemptMethods: string[] = []

    // 1. Try Redis cache first (fastest)
    attemptMethods.push('cache')
    try {
      const cachedPrice = await this.getCachedTokenPrice(tokenId)
      if (cachedPrice !== null && cachedPrice > 0) {
        console.log(`Found cached price ${cachedPrice} for ${tokenSymbol}`)
        return cachedPrice
      }
    } catch (error) {
      console.warn(`Cache lookup failed for ${tokenSymbol} (${tokenId})`, error)
    }

    // Use the provided prisma client or the global instance
    const db = prismaDb || prismaClient

    // 2. Try database stored value
    attemptMethods.push('database')
    try {
      const tokenData = await db.token.findUnique({
        where: { id: tokenId },
        select: { priceUSD: true },
      })

      if (tokenData?.priceUSD) {
        const dbPrice = parseFloat(tokenData.priceUSD)
        // Only accept database price if it's reasonable (not extremely small)
        if (dbPrice > 0.000001) {
          console.log(`Found valid database price ${dbPrice} for ${tokenSymbol}`)
          await this.cacheTokenPrice(tokenId, dbPrice)
          return dbPrice
        } else {
          console.log(`Found invalid database price ${dbPrice} for ${tokenSymbol}, will recalculate`)
          // Clear invalid price from database
          await db.token.update({
            where: { id: tokenId },
            data: { priceUSD: null }
          })
        }
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
        db
      )

      if (priceFromPairs > 0.000001) {  // Only accept reasonable prices
        console.log(`Found valid price ${priceFromPairs} from stablecoin pairs for ${tokenSymbol}`)
        // Store in database and cache
        try {
          await db.token.update({
            where: { id: tokenId },
            data: { priceUSD: priceFromPairs.toString() }
          })
          console.log(`Updated database with price ${priceFromPairs} for ${tokenSymbol}`)
        } catch (error) {
          console.error(`Failed to update database with price for ${tokenSymbol}:`, error)
        }
        await this.cacheTokenPrice(tokenId, priceFromPairs)
        return priceFromPairs
      } else {
        console.log(`Found invalid price ${priceFromPairs} from stablecoin pairs for ${tokenSymbol}, trying next method`)
      }
    } catch (error) {
      console.warn(`Stablecoin pair lookup failed for ${tokenSymbol} (${tokenId})`, error)
    }

    // 4. Try reference tokens (tokens with reliable prices)
    attemptMethods.push('reference tokens')
    try {
      // Get list of tokens that have known prices
      const tokensWithPrices = await db.token.findMany({
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

      console.log(`Found ${tokensWithPrices.length} reference tokens for ${tokenSymbol}`)

      // Filter to tokens with valid prices
      const referenceTokens = tokensWithPrices.filter(
        (t: Token) => t.priceUSD && parseFloat(t.priceUSD) > 0
      )

      for (const refToken of referenceTokens) {
        const refTokenPrice = parseFloat(refToken.priceUSD as string)
        console.log(`Trying reference token ${refToken.symbol} with price ${refTokenPrice}`)

        // Find pair between our token and this reference token
        const pair = await db.pair.findFirst({
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
          console.log(`Found pair ${pair.address} with reference token ${refToken.symbol}`)
          // Get the most recent price snapshot
          const snapshot = await db.priceSnapshot.findFirst({
            where: { pairId: pair.id },
            orderBy: { timestamp: 'desc' },
          })

          if (snapshot) {
            const isToken0 = pair.token0Id === tokenId
            const refIsToken0 = pair.token0Id === refToken.id

            try {
              // Import viem's formatUnits to properly handle blockchain values
              const { formatUnits } = await import('viem')
              
              // Get the raw price
              let rawPrice: string
              if (isToken0 && !refIsToken0) {
                // Our token is token0, reference token is token1
                rawPrice = snapshot.price0 || snapshot.token0Price
              } else if (!isToken0 && refIsToken0) {
                // Our token is token1, reference token is token0
                rawPrice = snapshot.price1 || snapshot.token1Price
              } else {
                // This shouldn't happen in a properly formed pair
                console.warn(`Invalid pair configuration for ${pair.address}`)
                continue
              }
              
              if (!rawPrice) {
                console.warn(`No price available in snapshot for ${pair.address}`)
                continue
              }
              
              // Use the token's decimals for proper normalization
              const tokenDecimalsFinal = isToken0 ? (pair.token0.decimals || 18) : (pair.token1.decimals || 18)
              
              // Normalize the raw price using viem's formatUnits
              // This properly handles the large blockchain values
              const normalizedPrice = parseFloat(formatUnits(BigInt(rawPrice), tokenDecimalsFinal))
              console.log(`Normalized price from ${rawPrice} to ${normalizedPrice} using ${tokenDecimalsFinal} decimals`)
              
              // Calculate the final price in USD
              const calculatedPrice = normalizedPrice * refTokenPrice
              
              console.log(`Calculated price ${calculatedPrice} from ${normalizedPrice} * ${refTokenPrice}`)
              
              // Validate the price is reasonable
              if (calculatedPrice > 0 && calculatedPrice < 1000000) {
                try {
                  await db.token.update({
                    where: { id: tokenId },
                    data: { priceUSD: calculatedPrice.toString() }
                  })
                  console.log(`Updated database with price ${calculatedPrice} for ${tokenSymbol}`)
                } catch (error) {
                  console.error(`Failed to update database with price for ${tokenSymbol}:`, error)
                }
                await this.cacheTokenPrice(tokenId, calculatedPrice)
                return calculatedPrice
              } else {
                console.warn(`Calculated price ${calculatedPrice} appears outside reasonable bounds`)
              }
            } catch (error) {
              console.error(`Error normalizing price for ${tokenSymbol}:`, error)
              // Continue to try other approaches
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
      const mostLiquidPair = await db.pair.findFirst({
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
        console.log(`Found most liquid pair ${mostLiquidPair.address} for ${tokenSymbol}`)
        const snapshot = await db.priceSnapshot.findFirst({
          where: { pairId: mostLiquidPair.id },
          orderBy: { timestamp: 'desc' },
        })

        if (snapshot) {
          const isToken0 = mostLiquidPair.token0Id === tokenId
          const counterpartToken = isToken0
            ? mostLiquidPair.token1
            : mostLiquidPair.token0

          console.log(`Getting counterpart token ${counterpartToken.symbol} price`)
          // Try to get counterpart token's price
          const counterpartPrice = await this.getTokenPriceUSD(
            counterpartToken.id,
            counterpartToken.decimals ?? undefined
          )

          if (counterpartPrice > 0) {
            try {
              // Import viem for proper formatting
              const { formatUnits } = await import('viem')
              
              // Get the raw price from the snapshot
              let rawPrice: string
              if (isToken0) {
                // Our token is token0
                rawPrice = snapshot.price0 || snapshot.token0Price
              } else {
                // Our token is token1
                rawPrice = snapshot.price1 || snapshot.token1Price
              }
              
              if (!rawPrice) {
                console.warn(`No price available in snapshot for ${mostLiquidPair.address}`)
                return 0
              }
              
              // Use the token's decimals for proper normalization
              const tokenDecimalsFinal = isToken0 
                ? (mostLiquidPair.token0.decimals || 18) 
                : (mostLiquidPair.token1.decimals || 18)
              
              // Normalize the raw price using viem's formatUnits
              const normalizedPrice = parseFloat(formatUnits(BigInt(rawPrice), tokenDecimalsFinal))
              console.log(`Normalized price from ${rawPrice} to ${normalizedPrice} using ${tokenDecimalsFinal} decimals`)
              
              // Calculate the final price in USD
              const calculatedPrice = normalizedPrice * counterpartPrice
              console.log(`Calculated price ${calculatedPrice} from ${normalizedPrice} * ${counterpartPrice}`)
              
              // Validate the price is reasonable
              if (calculatedPrice > 0 && calculatedPrice < 1000000) {
                try {
                  await db.token.update({
                    where: { id: tokenId },
                    data: { priceUSD: calculatedPrice.toString() }
                  })
                  console.log(`Updated database with price ${calculatedPrice} for ${tokenSymbol}`)
                } catch (error) {
                  console.error(`Failed to update database with price for ${tokenSymbol}:`, error)
                }
                await this.cacheTokenPrice(tokenId, calculatedPrice)
                return calculatedPrice
              } else {
                console.warn(`Calculated price ${calculatedPrice} appears outside reasonable bounds`)
              }
            } catch (error) {
              console.error(`Error normalizing price for ${tokenSymbol}:`, error)
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
    // For all tokens, try to get the actual market price first
    const price = await this.getReliableTokenUsdPrice(counterpartToken, prismaClient);
    
    // If we found a price, use it
    if (price > 0) {
      return price;
    }
    
    // Only for stablecoins as a last resort, assume ~$1
    if (isCounterpartStablecoin || 
        isStablecoin(counterpartToken.address) || 
        isStablecoinBySymbol(counterpartToken.symbol)) {
      console.warn(`Using fallback price for stablecoin ${counterpartToken.address} - no reliable price data available`);
      return 1.0;
    }
    
    // For non-stablecoins with no price data
    return 0;
  },

  // Re-export the utility functions for convenience on the server
  getStablecoinAddresses,
  normalizePrice,
  detectNeedsDecimalNormalization,
  isStablecoin,
  isStablecoinBySymbol,
  getStablecoinSymbols,

  /**
   * Get price from the on-chain oracle
   */
  async getPriceFromOracle(tokenAddress: string): Promise<number> {
    try {
      // Find a stablecoin pair for this token
      const prisma = prismaClient;
      
      // Get stablecoin symbols
      const stablecoinSymbols = getStablecoinSymbols();
      
      const token = await prisma.token.findUnique({
        where: { address: tokenAddress },
        include: {
          pairsAsToken0: {
            include: {
              token0: true,
              token1: true
            },
            where: {
              token1: {
                symbol: {
                  in: stablecoinSymbols
                }
              }
            }
          },
          pairsAsToken1: {
            include: {
              token0: true,
              token1: true
            },
            where: {
              token0: {
                symbol: {
                  in: stablecoinSymbols
                }
              }
            }
          }
        }
      })

      if (!token) {
        console.warn(`Token ${tokenAddress} not found in database`)
        return 0
      }

      // Get the first stablecoin pair
      const allPairs = [
        ...(token.pairsAsToken0 as PairWithTokens[]),
        ...(token.pairsAsToken1 as PairWithTokens[])
      ]
      const pair = allPairs[0]
      if (!pair) {
        console.warn(`No stablecoin pair found for token ${tokenAddress}`)
        return 0
      }

      console.log(`Found stablecoin pair ${pair.address} for token ${tokenAddress}`)

      // 1. First try to get price from reserves (always available)
      try {
        const { formatUnits, parseUnits } = await import('viem')
        const tokenReserveRaw = pair.token0Id === token.id ? pair.reserve0 : pair.reserve1
        const stablecoinReserveRaw = pair.token0Id === token.id ? pair.reserve1 : pair.reserve0
        
        const tokenReserve = parseFloat(
          formatUnits(BigInt(tokenReserveRaw), token.decimals || 18)
        )
        const stablecoinReserve = parseFloat(
          formatUnits(BigInt(stablecoinReserveRaw), pair.token0Id === token.id ? pair.token1.decimals || 18 : pair.token0.decimals || 18)
        )

        if (tokenReserve > 0) {
          const price = stablecoinReserve / tokenReserve
          console.log(`Got price ${price} from reserves for token ${tokenAddress}`)
          // Store in database and cache
          try {
            await prisma.token.update({
              where: { id: token.id },
              data: { priceUSD: price.toString() }
            })
            console.log(`Updated database with reserve price ${price} for token ${tokenAddress}`)
          } catch (error) {
            console.error(`Failed to update database with price for ${tokenAddress}:`, error)
          }
          await this.cacheTokenPrice(token.id, price)
          return price
        }
      } catch (error) {
        console.error(`Error getting price from reserves for ${tokenAddress}:`, error)
      }

      // 2. If reserves didn't work, try Oracle (only if pair is initialized)
      try {
        // Check if pair is initialized in Oracle
        const isInitialized = await publicClient.readContract({
          address: ORACLE_ADDRESS[CURRENT_CHAIN.id],
          abi: ORACLE_ABI,
          functionName: 'isPairInitialized',
          args: [pair.address as `0x${string}`]
        })

        if (!isInitialized) {
          console.warn(`Oracle pair ${pair.address} not initialized`)
          return 0
        }

        console.log(`Oracle pair ${pair.address} is initialized, trying to get TWAP price`)

        // Calculate amountIn (1 token with proper decimals)
        const tokenDecimals = token.decimals || 18
        const amountIn = BigInt(1) * BigInt(10) ** BigInt(tokenDecimals)

        // Call the oracle's consult function
        const result = await publicClient.readContract({
          address: ORACLE_ADDRESS[CURRENT_CHAIN.id],
          abi: ORACLE_ABI,
          functionName: 'consult',
          args: [
            pair.address as `0x${string}`,
            tokenAddress as `0x${string}`,
            amountIn,
            3600 // 1 hour period
          ]
        })

        if (result) {
          // Get the stablecoin decimals
          const stablecoin = pair.token0Id === token.id ? pair.token1 : pair.token0
          const stablecoinDecimals = stablecoin.decimals || 18
          
          // Convert the result to USD price
          const price = Number(result) / Math.pow(10, stablecoinDecimals)
          console.log(`Got price ${price} from oracle for token ${tokenAddress}`)
          // Store in database and cache
          try {
            await prisma.token.update({
              where: { id: token.id },
              data: { priceUSD: price.toString() }
            })
            console.log(`Updated database with oracle price ${price} for token ${tokenAddress}`)
          } catch (error) {
            console.error(`Failed to update database with price for ${tokenAddress}:`, error)
          }
          await this.cacheTokenPrice(token.id, price)
          return price
        }
      } catch (error: any) {
        // Handle specific Oracle errors
        if (error.message?.includes('NotInitialized')) {
          console.warn(`Oracle pair ${pair.address} not initialized`)
        } else if (error.message?.includes('StalePrice')) {
          console.warn(`Oracle price for pair ${pair.address} is stale, falling back to reserves`)
          // Try to get price from reserves again
          try {
            const { formatUnits, parseUnits } = await import('viem')
            const tokenReserveRaw = pair.token0Id === token.id ? pair.reserve0 : pair.reserve1
            const stablecoinReserveRaw = pair.token0Id === token.id ? pair.reserve1 : pair.reserve0
            
            const tokenReserve = parseFloat(
              formatUnits(BigInt(tokenReserveRaw), token.decimals || 18)
            )
            const stablecoinReserve = parseFloat(
              formatUnits(BigInt(stablecoinReserveRaw), pair.token0Id === token.id ? pair.token1.decimals || 18 : pair.token0.decimals || 18)
            )

            if (tokenReserve > 0) {
              const price = stablecoinReserve / tokenReserve
              console.log(`Got fallback price ${price} from reserves for token ${tokenAddress}`)
              // Store in database and cache
              try {
                await prisma.token.update({
                  where: { id: token.id },
                  data: { priceUSD: price.toString() }
                })
                console.log(`Updated database with fallback price ${price} for token ${tokenAddress}`)
              } catch (error) {
                console.error(`Failed to update database with price for ${tokenAddress}:`, error)
              }
              await this.cacheTokenPrice(token.id, price)
              return price
            }
          } catch (error) {
            console.error(`Error getting fallback price from reserves for ${tokenAddress}:`, error)
          }
        } else if (error.message?.includes('InvalidPeriod')) {
          console.warn(`Invalid period for oracle query on pair ${pair.address}`)
        } else if (error.message?.includes('InsufficientData')) {
          console.warn(`Insufficient data for oracle query on pair ${pair.address}`)
        } else if (error.message?.includes('InvalidTimeElapsed')) {
          console.warn(`Invalid time elapsed for oracle query on pair ${pair.address}`)
        } else if (error.message?.includes('ElapsedTimeZero')) {
          console.warn(`Zero time elapsed for oracle query on pair ${pair.address}`)
        } else if (error.message?.includes('InvalidPair')) {
          console.warn(`Invalid pair ${pair.address} for oracle query`)
        } else if (error.message?.includes('InvalidToken')) {
          console.warn(`Invalid token ${tokenAddress} for oracle query on pair ${pair.address}`)
        } else if (error.message?.includes('UpdateTooFrequent')) {
          console.warn(`Update too frequent for oracle query on pair ${pair.address}`)
        } else {
          console.error(`Oracle error for ${tokenAddress}:`, error)
        }
        // Clear cache when Oracle errors occur
        await this.clearTokenPriceCache()
      }

      return 0
    } catch (error) {
      console.error(`Error getting price from oracle for ${tokenAddress}:`, error)
      return 0
    }
  },

  /**
   * Clear Redis cache for token prices
   */
  async clearTokenPriceCache(): Promise<void> {
    try {
      const redis = getRedisClient()
      const keys = await redis.keys('token:*:priceUSD')
      if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`Cleared ${keys.length} token price cache entries`)
      }
    } catch (error) {
      console.error('Error clearing token price cache:', error)
    }
  },

  /**
   * Validate a token price is reasonable based on token characteristics
   */
  validateTokenPrice(
    price: number,
    token: { symbol?: string; address: string },
    stablecoin: { symbol: string; address: string }
  ): boolean {
    // Basic validation
    if (!price || isNaN(price) || price <= 0) {
      return false
    }

    // For stablecoins themselves, we want to validate they're close to $1
    if (token.symbol === 'USDT' || token.symbol === 'USDC') {
      // Allow more deviation for stablecoins in price discovery
      return Math.abs(price - 1) < 0.1 // Allow 10% deviation
    }

    // For prices derived from stablecoin pairs, we trust the calculation
    // since it's based on actual reserves and proper decimal handling
    if (stablecoin.symbol === 'USDT' || stablecoin.symbol === 'USDC') {
      // Just ensure the price is within a very wide but reasonable range
      // This catches obvious errors while allowing legitimate prices
      return price > 0.000000001 && price < 1000000000
    }

    // For non-stablecoin pairs, apply similar reasonable bounds
    return price > 0.000000001 && price < 1000000000
  },

  /**
   * Normalize a token price to human-readable format
   * This ensures that raw blockchain values are properly scaled down
   */
  async normalizeTokenPrice(tokenId: string, price: number): Promise<number> {
    try {
      // Get token info for decimals
      const token = await prismaClient.token.findUnique({
        where: { id: tokenId },
        select: { decimals: true, symbol: true }
      });
      
      if (!token) return price;
      const decimals = token.decimals || 18;
      
      // Check if price seems to be in blockchain format (very large)
      const magnitude = Math.floor(Math.log10(Math.abs(price || 1)));
      
      // If price is suspiciously large and decimals are available
      if (magnitude >= decimals - 3) {
        const normalizedPrice = price / Math.pow(10, decimals);
        console.log(`Normalized price for ${token.symbol || tokenId}: ${price} -> ${normalizedPrice} (using ${decimals} decimals)`);
        return normalizedPrice;
      }
      
      return price;
    } catch (error) {
      console.error(`Error normalizing price for token ${tokenId}:`, error);
      return price;
    }
  },
}
