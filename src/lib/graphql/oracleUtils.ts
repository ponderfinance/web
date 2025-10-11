import { createPublicClient, formatUnits, http, PublicClient } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { PrismaClient } from '@prisma/client'

// Constants
export const USDT_ADDRESS = '0x7d984C24d2499D840eB3b7016077164e15E5faA6'.toLowerCase()
export const KKUB_ADDRESS = '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5'.toLowerCase() // Replace with actual KKUB address
export const ORACLE_ADDRESS = '0xcf814870800a3bcac4a6b858424a9370a64c75ad'
export const REASONABLE_PRICE_UPPER_BOUND = 100000 // $100,000 max price

// Oracle ABI for the functions we need
export const ORACLE_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'pair', type: 'address' },
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint32', name: 'period', type: 'uint32' },
    ],
    name: 'consult',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'pair', type: 'address' },
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
    ],
    name: 'getCurrentPrice',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

// Create a client (or get it from a shared instance)
export const getPublicClient = (): PublicClient => {
  return createPublicClient({
    chain: CURRENT_CHAIN,
    transport: http(CURRENT_CHAIN.rpcUrls.default.http[0]),
  })
}

/**
 * Get the price of a token from the oracle with fallback to spot price
 * @param params - Parameters for price lookup
 * @returns The price per token
 */
export async function getTokenPriceFromOracle(params: {
  pairAddress: string
  tokenAddress: string
  amount?: bigint
  periodInSeconds?: number
}): Promise<number> {
  const {
    pairAddress,
    tokenAddress,
    amount = BigInt('1000000000000000000'),
    periodInSeconds = 3600,
  } = params
  const publicClient = getPublicClient()

  // First try TWAP via consult
  try {
    const amountOut = await publicClient.readContract({
      address: ORACLE_ADDRESS as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: 'consult',
      args: [
        pairAddress as `0x${string}`,
        tokenAddress as `0x${string}`,
        amount,
        periodInSeconds,
      ],
    })

    // Calculate and validate the price
    const pricePerToken = Number(amountOut) / Number(amount)

    if (isNaN(pricePerToken) || pricePerToken > REASONABLE_PRICE_UPPER_BOUND) {
      console.warn(
        `TWAP oracle returned unreasonable price: ${pricePerToken} for ${tokenAddress}`
      )
      // Don't return this value, fall through to the spot price check
    } else {
      return pricePerToken
    }
  } catch (error) {
    // Log the TWAP error but don't return yet
    console.warn(`TWAP oracle error for ${tokenAddress}: ${error}`)
    // Don't return here, try the spot price as fallback
  }

  // Fallback to spot price if TWAP fails or returns unreasonable value
  try {
    const spotAmountOut = await publicClient.readContract({
      address: ORACLE_ADDRESS as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: 'getCurrentPrice',
      args: [pairAddress as `0x${string}`, tokenAddress as `0x${string}`, amount],
    })

    // Calculate and validate the price
    const spotPrice = Number(spotAmountOut) / Number(amount)

    if (isNaN(spotPrice) || spotPrice > REASONABLE_PRICE_UPPER_BOUND) {
      console.warn(
        `Spot price check returned unreasonable value: ${spotPrice} for ${tokenAddress}`
      )
      return 0
    }

    return spotPrice
  } catch (error) {
    console.error(`Both TWAP and spot price checks failed for ${tokenAddress}: ${error}`)
    return 0
  }
}

/**
 * Find a trading pair between two tokens
 * @param token0Address First token address
 * @param token1Address Second token address
 * @param prisma Prisma client
 * @returns Pair address or null if not found
 */
export async function findPair(
  token0Address: string,
  token1Address: string,
  prisma: PrismaClient
): Promise<string | null> {
  const pair = await prisma.pair.findFirst({
    where: {
      OR: [
        {
          token0: { address: token0Address?.toLowerCase() || "" },
          token1: { address: token1Address?.toLowerCase() || "" },
        },
        {
          token0: { address: token1Address?.toLowerCase() || "" },
          token1: { address: token0Address?.toLowerCase() || "" },
        },
      ],
    },
  })

  return pair ? pair.address : null
}

/**
 * Get token price using KKUB as intermediary
 * @param tokenAddress Token address
 * @param prisma Prisma client
 * @returns Token price in USD
 */
export async function getTokenPriceViaKKUB(
  tokenAddress: string,
  prisma: PrismaClient
): Promise<number> {
  try {
    // Step 1: Find token-KKUB pair
    const tokenKKUBPair = await findPair(tokenAddress, KKUB_ADDRESS, prisma)
    if (!tokenKKUBPair) {
      return 0 // No KKUB pair found
    }

    // Step 2: Find KKUB-USDT pair
    const kkubUSDTPair = await findPair(KKUB_ADDRESS, USDT_ADDRESS, prisma)
    if (!kkubUSDTPair) {
      return 0 // No USDT-KKUB pair found
    }

    // Step 3: Get token price in KKUB
    const tokenPriceInKKUB = await getTokenPriceFromOracle({
      pairAddress: tokenKKUBPair,
      tokenAddress: tokenAddress,
    })

    if (tokenPriceInKKUB === 0) {
      return 0
    }

    // Step 4: Get KKUB price in USDT
    const kkubPriceInUSDT = await getTokenPriceFromOracle({
      pairAddress: kkubUSDTPair,
      tokenAddress: KKUB_ADDRESS,
    })

    if (kkubPriceInUSDT === 0) {
      return 0
    }

    // Step 5: Calculate token price in USDT
    return tokenPriceInKKUB * kkubPriceInUSDT
  } catch (error) {
    console.error(`Error getting price via KKUB for ${tokenAddress}:`, error)
    return 0
  }
}

/**
 * Calculate the USD value of a pair's reserves
 * @param pair Pair object with reserves and token IDs
 * @param prisma Prisma client
 * @returns Total USD value as a string
 */
export async function calculateReservesUSD(
  pair: any,
  prisma: PrismaClient
): Promise<string> {
  try {
    // Get token details
    const token0 = await prisma.token.findUnique({
      where: { id: pair.token0Id },
      select: {
        id: true,
        address: true,
        decimals: true,
        symbol: true,
        priceUsd: true
      }
    });

    const token1 = await prisma.token.findUnique({
      where: { id: pair.token1Id },
      select: {
        id: true,
        address: true,
        decimals: true,
        symbol: true,
        priceUsd: true
      }
    });

    if (!token0 || !token1) {
      console.error(`Tokens not found for pair ${pair.id}`)
      return '0'
    }

    let token0PriceUSD = 0
    let token1PriceUSD = 0

    // Method 1: Check if token is USDT
    if (token0.address.toLowerCase() === USDT_ADDRESS) {
      // Always use the actual USDT price from the database
      if (token0.priceUsd) {
        token0PriceUSD = parseFloat(token0.priceUsd);
        console.log(`Using actual USDT price from database: $${token0PriceUSD}`);
      } else {
        // If no price in database, use oracle or other methods but don't fallback to 1
        console.log(`No USDT price in database for ${token0.id}, will try other price sources`);
      }
    } else if (token1.address.toLowerCase() === USDT_ADDRESS) {
      // Always use the actual USDT price from the database
      if (token1.priceUsd) {
        token1PriceUSD = parseFloat(token1.priceUsd);
        console.log(`Using actual USDT price from database: $${token1PriceUSD}`);
      } else {
        // If no price in database, use oracle or other methods but don't fallback to 1
        console.log(`No USDT price in database for ${token1.id}, will try other price sources`);
      }
    }

    // Method 2: Check if token is KKUB and get price from USDT pair
    if (token0.address.toLowerCase() === KKUB_ADDRESS && token0PriceUSD === 0) {
      const kkubUSDTPair = await findPair(KKUB_ADDRESS, USDT_ADDRESS, prisma)
      if (kkubUSDTPair) {
        token0PriceUSD = await getTokenPriceFromOracle({
          pairAddress: kkubUSDTPair,
          tokenAddress: KKUB_ADDRESS,
        })
      }
    }

    if (token1.address.toLowerCase() === KKUB_ADDRESS && token1PriceUSD === 0) {
      const kkubUSDTPair = await findPair(KKUB_ADDRESS, USDT_ADDRESS, prisma)
      if (kkubUSDTPair) {
        token1PriceUSD = await getTokenPriceFromOracle({
          pairAddress: kkubUSDTPair,
          tokenAddress: KKUB_ADDRESS,
        })
      }
    }

    // Method 3: Check for direct USDT pair
    if (token0PriceUSD === 0) {
      const token0USDTPair = await findPair(token0.address, USDT_ADDRESS, prisma)
      if (token0USDTPair) {
        token0PriceUSD = await getTokenPriceFromOracle({
          pairAddress: token0USDTPair,
          tokenAddress: token0.address,
        })
      }
    }

    if (token1PriceUSD === 0) {
      const token1USDTPair = await findPair(token1.address, USDT_ADDRESS, prisma)
      if (token1USDTPair) {
        token1PriceUSD = await getTokenPriceFromOracle({
          pairAddress: token1USDTPair,
          tokenAddress: token1.address,
        })
      }
    }

    // Method 4: Route through KKUB to get USD price
    if (token0PriceUSD === 0) {
      token0PriceUSD = await getTokenPriceViaKKUB(token0.address, prisma)
    }

    if (token1PriceUSD === 0) {
      token1PriceUSD = await getTokenPriceViaKKUB(token1.address, prisma)
    }

    // If we still couldn't find prices for either token, return zero
    if (token0PriceUSD === 0 && token1PriceUSD === 0) {
      return '0'
    }

    // Calculate USD value of reserves
    const reserve0USD =
      parseFloat(formatUnits(BigInt(pair.reserve0), token0.decimals || 18)) *
      token0PriceUSD
    const reserve1USD =
      parseFloat(formatUnits(BigInt(pair.reserve1), token1.decimals || 18)) *
      token1PriceUSD

    // Sanity check - prevent unreasonable values
    const totalReservesUSD = reserve0USD + reserve1USD

    if (
      isNaN(totalReservesUSD) ||
      !isFinite(totalReservesUSD) ||
      totalReservesUSD > 1000000000
    ) {
      console.error(
        `Calculated unreasonable reserve value: ${totalReservesUSD} for pair ${pair.id}`
      )
      return '0'
    }

    // Return the total value
    return totalReservesUSD.toString()
  } catch (error) {
    console.error('Error calculating reserves USD:', error)
    return '0' // Return 0 instead of a mock value
  }
}
