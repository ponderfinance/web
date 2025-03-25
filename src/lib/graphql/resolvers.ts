import { PrismaClient } from '@prisma/client'
import { createPublicClient, formatUnits, parseUnits, PublicClient } from 'viem'
import { calculateReservesUSD } from '@/src/lib/graphql/oracleUtils'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { KKUB_ADDRESS } from '@/src/constants/addresses'

import { http } from 'wagmi'
import { Context } from './types'
import {
  cachePairReserveUSDBulk,
  getCachedPairReserveUSD,
  getCachedPairReserveUSDBulk,
} from '@/src/lib/redis/pairCache'
import { getRedisClient } from '@/src/lib/redis/client'
import { TokenPriceService } from '@/src/lib/services/tokenPriceService'

// USDT address
const USDT_ADDRESS = '0x7d984C24d2499D840eB3b7016077164e15E5faA6'
// Oracle address
const ORACLE_ADDRESS = '0xcf814870800a3bcac4a6b858424a9370a64c75ad'

// Oracle ABI for the functions we need
const ORACLE_ABI = [
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
]

// Create viem public client for contract calls
const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(CURRENT_CHAIN.rpcUrls.default.http[0]),
})

interface ChartDataPoint {
  time: number
  value: number
}

interface TokenPriceChartArgs {
  tokenAddress: string
  timeframe?: string
  limit?: number
}

interface VolumeChartData extends ChartDataPoint {
  volume0?: number
  volume1?: number
  count?: number
}

// Helper function to create cursor-based pagination
const createCursorPagination = <T extends { id: string }>(
  items: T[],
  first: number,
  cursorId?: string
) => {
  // Create the edges with cursors
  const edges = items.map((item) => ({
    node: item,
    // Create a cursor from the item ID
    cursor: Buffer.from(item.id).toString('base64'),
  }))

  // Check if there are more results by comparing the requested count with the result count
  const hasNextPage = items.length > first
  // Remove the extra item we fetched to check for more results
  const limitedEdges = hasNextPage ? edges.slice(0, first) : edges

  // Determine if there's a previous page - true if a cursor was provided
  const hasPreviousPage = Boolean(cursorId)

  return {
    edges: limitedEdges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: limitedEdges.length > 0 ? limitedEdges[0].cursor : null,
      endCursor:
        limitedEdges.length > 0 ? limitedEdges[limitedEdges.length - 1].cursor : null,
    },
  }
}

// Helper to decode a cursor
const decodeCursor = (cursor: string): string => {
  try {
    return Buffer.from(cursor, 'base64').toString('utf-8')
  } catch (e) {
    throw new Error(`Invalid cursor: ${cursor}`)
  }
}

export const resolvers = {
  Query: {
    // Token resolvers
    token: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      return prisma.token.findUnique({
        where: { id },
      })
    },
    tokens: async (
      _: any,
      {
        first = 10,
        after,
        where,
        orderBy = 'volumeUSD24h',
        orderDirection = 'desc',
      }: {
        first?: number
        after?: string
        where?: { address?: string; symbol?: string; name?: string }
        orderBy?: string
        orderDirection?: 'asc' | 'desc'
      },
      { prisma, loaders }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          take: first * 2, // Take more than needed for efficient sorting
        }

        // Add filtering by where parameter
        if (where) {
          queryParams.where = {}

          // Filter by address if provided
          if (where.address) {
            queryParams.where.address = where.address.toLowerCase()
          }

          // Filter by symbol if provided
          if (where.symbol) {
            queryParams.where.symbol = where.symbol
          }

          // Filter by name if provided
          if (where.name) {
            queryParams.where.name = where.name
          }
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // For standard fields, we can use Prisma's orderBy
        if (['createdAt', 'name', 'symbol'].includes(orderBy)) {
          queryParams.orderBy = { [orderBy]: orderDirection }
        }

        // Fetch tokens with pagination
        const tokens = await prisma.token.findMany(queryParams)

        // If we're ordering by price or volume, we need to handle that separately
        if (['priceUSD', 'volumeUSD24h', 'priceChange24h'].includes(orderBy)) {
          // For production sorting by price, preload all prices in a batch
          if (orderBy === 'priceUSD') {
            // Get token IDs for batch loading
            const tokenIds = tokens.map((token) => token.id)

            // Batch load all token prices
            const tokenPrices = await Promise.all(
              tokenIds.map((id) => loaders.tokenPriceLoader.load(id))
            )

            // Attach prices to tokens
            tokens.forEach((token, i) => {
              token.priceUSD = tokenPrices[i]
            })

            // Sort by price
            tokens.sort((a, b) => {
              const priceA = parseFloat(a.priceUSD ?? '0')
              const priceB = parseFloat(b.priceUSD ?? '0')
              return orderDirection === 'asc' ? priceA - priceB : priceB - priceA
            })
          }
          // For volume or price change, calculate these values and sort
          else if (orderBy === 'volumeUSD24h' || orderBy === 'priceChange24h') {
            // This approach will work but is less efficient for large token sets
            // In production, you would precompute and store these values

            // Calculate the sorting field for each token
            const tokenValues = await Promise.all(
              tokens.map(async (token) => {
                let value: number

                if (orderBy === 'volumeUSD24h') {
                  const volumeUSD = await resolvers.Token.volumeUSD24h(token, null, {
                    prisma,
                    loaders,
                  })
                  value = parseFloat(volumeUSD)
                } else {
                  // priceChange24h
                  value = await resolvers.Token.priceChange24h(token, null, {
                    prisma,
                    loaders,
                  })
                }

                return { token, value }
              })
            )

            // Sort by the calculated value
            tokenValues.sort((a, b) => {
              return orderDirection === 'asc' ? a.value - b.value : b.value - a.value
            })

            // Replace tokens array with sorted tokens
            tokens.length = 0
            tokens.push(...tokenValues.map((tv) => tv.token))
          }
        }

        // Apply pagination to the sorted results
        const pagedTokens = tokens.slice(0, first + 1)

        // Get total count
        const totalCount = await prisma.token.count(
          where ? { where: queryParams.where } : undefined
        )

        // Create pagination response
        const paginationResult = createCursorPagination(
          pagedTokens,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching tokens:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    tokenByAddress: async (
      _: any,
      { address }: { address: string },
      { prisma }: Context
    ) => {
      return prisma.token.findFirst({
        where: { address: address.toLowerCase() },
      })
    },
    pairByAddress: async (
      _: any,
      { address }: { address: string },
      { prisma }: Context
    ) => {
      return prisma.pair.findFirst({
        where: { address: address.toLowerCase() },
        include: {
          token0: true,
          token1: true,
        },
      })
    },

    // Pair resolvers
    pair: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      return prisma.pair.findUnique({
        where: { id },
      })
    },

    pairs: async (
      _: any,
      {
        first = 10,
        after,
        orderBy = 'createdAt',
        orderDirection = 'desc',
      }: {
        first?: number
        after?: string
        orderBy?: 'createdAt' | 'reserve0' | 'reserve1' | 'reserveUSD'
        orderDirection?: 'asc' | 'desc'
      },
      { prisma, loaders }: Context
    ) => {
      try {
        // Handle orderBy for reserveUSD specially since it's not a DB field
        const isOrderByReserveUSD = orderBy === 'reserveUSD'

        if (isOrderByReserveUSD) {
          // For pagination with cursor
          let paginationFilter = {}
          if (after) {
            const cursorId = decodeCursor(after)
            paginationFilter = {
              cursor: { id: cursorId },
              skip: 1, // Skip the cursor itself
            }
          }

          // Query all pairs at once with minimal token data to reduce roundtrips
          const pairs = await prisma.pair.findMany({
            take: first * 2, // Get more than needed for efficient sorting
            ...paginationFilter,
            include: {
              token0: {
                select: { id: true, address: true, symbol: true, decimals: true },
              },
              token1: {
                select: { id: true, address: true, symbol: true, decimals: true },
              },
            },
          })

          // Get all pair IDs
          const pairIds = pairs.map((pair) => pair.id)

          // Get reserveUSD values from Redis cache first in a single batch operation
          const cachedValues = await getCachedPairReserveUSDBulk(pairIds)

          // Identify which pairs need snapshot data
          const missingPairIds = pairIds.filter((id) => !cachedValues[id])

          // Get snapshots for missing pairs in a single query
          let snapshotValues: Record<string, string> = {}
          if (missingPairIds.length > 0) {
            // Find the latest snapshot for each missing pair in one query
            const snapshots = await prisma.pairReserveSnapshot.findMany({
              where: {
                pairId: { in: missingPairIds },
              },
              orderBy: { timestamp: 'desc' },
              distinct: ['pairId'],
            })

            // Create a map of the snapshot values
            snapshotValues = snapshots.reduce(
              (acc, snapshot) => {
                acc[snapshot.pairId] = snapshot.reserveUSD
                return acc
              },
              {} as Record<string, string>
            )
          }

          // Keep track of pairs needing calculation
          const pairsNeedingCalculation = pairs.filter(
            (pair) => !cachedValues[pair.id] && !snapshotValues[pair.id]
          )

          // Calculate reserveUSD for remaining pairs in parallel
          let calculatedValues: Record<string, string> = {}
          if (pairsNeedingCalculation.length > 0) {
            const calculations = await Promise.all(
              pairsNeedingCalculation.map(async (pair) => {
                try {
                  const reserveUSD = await calculateReservesUSD(pair, prisma)
                  return { pairId: pair.id, reserveUSD }
                } catch (error) {
                  console.error(
                    `Error calculating reserveUSD for pair ${pair.id}:`,
                    error
                  )
                  return { pairId: pair.id, reserveUSD: '0' }
                }
              })
            )

            // Convert to map
            calculatedValues = calculations.reduce(
              (acc, { pairId, reserveUSD }) => {
                acc[pairId] = reserveUSD
                return acc
              },
              {} as Record<string, string>
            )

            // Cache the newly calculated values for future use
            const pairsToCache = calculations.map(({ pairId, reserveUSD }) => ({
              id: pairId,
              reserveUSD,
            }))

            if (pairsToCache.length > 0) {
              // Don't await this to avoid blocking response
              cachePairReserveUSDBulk(pairsToCache).catch((err) => {
                console.error('Error caching calculated values:', err)
              })
            }
          }

          // Assemble all pairs with their reserveUSD values
          const pairsWithReserves = pairs.map((pair) => {
            // Use cached value, snapshot value, or calculated value (in that order of preference)
            const reserveUSD =
              cachedValues[pair.id] ||
              snapshotValues[pair.id] ||
              calculatedValues[pair.id] ||
              '0'

            return {
              ...pair,
              reserveUSD,
              tvl: parseFloat(reserveUSD),
            }
          })

          // Sort by reserveUSD
          pairsWithReserves.sort((a, b) => {
            const valA = a.tvl
            const valB = b.tvl
            return orderDirection === 'asc' ? valA - valB : valB - valA
          })

          // Apply pagination and take correct number of results
          const page = pairsWithReserves.slice(0, first + 1)

          // Get total count (consider caching this if it's expensive)
          const totalCount = await prisma.pair.count()

          // Create pagination response
          const paginationResult = createCursorPagination(
            page,
            first,
            after ? decodeCursor(after) : undefined
          )

          return {
            ...paginationResult,
            totalCount,
          }
        } else {
          // For all other orderBy fields, use standard Prisma query with pagination
          const orderByParam = { [orderBy]: orderDirection }

          // For pagination with cursor
          let paginationFilter = {}
          if (after) {
            const cursorId = decodeCursor(after)
            paginationFilter = {
              cursor: { id: cursorId },
              skip: 1, // Skip the cursor itself
            }
          }

          // Fetch pairs directly with Prisma's built-in ordering and pagination
          const pairs = await prisma.pair.findMany({
            take: first + 1, // Take one extra to check for next page
            orderBy: orderByParam,
            ...paginationFilter,
            include: {
              token0: true,
              token1: true,
            },
          })

          // Get total count
          const totalCount = await prisma.pair.count()

          // Create pagination response
          const paginationResult = createCursorPagination(
            pairs,
            first,
            after ? decodeCursor(after) : undefined
          )

          return {
            ...paginationResult,
            totalCount,
          }
        }
      } catch (error) {
        console.error('Error fetching pairs:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },

    topPairs: async (_: any, { first = 10 }: { first?: number }, { prisma }: Context) => {
      try {
        // Fetch pairs ordered by a metric that defines "top"
        // You might use volumeUSD, TVL, or another metric
        const pairs = await prisma.pair.findMany({
          take: first + 1,
          orderBy: { createdAt: 'desc' }, // Replace with your actual metric
        })

        // Get total count
        const totalCount = await prisma.pair.count()

        // Create pagination response
        const paginationResult = createCursorPagination(pairs, first)

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching top pairs:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },

    pairPriceChart: async (
      _: any,
      {
        pairAddress,
        timeframe = '1d',
        limit = 100,
      }: {
        pairAddress: string
        timeframe?: string
        limit?: number
      },
      { prisma }: Context
    ): Promise<ChartDataPoint[]> => {
      try {
        // Find the pair
        const pair = await prisma.pair.findFirst({
          where: { address: pairAddress.toLowerCase() },
          include: {
            token0: true,
            token1: true,
          },
        })

        if (!pair) {
          throw new Error(`Pair not found: ${pairAddress}`)
        }

        // Get token decimals
        const token0Decimals = pair.token0.decimals || 18
        const token1Decimals = pair.token1.decimals || 18

        // Check if either token is a stablecoin
        const stablecoinAddresses = TokenPriceService.getStablecoinAddresses()
        const isToken0Stablecoin = stablecoinAddresses.includes(
          pair.token0.address.toLowerCase()
        )
        const isToken1Stablecoin = stablecoinAddresses.includes(
          pair.token1.address.toLowerCase()
        )

        // Determine time window based on timeframe
        const now = Math.floor(Date.now() / 1000)
        let timeWindow: number

        switch (timeframe) {
          case '1h':
            timeWindow = 60 * 60 * limit // 1 hour × limit
            break
          case '4h':
            timeWindow = 4 * 60 * 60 * limit // 4 hours × limit
            break
          case '1w':
            timeWindow = 7 * 24 * 60 * 60 * limit // 1 week × limit
            break
          case '1m':
            timeWindow = 30 * 24 * 60 * 60 * limit // ~1 month × limit
            break
          case '1d':
          default:
            timeWindow = 24 * 60 * 60 * limit // 1 day × limit
            break
        }

        const startTime = now - timeWindow

        // Get price snapshots from the specified time range
        const priceSnapshots = await prisma.priceSnapshot.findMany({
          where: {
            pairId: pair.id,
            timestamp: { gte: startTime },
          },
          orderBy: { timestamp: 'asc' },
          distinct: ['timestamp'],
        })

        // Process the price snapshots to get properly formatted chart data
        let chartData: ChartDataPoint[] = []

        // Choose the correct display strategy based on the pair composition
        if (isToken1Stablecoin) {
          // If token1 is a stablecoin, we want to show token0's price in USD
          chartData = priceSnapshots.map((snapshot) => {
            // Get token0's price in terms of token1 (the stablecoin)
            const rawPrice = snapshot.token0Price

            try {
              // Convert the raw price to a human-readable format using viem
              // We need to account for the difference in token decimals
              const decimalAdjustment = token1Decimals - token0Decimals

              let price: number
              if (decimalAdjustment !== 0) {
                // Parse the raw price to a BigInt with the stablecoin's decimals precision
                const rawPriceBigInt = parseUnits(rawPrice, token1Decimals)
                // Format back to a number, adjusting for the decimal difference
                price = parseFloat(
                  formatUnits(rawPriceBigInt, token1Decimals - decimalAdjustment)
                )
              } else {
                price = parseFloat(rawPrice)
              }

              return {
                time: snapshot.timestamp,
                value: price,
              }
            } catch (error) {
              // Fallback for any parsing errors
              return {
                time: snapshot.timestamp,
                value: parseFloat(rawPrice),
              }
            }
          })
        } else if (isToken0Stablecoin) {
          // If token0 is a stablecoin, we want to show token1's price in USD
          // We need to take the reciprocal of token0Price
          chartData = priceSnapshots.map((snapshot) => {
            // We need the reciprocal since we want token1's price in terms of token0
            const rawPrice = snapshot.token0Price

            try {
              // First, convert the raw price to a proper number
              const decimalAdjustment = token0Decimals - token1Decimals

              let basePrice: number
              if (decimalAdjustment !== 0) {
                // Parse the raw price to a BigInt with token0's decimals precision
                const rawPriceBigInt = parseUnits(rawPrice, token0Decimals)
                // Format back to a number, adjusting for the decimal difference
                basePrice = parseFloat(
                  formatUnits(rawPriceBigInt, token0Decimals - decimalAdjustment)
                )
              } else {
                basePrice = parseFloat(rawPrice)
              }

              // Now take the reciprocal to get token1's price in token0
              // Avoid division by zero
              const price = basePrice > 0 ? 1 / basePrice : 0

              return {
                time: snapshot.timestamp,
                value: price,
              }
            } catch (error) {
              // Fallback for any parsing errors
              const price = parseFloat(rawPrice) > 0 ? 1 / parseFloat(rawPrice) : 0
              return {
                time: snapshot.timestamp,
                value: price,
              }
            }
          })
        } else {
          // If neither token is a stablecoin, we need to handle differently
          // We'll use token0's price and try to get USD conversion
          // This is more complex and would typically involve oracles
          chartData = await Promise.all(
            priceSnapshots.map(async (snapshot) => {
              const rawPrice = snapshot.token0Price

              try {
                // First get a properly formatted token0 price in terms of token1
                const decimalAdjustment = token1Decimals - token0Decimals

                let basePrice: number
                if (decimalAdjustment !== 0) {
                  const rawPriceBigInt = parseUnits(rawPrice, token1Decimals)
                  basePrice = parseFloat(
                    formatUnits(rawPriceBigInt, token1Decimals - decimalAdjustment)
                  )
                } else {
                  basePrice = parseFloat(rawPrice)
                }

                // For a production app, you'd use an oracle here to get token1's USD price
                // Then multiply basePrice by token1's USD price
                // This is a placeholder - in reality, you'd implement a proper price lookup
                const token1UsdPrice = 1.0 // Replace with actual USD price lookup

                return {
                  time: snapshot.timestamp,
                  value: basePrice * token1UsdPrice,
                }
              } catch (error) {
                // Fallback for any parsing errors
                return {
                  time: snapshot.timestamp,
                  value: parseFloat(rawPrice),
                }
              }
            })
          )
        }

        // Final pass to check for and fix any abnormal values
        // These might occur if our decimal handling wasn't perfect
        const values = chartData.map((point) => point.value)
        const needsNormalization =
          TokenPriceService.detectNeedsDecimalNormalization(values)

        if (needsNormalization) {
          // Use our dedicated service to normalize the values
          return chartData.map((point) => ({
            time: point.time,
            value: TokenPriceService.normalizePrice(
              point.value,
              Math.max(token0Decimals, token1Decimals)
            ),
          }))
        }

        return chartData
      } catch (error) {
        console.error('Error fetching pair price chart data:', error)
        return []
      }
    },

    // Get volume chart data for a pair
    pairVolumeChart: async (
      _: any,
      {
        pairAddress,
        timeframe = '1d',
        limit = 100,
      }: {
        pairAddress: string
        timeframe?: string
        limit?: number
      },
      { prisma }: Context
    ): Promise<VolumeChartData[]> => {
      try {
        // Find the pair
        const pair = await prisma.pair.findFirst({
          where: { address: pairAddress.toLowerCase() },
          include: {
            token0: true,
            token1: true,
          },
        })

        if (!pair) {
          throw new Error(`Pair not found: ${pairAddress}`)
        }

        // Get token decimals for proper conversion
        const token0Decimals = pair.token0.decimals || 18
        const token1Decimals = pair.token1.decimals || 18

        // Determine if either token is a stablecoin for easier USD conversion
        const stablecoinAddresses = TokenPriceService.getStablecoinAddresses()
        const isToken0Stablecoin = stablecoinAddresses.includes(
          pair.token0.address.toLowerCase()
        )
        const isToken1Stablecoin = stablecoinAddresses.includes(
          pair.token1.address.toLowerCase()
        )

        // Get token prices in USD - we'll cache these to avoid repeated lookups
        let token0PriceUSD: number = 0
        let token1PriceUSD: number = 0

        // If token0 is a stablecoin, its price is 1 USD
        if (isToken0Stablecoin) {
          token0PriceUSD = 1.0
        } else {
          // Get token0 price from the price service
          token0PriceUSD = await TokenPriceService.getTokenPriceUSD(
            pair.token0.id,
            token0Decimals
          )
        }

        // If token1 is a stablecoin, its price is 1 USD
        if (isToken1Stablecoin) {
          token1PriceUSD = 1.0
        } else {
          // Get token1 price from the price service
          token1PriceUSD = await TokenPriceService.getTokenPriceUSD(
            pair.token1.id,
            token1Decimals
          )
        }

        // Determine time window based on timeframe
        const now = Math.floor(Date.now() / 1000)
        let timeWindow: number
        let interval: number

        switch (timeframe) {
          case '1h':
            timeWindow = 60 * 60 * limit
            interval = 60 // 1 minute intervals for hourly view
            break
          case '4h':
            timeWindow = 4 * 60 * 60 * limit
            interval = 60 * 5 // 5 minute intervals for 4h view
            break
          case '1w':
            timeWindow = 7 * 24 * 60 * 60 * limit
            interval = 60 * 60 * 3 // 3 hour intervals for weekly view
            break
          case '1m':
            timeWindow = 30 * 24 * 60 * 60 * limit
            interval = 60 * 60 * 12 // 12 hour intervals for monthly view
            break
          case '1d':
          default:
            timeWindow = 24 * 60 * 60 * limit
            interval = 60 * 30 // 30 minute intervals for daily view
            break
        }

        const startTime = now - timeWindow

        // Get swaps from the specified time range
        const swaps = await prisma.swap.findMany({
          where: {
            pairId: pair.id,
            timestamp: { gte: startTime },
          },
          orderBy: { timestamp: 'asc' },
        })

        // Group swaps by time bucket
        interface VolumeBucket {
          volume0: number
          volume1: number
          volumeUSD: number
          count: number
        }

        const volumeBuckets: Record<number, VolumeBucket> = {}

        for (const swap of swaps) {
          // Calculate which bucket this swap belongs to
          const bucketTime = Math.floor(swap.timestamp / interval) * interval

          // Calculate properly formatted volumes using token decimals
          let volume0: number
          let volume1: number

          try {
            // Use viem to properly format the volumes
            const amountIn0 = formatUnits(BigInt(swap.amountIn0), token0Decimals)
            const amountOut0 = formatUnits(BigInt(swap.amountOut0), token0Decimals)
            volume0 = parseFloat(amountIn0) + parseFloat(amountOut0)

            const amountIn1 = formatUnits(BigInt(swap.amountIn1), token1Decimals)
            const amountOut1 = formatUnits(BigInt(swap.amountOut1), token1Decimals)
            volume1 = parseFloat(amountIn1) + parseFloat(amountOut1)
          } catch (error) {
            // Fallback if viem formatting fails
            volume0 =
              (parseFloat(swap.amountIn0) + parseFloat(swap.amountOut0)) /
              Math.pow(10, token0Decimals)
            volume1 =
              (parseFloat(swap.amountIn1) + parseFloat(swap.amountOut1)) /
              Math.pow(10, token1Decimals)
          }

          // Calculate USD value by multiplying by token prices
          const volume0USD = volume0 * token0PriceUSD
          const volume1USD = volume1 * token1PriceUSD

          // Use the higher USD value to represent the swap's volume
          // This reduces issues with imbalanced prices
          const volumeUSD = Math.max(volume0USD, volume1USD)

          // Check if we have existing records for this bucket
          if (!volumeBuckets[bucketTime]) {
            volumeBuckets[bucketTime] = {
              volume0,
              volume1,
              volumeUSD,
              count: 1,
            }
          } else {
            // Update existing bucket
            volumeBuckets[bucketTime].volume0 += volume0
            volumeBuckets[bucketTime].volume1 += volume1
            volumeBuckets[bucketTime].volumeUSD += volumeUSD
            volumeBuckets[bucketTime].count += 1
          }
        }

        // Convert to array for the chart
        const chartData: VolumeChartData[] = Object.entries(volumeBuckets).map(
          ([timeStr, data]) => ({
            time: parseInt(timeStr, 10),
            value: data.volumeUSD, // Using proper USD volume as primary value
            volume0: data.volume0,
            volume1: data.volume1,
            count: data.count,
          })
        )

        // Sort by time
        return chartData.sort((a, b) => a.time - b.time)
      } catch (error) {
        console.error('Error fetching pair volume chart data:', error)
        return []
      }
    },

    // Get price chart data for a token across all its pairs
    tokenPriceChart: async (
      _: any,
      { tokenAddress, timeframe = '1d', limit = 100 }: TokenPriceChartArgs,
      { prisma }: Context
    ): Promise<ChartDataPoint[]> => {
      try {
        // Find the token
        const token = await prisma.token.findFirst({
          where: { address: tokenAddress.toLowerCase() },
        })

        if (!token) {
          throw new Error(`Token not found: ${tokenAddress}`)
        }

        // Get token decimals
        const tokenDecimals: number = token.decimals || 18

        // Get stablecoin addresses for identification
        const stablecoinAddresses: string[] = TokenPriceService.getStablecoinAddresses()
        const isTokenStablecoin: boolean = stablecoinAddresses.includes(
          token.address.toLowerCase()
        )

        // Find all pairs where this token is token0 or token1
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [{ token0Id: token.id }, { token1Id: token.id }],
          },
          include: {
            token0: true,
            token1: true,
          },
        })

        if (pairs.length === 0) {
          return []
        }

        // Determine time window based on timeframe
        const now: number = Math.floor(Date.now() / 1000)
        let timeWindow: number

        switch (timeframe) {
          case '1h':
            timeWindow = 60 * 60 * limit
            break
          case '4h':
            timeWindow = 4 * 60 * 60 * limit
            break
          case '1w':
            timeWindow = 7 * 24 * 60 * 60 * limit
            break
          case '1m':
            timeWindow = 30 * 24 * 60 * 60 * limit
            break
          case '1d':
          default:
            timeWindow = 24 * 60 * 60 * limit
            break
        }

        const startTime: number = now - timeWindow

        // Prioritize pairs for best USD price derivation
        let orderedPairs = []

        // For non-stablecoins, prioritize stablecoin pairs
        if (!isTokenStablecoin) {
          // Find pairs where counterpart is a stablecoin
          const stablecoinPairs = pairs.filter((pair) => {
            return pair.token0Id === token.id
              ? stablecoinAddresses.includes(pair.token1.address.toLowerCase())
              : stablecoinAddresses.includes(pair.token0.address.toLowerCase())
          })

          // Prioritize stablecoin pairs, then add remaining pairs
          orderedPairs = [
            ...stablecoinPairs,
            ...pairs.filter((pair) => !stablecoinPairs.includes(pair)),
          ]
        }
        // For stablecoins, prioritize pairs with other tokens to see market values
        else {
          // For stablecoins, prioritize pairs with major tokens
          const majorTokenAddresses: string[] = [
            KKUB_ADDRESS[CURRENT_CHAIN.id], // Replace with your KKUB address
            // Add other major token addresses if relevant
          ].map((addr) => addr.toLowerCase())

          // Find pairs with major tokens
          const majorTokenPairs = pairs.filter((pair) => {
            return pair.token0Id === token.id
              ? majorTokenAddresses.includes(pair.token1.address.toLowerCase())
              : majorTokenAddresses.includes(pair.token0.address.toLowerCase())
          })

          // Prioritize major token pairs, then add remaining pairs
          orderedPairs = [
            ...majorTokenPairs,
            ...pairs.filter((pair) => !majorTokenPairs.includes(pair)),
          ]
        }

        // If no prioritization happened, use all pairs
        if (orderedPairs.length === 0) {
          orderedPairs = pairs
        }

        let priceSeries: ChartDataPoint[] = []

        // Process each pair to get price data
        for (const pair of orderedPairs) {
          // Determine if the token is token0 or token1 in this pair
          const isToken0: boolean = pair.token0Id === token.id

          // Get counterpart token details
          const counterpartToken = isToken0 ? pair.token1 : pair.token0
          const counterpartDecimals: number = counterpartToken.decimals || 18
          const isCounterpartStablecoin: boolean = stablecoinAddresses.includes(
            counterpartToken.address.toLowerCase()
          )

          // Get price snapshots for this pair
          const snapshots = await prisma.priceSnapshot.findMany({
            where: {
              pairId: pair.id,
              timestamp: { gte: startTime },
            },
            orderBy: { timestamp: 'asc' },
          })

          if (snapshots.length === 0) continue

          // Get current USD price of counterpart token if available
          let counterpartUsdPrice: number | null = null
          try {
            // Check if the counterpart is a stablecoin
            const isCounterpartStablecoin: boolean = stablecoinAddresses.includes(
              counterpartToken.address.toLowerCase()
            )

            // Use the enhanced price service to get reliable counterpart price
            counterpartUsdPrice = await TokenPriceService.getCounterpartTokenPrice(
              {
                id: counterpartToken.id,
                address: counterpartToken.address,
                decimals: counterpartDecimals,
                symbol: counterpartToken.symbol || '',
              },
              isCounterpartStablecoin,
              prisma
            )

            if (process.env.NODE_ENV === 'development') {
              console.log(
                `Counterpart token ${counterpartToken.symbol} price: $${counterpartUsdPrice}`
              )
            }
          } catch (error) {
            console.error(
              `Error getting counterpart price for ${counterpartToken.symbol}:`,
              error
            )
          }

          // If we couldn't determine a price for non-stablecoin counterpart, try another pair if available
          if (
            (!counterpartUsdPrice || counterpartUsdPrice <= 0) &&
            !isCounterpartStablecoin &&
            orderedPairs.length > 1
          ) {
            console.log(
              `No reliable price for ${counterpartToken.symbol}, skipping to next pair`
            )
            continue // Try next pair
          }

          // Final fallback - if we have no price and this is our only option, use 0
          // This should rarely happen with our enhanced price service
          if (counterpartUsdPrice === null || counterpartUsdPrice <= 0) {
            counterpartUsdPrice = 0
            console.warn(
              `Unable to determine price for ${counterpartToken.symbol}, using 0`
            )
          }

          // Now process the snapshots with the reliable counterpart price
          const pairPriceData: ChartDataPoint[] = snapshots
            .map((snapshot) => {
              // Get the raw exchange rates from the snapshot
              const token0PriceRaw: string = snapshot.token0Price
              const token1PriceRaw: string = snapshot.token1Price

              // Normalize blockchain-scale values if needed
              let token0Price = parseFloat(token0PriceRaw)
              let token1Price = parseFloat(token1PriceRaw)

              // Normalize token0Price if needed
              const token0Magnitude = Math.floor(Math.log10(Math.abs(token0Price || 1)))
              if (token0Magnitude >= (counterpartDecimals || 18) - 4) {
                token0Price = token0Price / Math.pow(10, counterpartDecimals || 18)
              }

              // Normalize token1Price if needed
              const token1Magnitude = Math.floor(Math.log10(Math.abs(token1Price || 1)))
              if (token1Magnitude >= (tokenDecimals || 18) - 4) {
                token1Price = token1Price / Math.pow(10, tokenDecimals || 18)
              }

              // Debug logging for development only
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  `Processing ${isToken0 ? pair.token0.symbol : pair.token1.symbol}`
                )
                console.log(`Token position: ${isToken0 ? 'token0' : 'token1'}`)
                console.log(`token0Price: ${token0Price}, token1Price: ${token1Price}`)
                console.log(`Counterpart USD price: ${counterpartUsdPrice}`)
              }

              // Calculate USD price based on token position and pair relationship
              let usdPrice: number

              // CASE 1: Our token is token0 in the pair
              if (isToken0) {
                if (isCounterpartStablecoin) {
                  // Counterpart (token1) is a stablecoin
                  // token0Price directly represents "token1 per token0" which is the USD value
                  usdPrice = token0Price
                } else {
                  // Counterpart (token1) is not a stablecoin
                  // "token1 per token0" * (USD per token1) = USD per token0
                  usdPrice = token0Price * counterpartUsdPrice
                }
              }
              // CASE 2: Our token is token1 in the pair
              else {
                if (isCounterpartStablecoin) {
                  // Counterpart (token0) is a stablecoin
                  // token1Price is "token0 per token1", which is directly "USD per token1"
                  usdPrice = token1Price
                } else {
                  // Counterpart (token0) is not a stablecoin
                  // For token1 paired with non-stablecoin token0:
                  // (USD per token0) * (token0 per token1) = USD per token1
                  usdPrice = counterpartUsdPrice * token1Price

                  // Add debug logging for specific tokens like KOI
                  if (
                    (pair.token1.symbol === 'KOI' || pair.token0.symbol === 'KOI') &&
                    process.env.NODE_ENV === 'development'
                  ) {
                    console.log(
                      `KOI calculation: Using multiplication formula: ${counterpartUsdPrice} * ${token1Price} = ${usdPrice}`
                    )
                    // Also calculate with division for comparison
                    const altCalc =
                      token1Price > 0 ? counterpartUsdPrice / token1Price : 0
                    console.log(
                      `Alternative division formula: ${counterpartUsdPrice} / ${token1Price} = ${altCalc}`
                    )
                  }
                }
              }

              // Skip data points where we couldn't calculate a valid price
              if (
                usdPrice === null ||
                usdPrice === undefined ||
                isNaN(usdPrice) ||
                !isFinite(usdPrice) ||
                usdPrice <= 0
              ) {
                return null
              }

              return {
                time: snapshot.timestamp,
                value: usdPrice,
              }
            })
            .filter((point) => point !== null)
          // Add to our price series
          priceSeries = [...priceSeries, ...pairPriceData]

          // If we have data from a stablecoin pair and not a stablecoin token itself,
          // this is the best source for USD price
          if (isCounterpartStablecoin && !isTokenStablecoin && pairPriceData.length > 0) {
            break
          }
        }

        // Sort by time and return
        return priceSeries.sort((a, b) => a.time - b.time)
      } catch (error) {
        console.error('Error fetching token price chart data:', error)
        return []
      }
    },

    // Inside the Query object in your resolvers
    recentTransactions: async (
      _: any,
      { first = 20, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { timestamp: 'desc' },
          where: {
            contractSender: { not: null },
          },
          include: {
            pair: {
              include: {
                token0: true,
                token1: true,
              },
            },
          },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch recent swaps with pagination
        const swaps = await prisma.swap.findMany(queryParams)

        // Log the number of swaps found
        console.log(`Found ${swaps.length} swaps in recentTransactions query`)

        // If no swaps were found, log this fact
        if (swaps.length === 0) {
          // Log a count of all swaps in the database to verify data exists
          const totalSwaps = await prisma.swap.count()
          console.log(`Total swaps in database: ${totalSwaps}`)
        }

        // Get total count
        const totalCount = await prisma.swap.count()

        // Create pagination response
        const paginationResult = createCursorPagination(
          swaps,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching recent transactions:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },

    // User resolvers
    user: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      const user = await prisma.userStat.findUnique({
        where: { userAddress: id },
      })
      return user
        ? {
            id: user.id,
            address: user.userAddress,
            totalSwapCount: user.totalSwapCount,
            totalLpCount: user.totalLpCount,
            swapVolumeUSD: user.swapVolumeUSD,
            liquidityProvidedUSD: user.liquidityProvidedUSD,
          }
        : null
    },
    userPositions: async (
      _: any,
      { userAddress }: { userAddress: string },
      { prisma }: Context
    ) => {
      // Get liquidity positions - only include positions with non-zero tokens
      const liquidityPositions = await prisma.liquidityPosition.findMany({
        where: {
          userAddress,
          // liquidityTokens: { not: '0' },
        },
        include: {
          pair: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      })

      // Get farming positions
      const farmingPositions = await prisma.farmingPosition.findMany({
        where: { userAddress },
        include: {
          pool: true,
        },
      })

      // Get staking position
      const stakingPosition = await prisma.stakingPosition.findUnique({
        where: { userAddress },
      })

      return {
        liquidityPositions,
        farmingPositions,
        stakingPosition,
      }
    },

    // Protocol metrics
    protocolMetrics: async (_: any, {}: {}, { prisma }: Context) => {
      // Get the latest protocol metrics
      const metrics = await prisma.protocolMetric.findFirst({
        orderBy: { timestamp: 'desc' },
      })

      return (
        metrics || {
          id: '0',
          timestamp: Math.floor(Date.now() / 1000),
          totalValueLockedUSD: '0',
          liquidityPoolsTVL: '0',
          stakingTVL: '0',
          farmingTVL: '0',
          dailyVolumeUSD: '0',
          weeklyVolumeUSD: '0',
          monthlyVolumeUSD: '0',
          totalVolumeUSD: '0',
          dailyFeesUSD: '0',
          weeklyFeesUSD: '0',
          monthlyFeesUSD: '0',
          totalFeesUSD: '0',
          totalUsers: 0,
          dailyActiveUsers: 0,
          weeklyActiveUsers: 0,
          monthlyActiveUsers: 0,
        }
      )
    },

    // Farm pool resolvers
    farmingPools: async (
      _: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { pid: 'asc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch farming pools with pagination
        const pools = await prisma.farmingPool.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.farmingPool.count()

        // Create pagination response
        const paginationResult = createCursorPagination(
          pools,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching farming pools:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    farmingPool: async (_: any, { pid }: { pid: number }, { prisma }: Context) => {
      return prisma.farmingPool.findUnique({
        where: { pid },
      })
    },

    // Staking metrics
    stakingMetrics: async (_: any, {}: {}, { prisma }: Context) => {
      // Get the latest staking metrics
      const metrics = await prisma.stakingMetric.findFirst({
        orderBy: { timestamp: 'desc' },
      })

      return (
        metrics || {
          id: '0',
          timestamp: Math.floor(Date.now() / 1000),
          totalPonderStaked: '0',
          totalXPonderBalance: '0',
          totalRewardsClaimed: '0',
          totalStakers: 0,
          totalRebases: 0,
          currentAPR: null,
        }
      )
    },

    // Launch resolvers
    activeLaunches: async (
      _: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { status: 'ACTIVE' },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { createdAt: 'desc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch active launches with pagination
        const launches = await prisma.launch.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.launch.count({
          where: { status: 'ACTIVE' },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          launches,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching active launches:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    completedLaunches: async (
      _: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { status: 'COMPLETED' },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { completedAt: 'desc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch completed launches with pagination
        const launches = await prisma.launch.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.launch.count({
          where: { status: 'COMPLETED' },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          launches,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching completed launches:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    launch: async (_: any, { launchId }: { launchId: number }, { prisma }: Context) => {
      return prisma.launch.findUnique({
        where: { launchId },
      })
    },
  },
  // Swap type resolver
  Swap: {
    pair: async (parent: any, _: any, { loaders }: Context) => {
      if (!parent.pairId) return null
      return loaders.pairLoader.load(parent.pairId)
    },

    token0: async (parent: any, _: any, { prisma, loaders }: Context) => {
      if (parent.token0) return parent.token0

      try {
        // If pair is already loaded with the swap, use it directly
        if (parent.pair?.token0Id) {
          return loaders.tokenLoader.load(parent.pair.token0Id)
        }

        // Otherwise, load the pair first
        const pair = await loaders.pairLoader.load(parent.pairId)
        if (!pair) return null

        return loaders.tokenLoader.load(pair.token0Id)
      } catch (error) {
        console.error(`Error loading token0 for swap ${parent.id}:`, error)
        return null
      }
    },

    token1: async (parent: any, _: any, { prisma, loaders }: Context) => {
      if (parent.token1) return parent.token1

      try {
        // If pair is already loaded with the swap, use it directly
        if (parent.pair?.token1Id) {
          return loaders.tokenLoader.load(parent.pair.token1Id)
        }

        // Otherwise, load the pair first
        const pair = await loaders.pairLoader.load(parent.pairId)
        if (!pair) return null

        return loaders.tokenLoader.load(pair.token1Id)
      } catch (error) {
        console.error(`Error loading token1 for swap ${parent.id}:`, error)
        return null
      }
    },

    valueUSD: async (parent: any, _: any, { prisma, loaders }: Context) => {
      if (parent.valueUSD) return parent.valueUSD

      try {
        // Load tokens to get prices
        const token0 = await resolvers.Swap.token0(parent, _, { prisma, loaders })
        const token1 = await resolvers.Swap.token1(parent, _, { prisma, loaders })

        if (!token0 || !token1) return '0'

        // Get token prices in USD
        const token0Price = await loaders.tokenPriceLoader.load(token0.id)
        const token1Price = await loaders.tokenPriceLoader.load(token1.id)

        // Get token decimals
        const decimals0 = token0.decimals || 18
        const decimals1 = token1.decimals || 18

        let token0Amount: number
        let token1Amount: number

        try {
          // Use viem for proper decimal handling
          const amountIn0 = formatUnits(BigInt(parent.amountIn0), decimals0)
          const amountOut0 = formatUnits(BigInt(parent.amountOut0), decimals0)
          token0Amount = Math.max(parseFloat(amountIn0), parseFloat(amountOut0))

          const amountIn1 = formatUnits(BigInt(parent.amountIn1), decimals1)
          const amountOut1 = formatUnits(BigInt(parent.amountOut1), decimals1)
          token1Amount = Math.max(parseFloat(amountIn1), parseFloat(amountOut1))
        } catch (error) {
          // Fallback to standard decimal division if BigInt conversion fails
          token0Amount = Math.max(
            parseFloat(parent.amountIn0) / 10 ** decimals0,
            parseFloat(parent.amountOut0) / 10 ** decimals0
          )
          token1Amount = Math.max(
            parseFloat(parent.amountIn1) / 10 ** decimals1,
            parseFloat(parent.amountOut1) / 10 ** decimals1
          )
        }

        // Calculate total value
        const token0Value = token0Amount * parseFloat(token0Price || '0')
        const token1Value = token1Amount * parseFloat(token1Price || '0')

        // Use the larger value (sometimes one token amount might be 0)
        const swapValue = Math.max(token0Value, token1Value)

        return swapValue.toString()
      } catch (error) {
        console.error(`Error calculating USD value for swap ${parent.id}:`, error)
        return '0'
      }
    },
  },

  // Type resolvers
  Token: {
    pairs0: async (parent: any, _: any, { prisma }: Context) => {
      return prisma.pair.findMany({
        where: { token0Id: parent.id },
      })
    },
    pairs1: async (parent: any, _: any, { prisma }: Context) => {
      return prisma.pair.findMany({
        where: { token1Id: parent.id },
      })
    },
    imageURI: async (parent: any, _: any, { prisma }: Context) => {
      if (parent.imageURI !== undefined) {
        return parent.imageURI
      }

      try {
        const token = await prisma.token.findUnique({
          where: { id: parent.id },
          select: { imageURI: true },
        })
        return token?.imageURI || null
      } catch (error) {
        console.error('Error fetching token imageURI:', error)
        return null
      }
    },
    priceUSD: async (parent: any, _: any, { loaders, prisma }: Context) => {
      // If we already have the calculated value, return it immediately
      if (parent.priceUSD) return parent.priceUSD

      try {
        // Use dataloader to batch price queries
        return loaders.tokenPriceLoader.load(parent.id)
      } catch (error) {
        console.error(`Error getting price for token ${parent.id}:`, error)
        return '0'
      }
    },
    priceChange24h: async (parent: any, _: any, { prisma }: Context) => {
      try {
        // Calculate 24h ago timestamp
        const now = Math.floor(Date.now() / 1000)
        const oneDayAgo = now - 24 * 60 * 60

        // Get token decimals
        const token = await prisma.token.findUnique({
          where: { id: parent.id },
          select: { decimals: true },
        })
        const tokenDecimals = token?.decimals || 18

        // Find pairs where this token is token0 or token1
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [{ token0Id: parent.id }, { token1Id: parent.id }],
          },
          include: {
            token0: true,
            token1: true,
          },
        })

        if (pairs.length === 0) {
          return 0 // No pairs found, so no price change
        }

        // Get current price
        const currentPrice = parseFloat(
          await resolvers.Token.priceUSD(parent, _, { loaders: {} as any, prisma })
        )

        // Prioritize stablecoin pairs for more accurate price change calculation
        const stablecoinAddresses = TokenPriceService.getStablecoinAddresses()
        const stablecoinPairs = pairs.filter(
          (pair) =>
            stablecoinAddresses.includes(pair.token0.address.toLowerCase()) ||
            stablecoinAddresses.includes(pair.token1.address.toLowerCase())
        )

        // Use stablecoin pairs if available, otherwise use all pairs
        const pairsToUse = stablecoinPairs.length > 0 ? stablecoinPairs : pairs

        // For each pair, find the latest snapshot from 24h ago
        const historicalSnapshots = await Promise.all(
          pairsToUse.map((pair) =>
            prisma.priceSnapshot.findFirst({
              where: {
                pairId: pair.id,
                timestamp: { lte: oneDayAgo },
              },
              orderBy: { timestamp: 'desc' },
            })
          )
        )

        // Filter out null results
        const validSnapshots = historicalSnapshots
          .filter((snapshot, index): snapshot is NonNullable<typeof snapshot> => {
            return snapshot !== null && pairsToUse[index] !== undefined
          })
          .map((snapshot, index) => ({
            snapshot,
            pair: pairsToUse[index],
          }))

        if (validSnapshots.length === 0) {
          return 0 // No historical snapshots, so no price change
        }

        // Sort by timestamp to get the most recent first
        validSnapshots.sort((a, b) => b.snapshot.timestamp - a.snapshot.timestamp)

        // Get historical price from the most recent snapshot
        const { snapshot, pair } = validSnapshots[0]

        // Check if our token is token0 or token1 in the pair
        const isToken0 = pair.token0Id === parent.id

        // Get the counterpart token's decimals
        const counterpartDecimals = isToken0
          ? pair.token1.decimals || 18
          : pair.token0.decimals || 18

        // Get the appropriate price based on token position
        const rawHistoricalPrice = isToken0 ? snapshot.token0Price : snapshot.token1Price

        // Convert to human-readable number using proper decimal handling
        let historicalPrice: number
        try {
          // Adjust for difference in decimals between the tokens
          const decimalAdjustment = counterpartDecimals - tokenDecimals

          if (decimalAdjustment !== 0) {
            // Use viem to handle decimal conversion correctly
            const rawPriceBigInt = parseUnits(rawHistoricalPrice, counterpartDecimals)
            historicalPrice = parseFloat(
              formatUnits(rawPriceBigInt, counterpartDecimals - decimalAdjustment)
            )
          } else {
            historicalPrice = parseFloat(rawHistoricalPrice)
          }
        } catch (error) {
          // Fallback to standard parsing if viem conversion fails
          historicalPrice = parseFloat(rawHistoricalPrice)
        }

        // Check if the historical price is for a stablecoin pair
        // If not, we might need to convert it to USD
        const isStablecoinPair = isToken0
          ? stablecoinAddresses.includes(pair.token1.address.toLowerCase())
          : stablecoinAddresses.includes(pair.token0.address.toLowerCase())

        // For non-stablecoin pairs, adjust historical price (if possible)
        if (!isStablecoinPair) {
          // This would be a more complex conversion in a production environment
          // For simplicity, we're assuming historicalPrice is already in USD or equivalent
        }

        if (historicalPrice === 0 || currentPrice === 0) {
          return 0 // Avoid division by zero
        }

        // Calculate percentage change
        const priceChange = ((currentPrice - historicalPrice) / historicalPrice) * 100

        return parseFloat(priceChange.toFixed(2))
      } catch (error) {
        console.error(`Error calculating price change for token ${parent.id}:`, error)
        return 0
      }
    },
    volumeUSD24h: async (parent: any, _: any, { prisma }: Context) => {
      try {
        // Calculate 24h ago timestamp
        const now = Math.floor(Date.now() / 1000)
        const oneDayAgo = now - 24 * 60 * 60

        // Find all pairs containing this token
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [{ token0Id: parent.id }, { token1Id: parent.id }],
          },
          include: {
            token0: true,
            token1: true,
          },
        })

        const pairIds = pairs.map((pair) => pair.id)

        // If no pairs, return 0 volume
        if (pairIds.length === 0) return '0'

        // Fetch all swaps in the last 24h for these pairs
        const swaps = await prisma.swap.findMany({
          where: {
            pairId: { in: pairIds },
            timestamp: { gte: oneDayAgo },
          },
        })

        // Calculate token volume
        let volumeUSD = 0

        for (const swap of swaps) {
          // Find which pair this swap belongs to
          const pair = pairs.find((p) => p.id === swap.pairId)
          if (!pair) continue

          // Determine if token is token0 or token1 in this pair
          const isToken0 = pair.token0Id === parent.id

          // Get token price
          const tokenPrice = parseFloat(
            await resolvers.Token.priceUSD(parent, _, { loaders: {} as any, prisma })
          )

          if (tokenPrice <= 0) continue // Skip if we can't determine price

          // Get token decimals
          const tokenDecimals = isToken0
            ? pair.token0.decimals || 18
            : pair.token1.decimals || 18

          try {
            // Calculate volume in USD using viem for proper decimal handling
            if (isToken0) {
              const amountIn0 = formatUnits(BigInt(swap.amountIn0), tokenDecimals)
              const amountOut0 = formatUnits(BigInt(swap.amountOut0), tokenDecimals)
              volumeUSD += (parseFloat(amountIn0) + parseFloat(amountOut0)) * tokenPrice
            } else {
              const amountIn1 = formatUnits(BigInt(swap.amountIn1), tokenDecimals)
              const amountOut1 = formatUnits(BigInt(swap.amountOut1), tokenDecimals)
              volumeUSD += (parseFloat(amountIn1) + parseFloat(amountOut1)) * tokenPrice
            }
          } catch (error) {
            // Fallback to standard decimal division if BigInt conversion fails
            if (isToken0) {
              volumeUSD +=
                (parseFloat(swap.amountIn0) / 10 ** tokenDecimals +
                  parseFloat(swap.amountOut0) / 10 ** tokenDecimals) *
                tokenPrice
            } else {
              volumeUSD +=
                (parseFloat(swap.amountIn1) / 10 ** tokenDecimals +
                  parseFloat(swap.amountOut1) / 10 ** tokenDecimals) *
                tokenPrice
            }
          }
        }

        return volumeUSD.toString()
      } catch (error) {
        console.error(`Error calculating volume for token ${parent.id}:`, error)
        return '0'
      }
    },
  },

  Pair: {
    token0: async (parent: any, _: any, { loaders }: Context) => {
      return loaders.tokenLoader.load(parent.token0Id)
    },
    token1: async (parent: any, _: any, { loaders }: Context) => {
      return loaders.tokenLoader.load(parent.token1Id)
    },
    reserveUSD: async (parent: any, _: any, { loaders, prisma }: Context) => {
      // If we already have the calculated value, return it immediately
      if (parent.reserveUSD) return parent.reserveUSD

      const cacheKey = `pair:${parent.id}:reserveUSD`
      try {
        // Use a single Redis MGET operation for all cache lookups
        const redis = getRedisClient()
        const cachedValue = await redis.get(cacheKey)
        if (cachedValue) return cachedValue
      } catch (error) {
        // Just log and continue if cache fails
        console.error(`Cache error for ${parent.id}:`, error)
      }

      // Use dataloader to batch snapshot queries
      return loaders.reserveUSDLoader.load(parent.id)
    },
    // Now update the tvl resolver to be more efficient
    tvl: async (parent: any, _: any, { loaders, prisma }: Context) => {
      // If we already have the TVL value, use it
      if (parent.tvl !== undefined) return parent.tvl

      // Otherwise, calculate from reserveUSD
      try {
        const reserveUSD = await resolvers.Pair.reserveUSD(parent, _, { loaders, prisma })
        return parseFloat(reserveUSD)
      } catch (error) {
        console.error(`Error calculating TVL for pair ${parent.id}:`, error)
        return 0
      }
    },

    liquidityPositions: async (
      parent: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: {
            pairId: parent.id,
            // Only return positions with non-zero liquidity tokens
            liquidityTokens: { not: '0' },
          },
          take: first + 1, // Take one extra to check if there's a next page
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch liquidity positions with pagination
        const positions = await prisma.liquidityPosition.findMany(queryParams)

        // Get total count - only count non-zero positions
        const totalCount = await prisma.liquidityPosition.count({
          where: {
            pairId: parent.id,
            liquidityTokens: { not: '0' },
          },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          positions,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching liquidity positions:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    swaps: async (
      parent: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { pairId: parent.id },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { timestamp: 'desc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch swaps with pagination
        const swaps = await prisma.swap.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.swap.count({
          where: { pairId: parent.id },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          swaps,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching swaps:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },

    priceHistory: async (
      parent: any,
      {
        days,
        interval = 'day',
        first = 100,
        after,
      }: { days: number; interval?: string; first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        const startTime = Math.floor(Date.now() / 1000) - days * 86400

        // Set up query params
        const queryParams: any = {
          where: {
            pairId: parent.id,
            timestamp: { gte: startTime },
          },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { timestamp: 'asc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch price snapshots with pagination
        const snapshots = await prisma.priceSnapshot.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.priceSnapshot.count({
          where: {
            pairId: parent.id,
            timestamp: { gte: startTime },
          },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          snapshots,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching price history:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
  },

  FarmingPool: {
    positions: async (
      parent: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { poolId: parent.id },
          take: first + 1, // Take one extra to check if there's a next page
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch farming positions with pagination
        const positions = await prisma.farmingPosition.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.farmingPosition.count({
          where: { poolId: parent.id },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          positions,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching farming positions:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
  },

  Launch: {
    contributions: async (
      parent: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { launchId: parent.launchId },
          take: first + 1, // Take one extra to check if there's a next page
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch contributions with pagination
        const contributions = await prisma.contribution.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.contribution.count({
          where: { launchId: parent.launchId },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          contributions,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching contributions:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
  },

  User: {
    liquidityPositions: async (
      parent: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: {
            userAddress: parent.address,
            // Only return positions with non-zero liquidity tokens
            liquidityTokens: { not: '0' },
          },
          take: first + 1, // Take one extra to check if there's a next page
          include: {
            pair: {
              include: {
                token0: true,
                token1: true,
              },
            },
          },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch liquidity positions with pagination
        const positions = await prisma.liquidityPosition.findMany(queryParams)

        // Get total count - only count non-zero positions
        const totalCount = await prisma.liquidityPosition.count({
          where: {
            userAddress: parent.address,
            liquidityTokens: { not: '0' },
          },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          positions,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching user liquidity positions:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    swaps: async (
      parent: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { userAddress: parent.address },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { timestamp: 'desc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch swaps with pagination
        const swaps = await prisma.swap.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.swap.count({
          where: { userAddress: parent.address },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          swaps,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching user swaps:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    farmingPositions: async (
      parent: any,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { userAddress: parent.address },
          take: first + 1, // Take one extra to check if there's a next page
          include: { pool: true },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch farming positions with pagination
        const positions = await prisma.farmingPosition.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.farmingPosition.count({
          where: { userAddress: parent.address },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          positions,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching user farming positions:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },
    stakingPosition: async (parent: any, _: any, { prisma }: Context) => {
      return prisma.stakingPosition.findUnique({
        where: { userAddress: parent.address },
      })
    },
  },
}

async function getTokenPriceFromOracle(params: {
  pairAddress: string
  tokenAddress: string
  amount?: bigint
  periodInSeconds?: number
}): Promise<number> {
  try {
    const {
      pairAddress,
      tokenAddress,
      amount = BigInt('1000000000000000000'),
      periodInSeconds = 3600,
    } = params

    // Call the oracle's consult function
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

    // Calculate the price per token
    const pricePerToken = Number(amountOut) / Number(amount)

    return pricePerToken
  } catch (error) {
    console.error(`Error getting price from oracle:`, error)
    return 0
  }
}

async function findUSDTPair(
  tokenAddress: string,
  prisma: PrismaClient
): Promise<string | null> {
  // Find pairs where the token is paired with USDT
  const pair = await prisma.pair.findFirst({
    where: {
      OR: [
        {
          token0: { address: tokenAddress.toLowerCase() },
          token1: { address: USDT_ADDRESS.toLowerCase() },
        },
        {
          token0: { address: USDT_ADDRESS.toLowerCase() },
          token1: { address: tokenAddress.toLowerCase() },
        },
      ],
    },
  })

  return pair ? pair.address : null
}
