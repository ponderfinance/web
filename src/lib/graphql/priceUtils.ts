import { prisma } from '@/src/lib/db/prisma'
import type { PrismaToken } from './types'
import { formatUnits } from 'viem'

// Define a type for Token with stablePair
type TokenWithStablePair = PrismaToken

export async function getTokenPriceFromOracle(params: {
  pairAddress: string
  tokenAddress: string
  amount?: bigint
  periodInSeconds?: number
}): Promise<number> {
  const { pairAddress, tokenAddress, amount = BigInt(1e18), periodInSeconds = 3600 } = params

  try {
    // Get the pair data from the database
    const pair = await prisma.pair.findUnique({
      where: { address: pairAddress },
      include: {
        token0: true,
        token1: true
      }
    })

    if (!pair) {
      throw new Error(`Pair not found: ${pairAddress}`)
    }

    // Determine which token we're pricing
    const isToken0 = tokenAddress.toLowerCase() === pair.token0.address.toLowerCase()
    const token = isToken0 ? pair.token0 : pair.token1
    const otherToken = isToken0 ? pair.token1 : pair.token0

    // Get the reserves
    const reserveIn = BigInt(isToken0 ? pair.reserve0 : pair.reserve1)
    const reserveOut = BigInt(isToken0 ? pair.reserve1 : pair.reserve0)

    if (reserveIn === BigInt(0)) {
      return 0
    }

    // Calculate the price using the constant product formula
    const price = (amount * reserveOut) / reserveIn

    // If we have a stable pair for price discovery, use that to get USD value
    if (token.stablePair) {
      const stablePair = await prisma.pair.findUnique({
        where: { address: token.stablePair },
        include: {
          token0: true,
          token1: true
        }
      })

      if (stablePair) {
        // Get the price in terms of the stable token (e.g., USDT)
        const stableToken = stablePair.token0.address.toLowerCase() === token.address.toLowerCase() 
          ? stablePair.token0 
          : stablePair.token1

        const stableReserveIn = BigInt(
          stablePair.token0.address.toLowerCase() === token.address.toLowerCase() 
            ? stablePair.reserve0 
            : stablePair.reserve1
        )
        const stableReserveOut = BigInt(
          stablePair.token0.address.toLowerCase() === token.address.toLowerCase() 
            ? stablePair.reserve1 
            : stablePair.reserve0
        )

        if (stableReserveIn > BigInt(0)) {
          const stablePrice = (price * stableReserveOut) / stableReserveIn
          return Number(stablePrice) / 1e18
        }
      }
    }

    // If no stable pair or stable pair calculation failed, return the raw price
    return Number(price) / 1e18
  } catch (error) {
    console.error('Error getting token price from oracle:', error)
    return 0
  }
}

export async function findUSDTPair(
  tokenAddress: string,
  db: typeof prisma
): Promise<string | null> {
  try {
    // First check if the token has a stablePair set
    const token = await db.token.findUnique({
      where: { address: tokenAddress }
    })

    // Use optional chaining with type assertion
    const stablePair = (token as any)?.stablePair
    if (stablePair) {
      return stablePair
    }

    // If no stablePair is set, look for a pair with USDT
    const usdtPairs = await db.pair.findMany({
      where: {
        OR: [
          { token0: { address: tokenAddress } },
          { token1: { address: tokenAddress } }
        ]
      },
      include: {
        token0: true,
        token1: true
      }
    })

    // Find a pair with USDT
    const usdtPair = usdtPairs.find((pair: { token0: { symbol?: string | null }, token1: { symbol?: string | null } }) => 
      pair.token0.symbol?.toLowerCase() === 'usdt' || 
      pair.token1.symbol?.toLowerCase() === 'usdt'
    )

    if (usdtPair) {
      return usdtPair.address
    }

    return null
  } catch (error) {
    console.error('Error finding USDT pair:', error)
    return null
  }
}

export async function calculatePairTVL(
  pairAddress: string,
  db: typeof prisma
): Promise<string> {
  try {
    const pair = await db.pair.findUnique({
      where: { address: pairAddress },
      include: {
        token0: true,
        token1: true
      }
    })

    if (!pair) {
      return '0'
    }

    // Get token prices with appropriate decimal handling
    const token0Price = pair.token0.priceUSD ? parseFloat(pair.token0.priceUSD) : 0
    const token1Price = pair.token1.priceUSD ? parseFloat(pair.token1.priceUSD) : 0

    // Get decimals (defaults to 18 if not available)
    const token0Decimals = pair.token0.decimals ?? 18
    const token1Decimals = pair.token1.decimals ?? 18

    // Parse reserves exactly once with viem, with safe fallbacks
    let reserve0 = 0, reserve1 = 0

    // Extra precaution when dealing with blockchain data
    if (pair.reserve0 && pair.reserve0.length > 0) {
      try {
        // Properly convert blockchain values to numbers
        if (pair.reserve0.length > 10) {
          // This is likely a raw blockchain value - parse it properly with decimals
          reserve0 = Number(formatUnits(BigInt(pair.reserve0), token0Decimals));
        } else {
          // This is already formatted, just parse as float
          reserve0 = parseFloat(pair.reserve0);
        }
      } catch (error) {
        console.warn(`Error parsing reserve0 for pair ${pairAddress}:`, error);
        reserve0 = Number(pair.reserve0) / Math.pow(10, token0Decimals);
      }
    }
    
    if (pair.reserve1 && pair.reserve1.length > 0) {
      try {
        // Properly convert blockchain values to numbers
        if (pair.reserve1.length > 10) {
          // This is likely a raw blockchain value - parse it properly with decimals
          reserve1 = Number(formatUnits(BigInt(pair.reserve1), token1Decimals));
        } else {
          // This is already formatted, just parse as float
          reserve1 = parseFloat(pair.reserve1);
        }
      } catch (error) {
        console.warn(`Error parsing reserve1 for pair ${pairAddress}:`, error);
        reserve1 = Number(pair.reserve1) / Math.pow(10, token1Decimals);
      }
    }

    // Calculate the TVL by multiplying reserves by price
    const tvl0 = reserve0 * token0Price;
    const tvl1 = reserve1 * token1Price;
    const totalTVL = tvl0 + tvl1;
    
    // Log the components for debugging
    console.log(`Pair ${pairAddress} TVL: reserve0=${reserve0} * price=${token0Price} = ${tvl0}, reserve1=${reserve1} * price=${token1Price} = ${tvl1}, total=${totalTVL}`);
    
    // Sanity check - if TVL is unreasonably large, something's wrong
    if (totalTVL < 0 || totalTVL > 1e15) { // Over 1 quadrillion is likely an error
      console.warn(`Unreasonably large TVL for pair ${pairAddress}: ${totalTVL}. Returning 0.`);
      return '0';
    }
    
    return totalTVL.toString()
  } catch (error) {
    console.error('Error calculating pair TVL:', error)
    return '0'
  }
}
