import { PrismaClient } from '@prisma/client'
import { createPublicClient, PublicClient } from 'viem'
import { calculateReservesUSD } from '@/src/lib/graphql/oracleUtils'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { http } from 'wagmi'
import { Context } from './types'
import {
  getCachedPairReserveUSD,
  getCachedPairReserveUSDBulk,
} from '@/src/lib/redis/pairCache' // Add this import

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
      }: {
        first?: number
        after?: string
        where?: { address?: string; symbol?: string; name?: string }
      },
      { prisma }: Context
    ) => {
      // Set up query params
      const queryParams: any = {
        take: first + 1, // Take one extra to check if there's a next page
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

      // Fetch tokens with pagination
      const tokens = await prisma.token.findMany(queryParams)

      // Get total count (optional - could be expensive for large datasets)
      const totalCount = await prisma.token.count(
        where ? { where: queryParams.where } : undefined
      )

      // Create pagination response
      const paginationResult = createCursorPagination(
        tokens,
        first,
        after ? decodeCursor(after) : undefined
      )

      return {
        ...paginationResult,
        totalCount,
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

          // Query all pairs at once with token data to reduce roundtrips
          const pairs = await prisma.pair.findMany({
            take: first * 2, // Get more than needed for efficient sorting
            ...paginationFilter,
            include: {
              token0: true,
              token1: true,
            },
          })

          // Get all pair IDs
          const pairIds = pairs.map((pair) => pair.id)

          // NEW: Try to get reserveUSD values from Redis cache first
          const cachedValues = await getCachedPairReserveUSDBulk(pairIds)

          // Process all pairs and add reserveUSD
          const pairsWithReserves = await Promise.all(
            pairs.map(async (pair) => {
              // 1. Check if we have a cached value
              if (cachedValues[pair.id]) {
                return {
                  ...pair,
                  reserveUSD: cachedValues[pair.id],
                  tvl: parseFloat(cachedValues[pair.id]),
                }
              }

              // 2. If not in cache, try to get from snapshot
              try {
                const snapshot = await prisma.pairReserveSnapshot.findFirst({
                  where: { pairId: pair.id },
                  orderBy: { timestamp: 'desc' },
                })

                if (snapshot) {
                  return {
                    ...pair,
                    reserveUSD: snapshot.reserveUSD,
                    tvl: parseFloat(snapshot.reserveUSD),
                  }
                }
              } catch (error) {
                console.error(`Error fetching snapshot for pair ${pair.id}:`, error)
              }

              // 3. If no snapshot exists, calculate on-demand (fallback)
              try {
                const reserveUSD = await calculateReservesUSD(pair, prisma)
                return {
                  ...pair,
                  reserveUSD,
                  tvl: parseFloat(reserveUSD),
                }
              } catch (error) {
                console.error(`Error calculating reserveUSD for pair ${pair.id}:`, error)
                return {
                  ...pair,
                  reserveUSD: '0',
                  tvl: 0,
                }
              }
            })
          )

          // Sort by reserveUSD
          pairsWithReserves.sort((a, b) => {
            const valA = a.tvl
            const valB = b.tvl
            return orderDirection === 'asc' ? valA - valB : valB - valA
          })

          // Apply pagination and take correct number of results
          const page = pairsWithReserves.slice(0, first + 1)

          // Get total count
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
  },

  Pair: {
    token0: async (parent: any, _: any, { loaders }: Context) => {
      return loaders.tokenLoader.load(parent.token0Id)
    },
    token1: async (parent: any, _: any, { loaders }: Context) => {
      return loaders.tokenLoader.load(parent.token1Id)
    },
    reserveUSD: async (parent: any, _: any, { loaders, prisma }: Context) => {
      // If we already have the calculated value from a previous step, use it
      if (parent.reserveUSD) return parent.reserveUSD

      // 1. Try to get from Redis cache first (fastest path)
      try {
        const cachedValue = await getCachedPairReserveUSD(parent.id)
        if (cachedValue) {
          return cachedValue
        }
      } catch (error) {
        console.error(`Error fetching cached reserveUSD for pair ${parent.id}:`, error)
        // Continue to other methods if cache fails
      }

      // 2. Try to get from the latest snapshot (second fastest)
      try {
        const snapshot = await prisma.pairReserveSnapshot.findFirst({
          where: { pairId: parent.id },
          orderBy: { timestamp: 'desc' },
        })

        if (snapshot) {
          return snapshot.reserveUSD
        }
      } catch (error) {
        console.error(`Error fetching snapshot for pair ${parent.id}:`, error)
        // Continue to other methods if snapshot fetch fails
      }

      // 3. If no snapshot exists, calculate on-demand (fallback - slowest)
      try {
        return calculateReservesUSD(parent, prisma)
      } catch (error) {
        console.error(`Error calculating reserveUSD for pair ${parent.id}:`, error)
        return '0'
      }
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
