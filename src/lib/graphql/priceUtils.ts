import { PriceOracle, SupportedChainId } from '@ponderfinance/sdk'
import { formatUnits, type PublicClient } from 'viem'

// Cache for price oracle instances
const priceOracleCache = new Map<string, PriceOracle>()

/**
 * Get a price oracle instance for a specific chain
 */
function getPriceOracle(params: {
  chainId: SupportedChainId
  publicClient: PublicClient
}): PriceOracle {
  const { chainId, publicClient } = params
  const cacheKey = `${chainId}`

  if (!priceOracleCache.has(cacheKey)) {
    priceOracleCache.set(cacheKey, new PriceOracle(chainId, publicClient))
  }

  return priceOracleCache.get(cacheKey)!
}

/**
 * Get the USD price of a token using a stablecoin pair as reference
 */
export async function getTokenUSDPrice(params: {
  chainId: SupportedChainId
  publicClient: PublicClient
  tokenAddress: string
  stablecoinPairAddress: string
}): Promise<number> {
  const { chainId, publicClient, tokenAddress, stablecoinPairAddress } = params

  try {
    const oracle = getPriceOracle({ chainId, publicClient })

    // Get the price of 1 token in terms of the stablecoin
    const { pricePerToken } = await oracle.getAveragePrice(
      stablecoinPairAddress as `0x${string}`,
      tokenAddress as `0x${string}`,
      BigInt('1000000000000000000'), // 1 token with 18 decimals
      3600 // 1 hour period
    )

    return pricePerToken
  } catch (error) {
    console.error(`Error getting USD price for ${tokenAddress}:`, error)
    return 0
  }
}

/**
 * Calculate the USD value of token reserves in a pair
 */
export async function calculatePairTVL(params: {
  chainId: SupportedChainId
  publicClient: PublicClient
  pairAddress: string
  token0: {
    address: string
    decimals: number
    stablePair?: string
  }
  token1: {
    address: string
    decimals: number
    stablePair?: string
  }
  reserve0: string
  reserve1: string
}): Promise<number> {
  const { chainId, publicClient, pairAddress, token0, token1, reserve0, reserve1 } =
    params

  try {
    // Get USD prices for both tokens
    const [token0Price, token1Price] = await Promise.all([
      token0.stablePair
        ? getTokenUSDPrice({
            chainId,
            publicClient,
            tokenAddress: token0.address,
            stablecoinPairAddress: token0.stablePair,
          })
        : 0,
      token1.stablePair
        ? getTokenUSDPrice({
            chainId,
            publicClient,
            tokenAddress: token1.address,
            stablecoinPairAddress: token1.stablePair,
          })
        : 0,
    ])

    // Convert reserves to decimal representation
    const reserve0Value =
      parseFloat(formatUnits(BigInt(reserve0), token0.decimals)) * token0Price
    const reserve1Value =
      parseFloat(formatUnits(BigInt(reserve1), token1.decimals)) * token1Price

    // Return the sum of both token values
    return reserve0Value + reserve1Value
  } catch (error) {
    console.error(`Error calculating TVL for pair ${pairAddress}:`, error)
    return 0
  }
}
