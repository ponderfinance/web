import { PrismaClient } from '@prisma/client'
import { createPublicClient, PublicClient } from 'viem'
import { calculateReservesUSD } from '@/src/lib/graphql/oracleUtils'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { http } from 'wagmi'
import { Context } from './types'
import {
  cachePairReserveUSDBulk,
  getCachedPairReserveUSD,
  getCachedPairReserveUSDBulk,
} from '@/src/lib/redis/pairCache'
import { getRedisClient } from '@/src/lib/redis/client' // Add this import

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
        })

        if (!pair) {
          throw new Error(`Pair not found: ${pairAddress}`)
        }

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
        })

        // Map the data to the format expected by TradingView
        const chartData: ChartDataPoint[] = priceSnapshots.map((snapshot) => ({
          time: snapshot.timestamp,
          value: parseFloat(snapshot.token0Price),
        }))

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
        })

        if (!pair) {
          throw new Error(`Pair not found: ${pairAddress}`)
        }

        // Determine time window based on timeframe
        const now = Math.floor(Date.now() / 1000)
        let timeWindow: number
        let interval: number

        switch (timeframe) {
          case '1h':
            timeWindow = 60 * 60 * limit
            interval = 60 * 60 // 1 hour buckets
            break
          case '4h':
            timeWindow = 4 * 60 * 60 * limit
            interval = 4 * 60 * 60 // 4 hour buckets
            break
          case '1w':
            timeWindow = 7 * 24 * 60 * 60 * limit
            interval = 24 * 60 * 60 // 1 day buckets for weekly view
            break
          case '1m':
            timeWindow = 30 * 24 * 60 * 60 * limit
            interval = 24 * 60 * 60 // 1 day buckets for monthly view
            break
          case '1d':
          default:
            timeWindow = 24 * 60 * 60 * limit
            interval = 60 * 60 // 1 hour buckets for daily view
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
          count: number
        }

        const volumeBuckets: Record<number, VolumeBucket> = {}

        for (const swap of swaps) {
          // Calculate which bucket this swap belongs to
          const bucketTime = Math.floor(swap.timestamp / interval) * interval

          // Calculate total volume from both tokens
          // This is a simplified approach - you might want to convert to USD
          const volume0 = parseFloat(swap.amountIn0) + parseFloat(swap.amountOut0)
          const volume1 = parseFloat(swap.amountIn1) + parseFloat(swap.amountOut1)

          if (!volumeBuckets[bucketTime]) {
            volumeBuckets[bucketTime] = {
              volume0: volume0,
              volume1: volume1,
              count: 1,
            }
          } else {
            volumeBuckets[bucketTime].volume0 += volume0
            volumeBuckets[bucketTime].volume1 += volume1
            volumeBuckets[bucketTime].count += 1
          }
        }

        // Convert to array for TradingView
        const chartData: VolumeChartData[] = Object.entries(volumeBuckets).map(
          ([timeStr, data]) => ({
            time: parseInt(timeStr, 10),
            value: data.volume0, // Using token0 volume as primary metric
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
      {
        tokenAddress,
        timeframe = '1d',
        limit = 100,
      }: {
        tokenAddress: string
        timeframe?: string
        limit?: number
      },
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

        // Collect price data from all pairs
        let allPriceData: ChartDataPoint[] = []

        for (const pair of pairs) {
          // Determine if the token is token0 or token1 in this pair
          const isToken0 = pair.token0Id === token.id

          // Get price snapshots for this pair
          const snapshots = await prisma.priceSnapshot.findMany({
            where: {
              pairId: pair.id,
              timestamp: { gte: startTime },
            },
            orderBy: { timestamp: 'asc' },
          })

          // Extract the appropriate price depending on whether token is token0 or token1
          const pairPriceData: ChartDataPoint[] = snapshots.map((snapshot) => ({
            time: snapshot.timestamp,
            value: isToken0
              ? parseFloat(snapshot.token0Price)
              : parseFloat(snapshot.token1Price),
          }))

          allPriceData = [...allPriceData, ...pairPriceData]
        }

        // If we have multiple pairs, aggregate the prices by time period
        // This is a simplified approach - in practice you might want to weight by pair liquidity
        if (pairs.length > 1) {
          // Define intervals based on timeframe
          let interval: number
          switch (timeframe) {
            case '1h':
              interval = 5 * 60 // 5 minute intervals
              break
            case '4h':
              interval = 15 * 60 // 15 minute intervals
              break
            case '1w':
              interval = 4 * 60 * 60 // 4 hour intervals
              break
            case '1m':
              interval = 12 * 60 * 60 // 12 hour intervals
              break
            case '1d':
            default:
              interval = 60 * 60 // 1 hour intervals
              break
          }

          // Group by time buckets
          interface PriceAggregate {
            sum: number
            count: number
          }

          const aggregated: Record<number, PriceAggregate> = {}

          for (const dataPoint of allPriceData) {
            const bucketTime = Math.floor(dataPoint.time / interval) * interval

            if (!aggregated[bucketTime]) {
              aggregated[bucketTime] = {
                sum: dataPoint.value,
                count: 1,
              }
            } else {
              aggregated[bucketTime].sum += dataPoint.value
              aggregated[bucketTime].count += 1
            }
          }

          // Calculate averages and format for chart
          const chartData: ChartDataPoint[] = Object.entries(aggregated)
            .map(([timeStr, data]) => ({
              time: parseInt(timeStr, 10),
              value: data.sum / data.count,
            }))
            .sort((a, b) => a.time - b.time)

          return chartData
        }

        // If we only have one pair, return the data directly
        return allPriceData.sort((a, b) => a.time - b.time)
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

        // Get token prices
        const token0Price = await loaders.tokenPriceLoader.load(token0.id)
        const token1Price = await loaders.tokenPriceLoader.load(token1.id)

        // Calculate USD value based on the tokens involved
        const token0Amount = Math.max(
          parseFloat(parent.amountIn0),
          parseFloat(parent.amountOut0)
        )

        const token1Amount = Math.max(
          parseFloat(parent.amountIn1),
          parseFloat(parent.amountOut1)
        )

        // Calculate total value
        const token0Value = token0Amount * parseFloat(token0Price)
        const token1Value = token1Amount * parseFloat(token1Price)

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

        // Find pairs where this token is token0 or token1
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [{ token0Id: parent.id }, { token1Id: parent.id }],
          },
          select: { id: true, token0Id: true, token1Id: true },
        })

        if (pairs.length === 0) {
          return 0 // No pairs found, so no price change
        }

        // Get current price
        const currentPrice = parseFloat(
          await resolvers.Token.priceUSD(parent, _, { loaders: {} as any, prisma })
        )

        // For each pair, find the latest snapshot from 24h ago
        const historicalSnapshots = await Promise.all(
          pairs.map((pair) =>
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
            return snapshot !== null && pairs[index] !== undefined
          })
          .map((snapshot, index) => ({
            snapshot,
            pair: pairs[index],
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

        // Get the appropriate price based on token position
        const historicalPrice = parseFloat(
          isToken0 ? snapshot.token0Price : snapshot.token1Price
        )

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
          select: { id: true, token0Id: true, token1Id: true },
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

          // Calculate volume in USD
          if (isToken0) {
            volumeUSD +=
              (parseFloat(swap.amountIn0) + parseFloat(swap.amountOut0)) * tokenPrice
          } else {
            volumeUSD +=
              (parseFloat(swap.amountIn1) + parseFloat(swap.amountOut1)) * tokenPrice
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
