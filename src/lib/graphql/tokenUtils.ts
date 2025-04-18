const { PrismaClient } = require('@prisma/client')
import {
  getTokenPriceFromOracle,
  findPair,
  USDT_ADDRESS,
  KKUB_ADDRESS,
} from './oracleUtils'
import { cacheTokenPrice } from '@/src/lib/redis/tokenCache'
import { isStablecoin } from '@/src/lib/utils/tokenPriceUtils'

/**
 * Calculate token price in USD using oracle and pairs
 */
export async function calculateTokenPriceUSD(
  tokenId: string,
  tokenAddress: string,
  prisma: typeof PrismaClient
): Promise<string> {
  try {
    // Method 1: For stablecoins, get the price from oracle when possible
    // but don't automatically assign $1 - let's get the actual market price
    if (isStablecoin(tokenAddress)) {
      // We SHOULD find a stablecoin pair to get the actual market price
      // instead of hardcoding a value
      const stablecoinPair = await findPair(tokenAddress, KKUB_ADDRESS, prisma)
      if (stablecoinPair) {
        const marketPrice = await getTokenPriceFromOracle({
          pairAddress: stablecoinPair,
          tokenAddress: tokenAddress,
        })
        
        // If we got a valid price, use it
        if (marketPrice > 0) {
          await cacheTokenPrice(tokenId, marketPrice.toString())
          return marketPrice.toString()
        }
      }
      
      // Only as a fallback for stablecoins if we can't get market data
      // This fallback should be rare in production with active markets
      console.warn(`Using fallback price for stablecoin ${tokenAddress} - no market data available`)
      await cacheTokenPrice(tokenId, '1.0')
      return '1.0'
    }

    // Method 2: Check for direct USDT pair
    const tokenUSDTPair = await findPair(tokenAddress, USDT_ADDRESS, prisma)
    if (tokenUSDTPair) {
      const priceInUSDT = await getTokenPriceFromOracle({
        pairAddress: tokenUSDTPair,
        tokenAddress: tokenAddress,
      })

      if (priceInUSDT > 0) {
        // Cache the result before returning
        await cacheTokenPrice(tokenId, priceInUSDT.toString())
        return priceInUSDT.toString()
      }
    }

    // Method 3: Route through KKUB to get USD price
    const tokenKKUBPair = await findPair(tokenAddress, KKUB_ADDRESS, prisma)
    if (tokenKKUBPair) {
      const kkubUSDTPair = await findPair(KKUB_ADDRESS, USDT_ADDRESS, prisma)

      if (kkubUSDTPair) {
        const priceInKKUB = await getTokenPriceFromOracle({
          pairAddress: tokenKKUBPair,
          tokenAddress: tokenAddress,
        })

        const kkubPriceInUSDT = await getTokenPriceFromOracle({
          pairAddress: kkubUSDTPair,
          tokenAddress: KKUB_ADDRESS,
        })

        if (priceInKKUB > 0 && kkubPriceInUSDT > 0) {
          const priceInUSDT = priceInKKUB * kkubPriceInUSDT

          // Cache the result before returning
          await cacheTokenPrice(tokenId, priceInUSDT.toString())
          return priceInUSDT.toString()
        }
      }
    }

    // Method 4: Try to find price from latest price snapshots
    const pairs = await prisma.pair.findMany({
      where: {
        OR: [{ token0Id: tokenId }, { token1Id: tokenId }],
      },
      select: { id: true, token0Id: true, token1Id: true },
    })

    if (pairs.length > 0) {
      // Look for the most recent price snapshot from any pair
      const snapshots = await prisma.pairSnapshot.findMany({
        where: { pairId: pairs[0].id },
        orderBy: { timestamp: 'desc' },
        take: 1,
      })

      if (snapshots.length > 0) {
        const snapshot = snapshots[0]
        // Check if our token is token0 or token1 in the pair
        const isToken0 = pairs[0].token0Id === tokenId

        // Get the appropriate price based on token position
        const priceStr = isToken0 ? snapshot.price0 : snapshot.price1

        // Cache the result
        await cacheTokenPrice(tokenId, priceStr)
        return priceStr
      }
    }

    // If we can't determine a price, return 0
    console.warn(`Could not determine price for token ${tokenId}`)
    return '0'
  } catch (error) {
    console.error(`Error calculating price for token ${tokenId}:`, error)
    return '0'
  }
}

/**
 * Calculate token prices in bulk
 */
export async function calculateTokenPricesUSDInBulk(
  tokens: Array<{ id: string; address: string }>,
  prisma: typeof PrismaClient
): Promise<Record<string, string>> {
  try {
    // Calculate prices in parallel
    const pricePromises = tokens.map(async (token) => {
      const price = await calculateTokenPriceUSD(token.id, token.address, prisma)
      return { id: token.id, price }
    })

    const prices = await Promise.all(pricePromises)

    // Return as a record
    return prices.reduce(
      (acc, { id, price }) => {
        acc[id] = price
        return acc
      },
      {} as Record<string, string>
    )
  } catch (error) {
    console.error('Error calculating token prices in bulk:', error)
    return {}
  }
}
