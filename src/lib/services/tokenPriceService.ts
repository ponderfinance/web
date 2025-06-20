// src/lib/services/tokenPriceService.ts
// Server-only service for token pricing - this should never be imported in client components

/**
 * TokenPriceService
 * 
 * This service handles all token price operations on the frontend.
 * It's designed to work with the UnifiedPriceService in the indexer.
 * 
 * Cache behavior:
 * - Cache TTL is set to 5 minutes (300 seconds) to align with the indexer's update frequency
 * - The indexer's UnifiedPriceService updates price changes every 5 minutes
 * - Price snapshots in the indexer are taken hourly
 * - This alignment ensures we're not showing stale data while optimizing performance
 * 
 * Data flow:
 * 1. Indexer's UnifiedPriceService calculates token prices and updates the database
 * 2. This frontend service fetches prices from the database via GraphQL
 * 3. Prices are cached in Redis to reduce database load
 * 4. UI components display the cached or fresh data as appropriate
 */

import { formatUnits, parseUnits } from 'viem'
import { getKey, setKey, getMultipleKeys, getRedisClient } from '@/src/lib/redis'
import prismaClient from '@/src/lib/db/prisma'
import { createPublicClient, http } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { ORACLE_ABI } from '@/src/constants/abis'
import { ORACLE_ADDRESS } from '@/src/constants/addresses'
import {
  getStablecoinAddresses,
  isStablecoin,
  isStablecoinBySymbol,
  getStablecoinSymbols,
  MAIN_TOKEN_SYMBOL,
  formatCurrency
} from '@/src/lib/utils/tokenPriceUtils'

// Constants
const CACHE_TTL_SECONDS = 300 // 5 minutes (aligned with indexer's price change update frequency)
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
        // Cache this price for future use
        await this.cacheTokenPrice(tokenId, price, CACHE_TTL_SECONDS)
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
      const results: Record<string, string> = {}
      
      // Step 1: Try to get all prices from Redis cache in one batch
      const cacheKeys = tokenIds.map(id => `token:${id}:priceUSD`)
      const cachedPrices = await getMultipleKeys(cacheKeys)
      
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
      const cacheKey = `token:${tokenId}:priceUSD`
      const cached = await getKey(cacheKey)
      
      if (cached) {
        const price = parseFloat(cached)
        if (!isNaN(price)) {
          return price
        }
      }

      return null
    } catch (error) {
      console.error(`Error getting cached token price for ${tokenId}:`, error)
      return null
    }
  },

  /**
   * Cache token price in Redis
   */
  async cacheTokenPrice(tokenId: string, price: number, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> {
    try {
      await setKey(`token:${tokenId}:priceUSD`, price.toString(), ttlSeconds)
    } catch (error) {
      console.error(`Error caching token price for ${tokenId}:`, error)
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
      const promises = prices.map(({ tokenId, price }) => {
        return this.cacheTokenPrice(tokenId, price, ttlSeconds)
      })
      
      await Promise.all(promises)
    } catch (error) {
      console.error('Error caching token prices in bulk:', error)
    }
  },

  /**
   * Get reliable USD price for a token with market data
   * This method uses a consistent approach for all tokens
   */
  async getReliableTokenUsdPrice(
    token: { id: string; address: string; decimals?: number; symbol?: string },
    prismaDb?: PrismaClientType
  ): Promise<number> {
    try {
      // Get token info for logging
    const tokenId = token.id
    const tokenSymbol = token.symbol || 'Unknown'
      const db = prismaDb || prismaClient

      console.log(`Starting price calculation for ${tokenSymbol} (${tokenId})`)

    // Track attempt methods for debugging
    const attemptMethods: string[] = []

      // 1. Try cache first (fastest)
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

    // 2. Try database stored value
    attemptMethods.push('database')
    try {
      const tokenData = await db.token.findUnique({
        where: { id: tokenId },
        select: { priceUSD: true },
      })

      if (tokenData?.priceUSD) {
        const dbPrice = parseFloat(tokenData.priceUSD)
          // Basic validation - price should be positive
          if (dbPrice > 0) {
            console.log(`Found database price ${dbPrice} for ${tokenSymbol}`)
          await this.cacheTokenPrice(tokenId, dbPrice)
          return dbPrice
        }
      }
    } catch (error) {
        console.warn(`Database lookup failed for ${tokenSymbol} (${tokenId})`, error)
    }

      // 3. Calculate from trading pairs
      attemptMethods.push('trading pairs')
      
      // Find all pairs where this token is traded
      const pairs = await db.pair.findMany({
        where: {
          OR: [
            { token0Id: tokenId },
            { token1Id: tokenId }
          ]
        },
        include: {
          token0: true,
          token1: true
        },
        orderBy: [
          // Order by liquidity (reserves) to prioritize most liquid pairs
          { reserveUSD: 'desc' },
          { createdAt: 'desc' }
        ]
      })
      
      if (pairs.length === 0) {
        console.warn(`No trading pairs found for ${tokenSymbol}`)
        return 0
      }

      console.log(`Found ${pairs.length} trading pairs for ${tokenSymbol}`)

      // Try each pair until we find a valid price
      for (const pair of pairs) {
        const isToken0 = pair.token0Id === tokenId
        const counterpartToken = isToken0 ? pair.token1 : pair.token0
        
        console.log(`Trying pair with ${counterpartToken.symbol}`)
        
        // Skip self-pairings or already processing counterpart
        if (counterpartToken.id === tokenId) {
          continue
        }
        
        // Get counterpart token price
        let counterpartPrice = 0
        
        // MODIFIED: Always calculate counterpart prices from market data
        // We no longer assume stablecoins have a price of 1
        // Instead we calculate their price based on actual market data
        
        // First check if this is a stablecoin
        const isStablecoinCounterpart = counterpartToken.symbol === 'USDT' || 
                                       counterpartToken.symbol === 'USDC' ||
                                       isStablecoinBySymbol(counterpartToken.symbol || '');
        
        if (isStablecoinCounterpart) {
          console.log(`Calculating market price for stablecoin ${counterpartToken.symbol}`);
          
          // Try to find the stablecoin's price relative to KKUB
          try {
            // Find KKUB token
            const kkubToken = await db.token.findFirst({
              where: { symbol: MAIN_TOKEN_SYMBOL },
              select: { id: true, priceUSD: true }
            });
            
            if (kkubToken && kkubToken.priceUSD) {
              // Find pair with KKUB
              const kkubPair = await db.pair.findFirst({
          where: {
            OR: [
              {
                      token0Id: counterpartToken.id,
                      token1Id: kkubToken.id
              },
              {
                      token0Id: kkubToken.id,
                      token1Id: counterpartToken.id
                    }
                  ]
          },
          include: {
            token0: true,
                  token1: true
                }
              });
              
              if (kkubPair) {
                // Calculate from reserves
                const isToken0 = kkubPair.token0Id === counterpartToken.id;
                const reserve0 = BigInt(kkubPair.reserve0);
                const reserve1 = BigInt(kkubPair.reserve1);
                
                if (reserve0 > 0n && reserve1 > 0n) {
                  const token0Decimals = kkubPair.token0.decimals || 18;
                  const token1Decimals = kkubPair.token1.decimals || 18;
                  
                  // Format reserves using appropriate decimals
                  const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals));
                  const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals));
                  const kkubPrice = parseFloat(kkubToken.priceUSD);
                  
                  if (isToken0) {
                    // Stablecoin is token0, KKUB is token1
                    // price = (reserve1/reserve0) * kkubPrice
                    counterpartPrice = (reserve1Formatted / reserve0Formatted) * kkubPrice;
              } else {
                    // Stablecoin is token1, KKUB is token0
                    // price = (reserve0/reserve1) * kkubPrice
                    counterpartPrice = (reserve0Formatted / reserve1Formatted) * kkubPrice;
                  }
                  
                  // Validate the calculated price for stablecoins (should be close to 1)
                  if (counterpartPrice > 0.5 && counterpartPrice < 1.5) {
                    console.log(`Calculated stablecoin price ${counterpartPrice} for ${counterpartToken.symbol} using KKUB pair`);

                    // Store in database
                try {
                  await db.token.update({
                        where: { id: counterpartToken.id },
                        data: { priceUSD: counterpartPrice.toString() }
                      });
                      console.log(`Updated database with price ${counterpartPrice} for stablecoin ${counterpartToken.symbol}`);
                    } catch (dbError) {
                      console.error(`Failed to update database with price for ${counterpartToken.symbol}:`, dbError);
                }
                    
                    // Cache the price
                    await this.cacheTokenPrice(counterpartToken.id, counterpartPrice);
            }
          }
        }
      }
    } catch (error) {
            console.error(`Error calculating stablecoin price for ${counterpartToken.symbol}:`, error);
    }

          // If we failed to calculate a market price for the stablecoin,
          // fall back to using a reasonable approximation
          if (counterpartPrice <= 0 || counterpartPrice > 1.5 || counterpartPrice < 0.5) {
            console.warn(`Could not determine reliable market price for stablecoin ${counterpartToken.symbol}, using default approximation`);
            counterpartPrice = 1;
          }
        } else {
          // For non-stablecoins, use the existing logic
          console.log(`Calculating price for non-stablecoin counterpart token ${counterpartToken.symbol}`);
          counterpartPrice = await this.getTokenPriceUSD(counterpartToken.id);
        }
        
        if (counterpartPrice <= 0) {
          console.log(`No valid price found for counterpart ${counterpartToken.symbol}, trying next pair`);
          continue;
        }
        
        console.log(`Using counterpart price ${counterpartPrice} for ${counterpartToken.symbol}`);
        
        // Calculate this token's price based on pair reserves and counterpart price
        try {
          const reserve0 = BigInt(pair.reserve0)
          const reserve1 = BigInt(pair.reserve1)
          
          // Only calculate if both reserves are non-zero
          if (reserve0 > 0n && reserve1 > 0n) {
            const token0Decimals = pair.token0.decimals || 18
            const token1Decimals = pair.token1.decimals || 18
            
            // Format reserves using appropriate decimals
            const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals))
            const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals))
            
            let calculatedPrice: number
            
            if (isToken0) {
              // Our token is token0, so price = (reserve1/reserve0) * counterpartPrice
              calculatedPrice = (reserve1Formatted / reserve0Formatted) * counterpartPrice
            } else {
              // Our token is token1, so price = (reserve0/reserve1) * counterpartPrice
              calculatedPrice = (reserve0Formatted / reserve1Formatted) * counterpartPrice
            }
            
            // Basic validation - price should be positive and reasonable
            if (calculatedPrice > 0 && calculatedPrice < Number.MAX_SAFE_INTEGER) {
              console.log(`Calculated price ${calculatedPrice} for ${tokenSymbol} using ${counterpartToken.symbol} pair`)
              
              // Store in database
              try {
                await db.token.update({
                  where: { id: tokenId },
                    data: { priceUSD: calculatedPrice.toString() }
                })
                  console.log(`Updated database with price ${calculatedPrice} for ${tokenSymbol}`)
              } catch (dbError) {
                console.error(`Failed to update database with price for ${tokenSymbol}:`, dbError)
              }
              
              // Cache the price
                await this.cacheTokenPrice(tokenId, calculatedPrice)
              
                return calculatedPrice
              } else {
              console.warn(`Calculated price ${calculatedPrice} for ${tokenSymbol} is outside reasonable bounds`)
              }
          } else {
            console.warn(`Zero reserves in pair ${pair.id}, trying next pair`)
      }
    } catch (error) {
          console.error(`Error calculating price from reserves for ${tokenSymbol}:`, error)
        }
    }

      // If we get here, we couldn't calculate a price from any pair
      console.warn(`Failed to determine price for ${tokenSymbol} after trying: ${attemptMethods.join(', ')}`)
    return 0
    } catch (error) {
      console.error(`Error in getReliableTokenUsdPrice:`, error)
      return 0
    }
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
    // We no longer have a special case for stablecoins - always use market data
    const price = await this.getReliableTokenUsdPrice(counterpartToken, prismaClient);
    
      // If we found a price, use it
      if (price > 0) {
      return price;
    }
    
    // Only as a fallback for stablecoins as a last resort, if we have no market data
    if (isCounterpartStablecoin || 
        isStablecoin(counterpartToken.address) || 
        isStablecoinBySymbol(counterpartToken.symbol)) {
      console.warn(`Using fallback price for stablecoin ${counterpartToken.address} - no reliable price data available`);
      
      // Try to find the stablecoin's price relative to KKUB directly from reserves
      try {
        // Find KKUB token
        const kkubToken = await prismaClient.token.findFirst({
          where: { symbol: MAIN_TOKEN_SYMBOL },
          select: { id: true, priceUSD: true }
        });
        
        if (kkubToken && kkubToken.priceUSD) {
          // Find pair with KKUB
          const kkubPair = await prismaClient.pair.findFirst({
            where: {
              OR: [
                {
                  token0Id: counterpartToken.id,
                  token1Id: kkubToken.id
                },
                {
                  token0Id: kkubToken.id,
                  token1Id: counterpartToken.id
                }
              ]
            },
            include: {
              token0: true,
              token1: true
            }
          });
          
          if (kkubPair) {
            // Calculate from reserves
            const isToken0 = kkubPair.token0Id === counterpartToken.id;
            const reserve0 = BigInt(kkubPair.reserve0);
            const reserve1 = BigInt(kkubPair.reserve1);
            
            if (reserve0 > 0n && reserve1 > 0n) {
              const { formatUnits } = await import('viem');
              const token0Decimals = kkubPair.token0.decimals || 18;
              const token1Decimals = kkubPair.token1.decimals || 18;
              
              let marketPrice: number;
              
              if (isToken0) {
                // Stablecoin is token0, KKUB is token1
                const kkubPerStablecoin = Number(formatUnits(
                  reserve1 * BigInt(10**token0Decimals) / reserve0, 
                  token1Decimals
                ));
                marketPrice = kkubPerStablecoin * parseFloat(kkubToken.priceUSD);
              } else {
                // Stablecoin is token1, KKUB is token0
                const kkubPerStablecoin = Number(formatUnits(
                  reserve0 * BigInt(10**token1Decimals) / reserve1, 
                  token0Decimals
                ));
                marketPrice = kkubPerStablecoin * parseFloat(kkubToken.priceUSD);
              }
              
              // If we got a reasonable market price, use it
              if (marketPrice > 0.5 && marketPrice < 1.5) {
                console.log(`Using market-derived price ${marketPrice} for stablecoin ${counterpartToken.symbol}`);
                return marketPrice;
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error calculating stablecoin fallback price for ${counterpartToken.symbol}:`, error);
      }
      
      // Final fallback - don't assume any price, just return 0 to indicate we couldn't determine the price
      console.warn(`Could not determine price for stablecoin ${counterpartToken.symbol} - returning 0`);
      return 0;
    }
    
    // For non-stablecoins with no price data
    return 0;
  },

  // Re-export the utility functions for convenience on the server
  getStablecoinAddresses,
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
   * Clear all token price caches
   */
  async clearTokenPriceCache(): Promise<void> {
    try {
      // We would need to list keys with a pattern and delete them
      // With our high-level API, we can't do this directly
      const redis = getRedisClient()
      if (redis) {
      const keys = await redis.keys('token:*:priceUSD')
      if (keys.length > 0) {
        await redis.del(...keys)
          console.log(`Cleared ${keys.length} token price cache keys`)
        }
      } else {
        console.warn('Redis client not available, skipping token price cache clearing')
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

  /**
   * Get the current price of a token
   * Uses the local cache or makes a server request
   * 
   * @param tokenId Token ID to get price for
   * @returns The token price in USD as a string
   */
  async getTokenPriceFromAPI(tokenId: string): Promise<number> {
    try {
      // Use our existing reliable method to get the token price from the database
      // This ensures consistency across all token price data sources
      return await this.getTokenPriceUSD(tokenId);
    } catch (error) {
      console.error(`Error fetching price for token ${tokenId}:`, error);
      return 0;
    }
  },

  /**
   * Get prices for multiple tokens in bulk
   * 
   * @param tokenIds Array of token IDs to get prices for
   * @returns Map of token IDs to prices
   */
  async getTokenPricesFromAPIBulk(
    tokenIds: string[]
  ): Promise<Record<string, string>> {
    try {
      // This would be a real API call to the bulk price endpoint
      // For now we just get each price individually for demo purposes
      const result: Record<string, string> = {};
      
      // In a production app, this would be a single bulk API call
      const promises = tokenIds.map(async (id) => {
        const price = await this.getTokenPriceFromAPI(id);
        result[id] = price.toString();
      });
      
      await Promise.all(promises);
      return result;
    } catch (error) {
      console.error('Error fetching bulk token prices:', error);
      
      // Return 0 for each token on error
      return tokenIds.reduce((acc, id) => {
        acc[id] = '0';
        return acc;
      }, {} as Record<string, string>);
    }
  },
  
  /**
   * Format a price for display with appropriate precision
   * 
   * @param price The price value
   * @returns Formatted price string
   */
  formatPrice(price: number): string {
    return formatCurrency(price);
  }
}

/**
 * Helper function to get token price directly from database
 */
async function getTokenPriceFromAPI(tokenId: string): Promise<string | null> {
  try {
    // Get price directly from database for consistency
    const token = await prismaClient.token.findUnique({
      where: { id: tokenId },
      select: { priceUSD: true }
    });
    
    return token?.priceUSD || null;
  } catch (error) {
    console.error(`Error getting token price from database for ${tokenId}:`, error);
    return null;
  }
}

export default TokenPriceService;
