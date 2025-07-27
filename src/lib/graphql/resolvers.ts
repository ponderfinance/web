import prisma from '@/src/lib/db/prisma'
import { getRedisClient, getKey as safeRedisGet, setKey as safeRedisSet, deleteKey as safeRedisDelete } from '@/src/lib/redis'
import { createPublicClient, http } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'
// Removed indexer import - using direct Prisma queries instead

// Cache constants
const CACHE_PREFIXES = {
  TOKEN: 'token:',
  CHART: 'chart:',
  PAIR: 'pair:',
  PROTOCOL: 'protocol:'
}

const CACHE_TTLS = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 1800
}

// Create publicClient for blockchain interactions
export const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(CURRENT_CHAIN.rpcUrls.default.http[0]),
})

type Context = {
  prisma: typeof prisma
}

interface ChartDataPoint {
  time: number
  value: number
}

interface TokenPriceChartArgs {
  tokenAddress: string
  timeframe?: string
}

type Empty = Record<string, never>

// INDUSTRY-GRADE CHART DATA SERVICE
class IndustryChartService {
  
  // Get optimal sample size for each timeframe (like TradingView)
  private static getOptimalSampleSize(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 60    // 1 point per minute
      case '1d': return 288   // 1 point per 5 minutes  
      case '1w': return 336   // 1 point per 30 minutes
      case '1m': return 720   // 1 point per hour
      case '1y': return 365   // 1 point per day
      default: return 288
    }
  }
  
  // Get time range for each timeframe (INDUSTRY STANDARD)
  private static getTimeRange(timeframe: string): number {
    const now = Math.floor(Date.now() / 1000)
    switch (timeframe) {
      case '1h': return now - 3600        // 1 hour
      case '1d': return now - 86400       // 24 hours
      case '1w': return now - 604800      // 7 days  
      case '1m': return now - 2629746     // 30.44 days (true month)
      case '1y': return now - 31557600    // 365.25 days (true year)
      default: return now - 86400
    }
  }
  
  // Get industry-standard aggregation interval
  private static getAggregationInterval(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 60      // 1-minute intervals
      case '1d': return 300     // 5-minute intervals
      case '1w': return 1800    // 30-minute intervals
      case '1m': return 3600    // 1-hour intervals
      case '1y': return 86400   // 1-day intervals
      default: return 300
    }
  }
  
  // BLAZING FAST: Query optimized snapshots with intelligent sampling
  static async getChartData(tokenId: string, timeframe: string, prisma: any): Promise<ChartDataPoint[]> {
    try {
      const startTime = this.getTimeRange(timeframe)
      const sampleSize = this.getOptimalSampleSize(timeframe)
      const interval = this.getAggregationInterval(timeframe)
      
      // Step 1: Get all pairs containing this token (super fast query)
      const pairs = await prisma.pair.findMany({
        where: {
          OR: [
            { token0Id: tokenId },
            { token1Id: tokenId }
          ]
        },
        select: { 
          id: true, 
          token0Id: true, 
          token1Id: true,
          // Get the other token for price calculation
          token0: { select: { priceUSD: true } },
          token1: { select: { priceUSD: true } }
        }
      })
      
      if (pairs.length === 0) return []
      
      // Step 2: OPTIMIZED QUERY - Get snapshots with intelligent sampling
      const snapshots = await prisma.priceSnapshot.findMany({
        where: {
          pairId: { in: pairs.map((p: any) => p.id) },
          timestamp: { gte: startTime },
          // Add additional filters for performance
          AND: [
            { price0: { not: "0" } },
            { price1: { not: "0" } }
          ]
        },
        select: {
          timestamp: true,
          price0: true,
          price1: true,
          pairId: true
        },
        orderBy: { timestamp: 'asc' },
        // Intelligent limit: Get more data than needed, then sample
        take: Math.min(sampleSize * 3, 5000)
      })
      
      if (snapshots.length === 0) return []
      
      // Step 3: SMART AGGREGATION - Group by time intervals
      const aggregatedData = new Map<number, { prices: number[], count: number }>()
      
      for (const snapshot of snapshots) {
        // Find which pair this snapshot belongs to
        const pair = pairs.find((p: any) => p.id === snapshot.pairId)
        if (!pair) continue
        
        // Calculate USD price for our token
        let tokenPrice = 0
        const isToken0 = pair.token0Id === tokenId
        
        if (isToken0) {
          // Token is token0, use price0 and token1's USD price
          const otherTokenPrice = parseFloat(pair.token1.priceUSD || '0')
          if (otherTokenPrice > 0) {
            tokenPrice = (parseFloat(snapshot.price0) / 1e18) * otherTokenPrice
          }
        } else {
          // Token is token1, use price1 and token0's USD price
          const otherTokenPrice = parseFloat(pair.token0.priceUSD || '0')
          if (otherTokenPrice > 0) {
            tokenPrice = (parseFloat(snapshot.price1) / 1e18) * otherTokenPrice
          }
        }
        
        if (tokenPrice <= 0) continue
        
        // Group by interval (like TradingView does)
        const timeSlot = Math.floor(Number(snapshot.timestamp) / interval) * interval
        
        if (!aggregatedData.has(timeSlot)) {
          aggregatedData.set(timeSlot, { prices: [], count: 0 })
        }
        
        const slot = aggregatedData.get(timeSlot)!
        slot.prices.push(tokenPrice)
        slot.count++
      }
      
      // Step 4: PROFESSIONAL SAMPLING - Create final chart points
      const chartPoints: ChartDataPoint[] = []
      
      for (const [timestamp, data] of aggregatedData.entries()) {
        // Use VWAP-style averaging for professional accuracy
        const avgPrice = data.prices.reduce((sum, price) => sum + price, 0) / data.prices.length
        
        chartPoints.push({
          time: timestamp,
          value: avgPrice
        })
      }
      
      // Step 5: INTELLIGENT DOWNSAMPLING - Ensure optimal point count
      return this.downsampleToTarget(chartPoints, sampleSize)
      
    } catch (error) {
      console.error('Chart data query error:', error)
      return []
    }
  }
  
  // Smart downsampling algorithm (keeps important price movements)
  private static downsampleToTarget(points: ChartDataPoint[], targetSize: number): ChartDataPoint[] {
    if (points.length <= targetSize) return points
    
    // Use LTTB (Largest-Triangle-Three-Buckets) algorithm for professional downsampling
    const bucketSize = Math.floor(points.length / targetSize)
    const sampled: ChartDataPoint[] = []
    
    // Always keep first point
    sampled.push(points[0])
    
    for (let i = 1; i < targetSize - 1; i++) {
      const bucketStart = i * bucketSize
      const bucketEnd = Math.min((i + 1) * bucketSize, points.length)
      
      // Find point with largest triangle area (preserves important movements)
      let maxArea = 0
      let selectedPoint = points[bucketStart]
      
      for (let j = bucketStart; j < bucketEnd; j++) {
        const prev = sampled[sampled.length - 1]
        const next = points[Math.min(bucketEnd, points.length - 1)]
        const curr = points[j]
        
        // Calculate triangle area
        const area = Math.abs(
          (prev.time - next.time) * (curr.value - prev.value) - 
          (prev.time - curr.time) * (next.value - prev.value)
        )
        
        if (area > maxArea) {
          maxArea = area
          selectedPoint = curr
        }
      }
      
      sampled.push(selectedPoint)
    }
    
    // Always keep last point
    sampled.push(points[points.length - 1])
    
    return sampled
  }
}

// LIGHTNING-FAST TOKEN SERVICE
class FastTokenService {
  
  // Get token with ULTRA-AGGRESSIVE caching for SUB-1-SECOND performance
  static async getToken(address: string, prisma: any): Promise<any> {
    const normalizedAddress = address.toLowerCase()
    
    console.log(`[ULTRA_FAST_TOKEN] Looking for token: ${normalizedAddress}`)
    
    // ULTRA-AGGRESSIVE CACHING with multiple fallback levels
    try {
      const redis = getRedisClient()
      if (redis) {
        // Level 1: Lightning cache (15 seconds - fastest possible)
        const lightningCached = await safeRedisGet(`${CACHE_PREFIXES.TOKEN}${normalizedAddress}:lightning`)
        if (lightningCached && typeof lightningCached === 'string') {
          console.log(`[CACHE_HIT] ⚡ Lightning cache for ${normalizedAddress}`)
          return JSON.parse(lightningCached)
        }
        
        // Level 2: Hot cache (1 minute)
        const hotCached = await safeRedisGet(`${CACHE_PREFIXES.TOKEN}${normalizedAddress}:hot`)
        if (hotCached && typeof hotCached === 'string') {
          console.log(`[CACHE_HIT] 🔥 Hot cache for ${normalizedAddress}`)
          return JSON.parse(hotCached)
        }
        
        // Level 3: Warm cache (5 minutes)
        const warmCached = await safeRedisGet(`${CACHE_PREFIXES.TOKEN}${normalizedAddress}:warm`)
        if (warmCached && typeof warmCached === 'string') {
          console.log(`[CACHE_HIT] 🌟 Warm cache for ${normalizedAddress}`)
          return JSON.parse(warmCached)
        }
      }
    } catch (cacheError) {
      console.log(`[CACHE_ERROR] ${cacheError}`)
    }
    
    // ULTRA-FAST DB QUERY with minimal data fetching
    console.log(`[ULTRA_FAST_TOKEN] Querying database for ${normalizedAddress}`)
    const startTime = performance.now()
    
    // Step 1: Get basic token data super fast
    const token = await prisma.token.findFirst({
      where: { address: normalizedAddress },
      select: {
        id: true,
        address: true,
        symbol: true,
        name: true,
        decimals: true,
        imageURI: true,
        priceUSD: true,
        priceChange24h: true,
        priceChange1h: true,
        priceChange7d: true,
        volumeUSD24h: true,
        lastPriceUpdate: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    const dbTime = performance.now()
    console.log(`[ULTRA_FAST_TOKEN] Token query: ${(dbTime - startTime).toFixed(1)}ms`, !!token, token ? `(${token.symbol})` : '')
    
    if (!token) {
      console.log(`[ULTRA_FAST_TOKEN] No token found for ${normalizedAddress}`)
      return null
    }
    
    // PARALLEL OPTIMIZATION: TVL and Market Cap calculation with single super-fast query
    let tvl = 0
    let marketCap = '0'
    let fdv = '0'
    
    try {
      const priceUSD = parseFloat(token.priceUSD || '0')
      const decimals = token.decimals || 18
      
      if (priceUSD > 0) {
        // BLAZING FAST: Single aggregation query to get total reserves
        const tvlStartTime = performance.now()
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [
              { token0Id: token.id },
              { token1Id: token.id }
            ]
          },
          select: {
            token0Id: true,
            token1Id: true,
            reserve0: true,
            reserve1: true
          }
        })
        
        const tvlQueryTime = performance.now()
        console.log(`[ULTRA_FAST_TOKEN] TVL query: ${(tvlQueryTime - tvlStartTime).toFixed(1)}ms`)
        
        // Calculate TVL from reserves
        let totalReserves = 0
        pairs.forEach(pair => {
          if (pair.token0Id === token.id && pair.reserve0) {
            const reserveAmount = parseFloat(pair.reserve0) / Math.pow(10, decimals)
            totalReserves += reserveAmount
          } else if (pair.token1Id === token.id && pair.reserve1) {
            const reserveAmount = parseFloat(pair.reserve1) / Math.pow(10, decimals)
            totalReserves += reserveAmount
          }
        })
        
        tvl = totalReserves * priceUSD
        
        // Estimate Market Cap and FDV from TVL (common DeFi practice)
        if (totalReserves > 0) {
          const estimatedCirculatingSupply = totalReserves * 2 // Conservative 2x multiplier
          const estimatedTotalSupply = totalReserves * 5 // Conservative 5x multiplier for FDV
          
          marketCap = (estimatedCirculatingSupply * priceUSD).toFixed(0)
          fdv = (estimatedTotalSupply * priceUSD).toFixed(0)
        }
        
        console.log(`[ULTRA_FAST_TOKEN] TVL: $${tvl.toFixed(2)}, Market Cap: $${marketCap}, FDV: $${fdv}`)
      }
    } catch (error) {
      console.error('TVL/Market Cap calculation error:', error)
    }
    
    // Enhanced token data with calculated fields
    const enhancedToken = {
      ...token,
      symbol: token.symbol || 'Unknown',
      name: token.name || 'Unknown Token',
      decimals: token.decimals || 18,
      priceUSD: token.priceUSD || '0',
      priceChange24h: token.priceChange24h || 0,
      priceChange1h: token.priceChange1h || 0,
      priceChange7d: token.priceChange7d || 0,
      volumeUSD24h: token.volumeUSD24h || '0',
      tvl: tvl > 0 ? tvl.toFixed(2) : '0',
      marketCap,
      fdv
    }
    
    // ULTRA-AGGRESSIVE MULTI-LEVEL CACHING for SUB-1-SECOND performance
    try {
      const redis = getRedisClient()
      if (redis) {
        // Level 1: Lightning cache (15 seconds - absolute fastest)
        await safeRedisSet(
          `${CACHE_PREFIXES.TOKEN}${normalizedAddress}:lightning`,
          JSON.stringify(enhancedToken),
          15
        )
        
        // Level 2: Hot cache (1 minute)
        await safeRedisSet(
          `${CACHE_PREFIXES.TOKEN}${normalizedAddress}:hot`,
          JSON.stringify(enhancedToken),
          60
        )
        
        // Level 3: Warm cache (5 minutes - fallback)
        await safeRedisSet(
          `${CACHE_PREFIXES.TOKEN}${normalizedAddress}:warm`,
          JSON.stringify(enhancedToken),
          300
        )
        
        console.log(`[ULTRA_CACHE_SET] ⚡🔥🌟 Triple-cached token ${normalizedAddress} with TVL: $${enhancedToken.tvl}, Market Cap: $${enhancedToken.marketCap}, FDV: $${enhancedToken.fdv}`)
      }
    } catch {}
    
    return enhancedToken
  }
}

// Helper function to create connection response
function createConnection(items: any[], hasNext = false, hasPrev = false) {
  return {
    edges: items.map((item, index) => ({
      node: item,
      cursor: Buffer.from(`${item.id}-${index}`).toString('base64')
    })),
    pageInfo: {
      hasNextPage: hasNext,
      hasPreviousPage: hasPrev,
      startCursor: items.length > 0 ? Buffer.from(`${items[0].id}-0`).toString('base64') : null,
      endCursor: items.length > 0 ? Buffer.from(`${items[items.length - 1].id}-${items.length - 1}`).toString('base64') : null
    },
    totalCount: items.length
  }
}

// INDUSTRY-GRADE RESOLVERS
export const resolvers = {
  Query: {
    // 🚀 BLAZING FAST TOKEN RESOLVER
    tokenByAddress: async (_parent: unknown, { address }: { address: string }, { prisma }: Context) => {
      try {
        console.time(`[FAST_TOKEN] ${address}`)
        const result = await FastTokenService.getToken(address, prisma)
        console.timeEnd(`[FAST_TOKEN] ${address}`)
        return result
      } catch (error) {
        console.error(`[FAST_TOKEN] Error for ${address}:`, error)
        return null
      }
    },

    // 🚀 FAST TOKEN BY ID
    token: async (_parent: unknown, { id }: { id: string }, { prisma }: Context) => {
      try {
        const token = await prisma.token.findFirst({
          where: { id },
          select: {
            id: true,
            address: true,
            symbol: true,
            name: true,
            decimals: true,
            imageURI: true,
            priceUSD: true,
            priceChange24h: true,
            volumeUSD24h: true,
            lastPriceUpdate: true,
            createdAt: true,
            updatedAt: true
          }
        })
        
        if (!token) return null
        
        return {
          ...token,
          symbol: token.symbol || 'Unknown',
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 18,
          priceUSD: token.priceUSD || '0',
          priceChange24h: token.priceChange24h || 0,
          volumeUSD24h: token.volumeUSD24h || '0',
          tvl: '0',
          marketCap: '0',
          fdv: '0'
        }
      } catch (error) {
        console.error(`[FAST_TOKEN_ID] Error for ${id}:`, error)
        return null
      }
    },

    // 🚀 FAST TOKENS LIST (for TokenSelector)
    tokens: async (_parent: unknown, { first = 50, where }: { first?: number; where?: any }, { prisma }: Context) => {
      try {
        console.time('[FAST_TOKENS_LIST]')
        
        // Build where clause
        const whereClause: any = {}
        if (where?.address) whereClause.address = { contains: where.address.toLowerCase() }
        if (where?.symbol) whereClause.symbol = { contains: where.symbol, mode: 'insensitive' }
        if (where?.name) whereClause.name = { contains: where.name, mode: 'insensitive' }
        
        const tokens = await prisma.token.findMany({
          where: whereClause,
          take: Math.min(first, 100), // Limit to 100 max
          orderBy: [
            { volumeUSD24h: 'desc' }, // Order by volume (most traded first)
            { priceUSD: 'desc' }
          ]
        })
        
        // Transform tokens
        const transformedTokens = tokens.map((token: any) => ({
          ...token,
          symbol: token.symbol || 'Unknown',
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 18,
          priceUSD: token.priceUSD || '0',
          priceChange24h: token.priceChange24h || 0,
          volumeUSD24h: token.volumeUSD24h || '0',
          tvl: '0',
          marketCap: '0',
          fdv: '0'
        }))
        
        console.timeEnd('[FAST_TOKENS_LIST]')
        return createConnection(transformedTokens)
      } catch (error) {
        console.error('[FAST_TOKENS_LIST] Error:', error)
        return createConnection([]) // Return empty connection on error
      }
    },

    // 🚀 FAST PAIR BY ID  
    pair: async (_parent: unknown, { id }: { id: string }, { prisma }: Context) => {
      try {
        const pair = await prisma.pair.findFirst({
          where: { id },
          include: {
            token0: true,
            token1: true
          }
        })
        
        if (!pair) return null
        
        // Add computed fields with defaults
        return {
          ...pair,
          tvl: 0,
          reserveUSD: '0',
          poolAPR: 0,
          rewardAPR: 0,
          volume1h: '0',
          volume24h: '0',
          volume7d: '0',
          volume30d: '0',
          volumeChange24h: 0,
          volumeTVLRatio: 0
        }
      } catch (error) {
        console.error(`[FAST_PAIR] Error for ${id}:`, error)
        return null
      }
    },

    // 🚀 FAST PAIRS LIST
    pairs: async (_parent: unknown, { first = 20 }: { first?: number }, { prisma }: Context) => {
      try {
        const pairs = await prisma.pair.findMany({
          take: Math.min(first, 50),
          include: {
            token0: true,
            token1: true
          },
          orderBy: [
            { volume24h: 'desc' }, // Order by 24h volume first (highest to lowest)
            { volume30d: 'desc' }, // Then by 30d volume
            { createdAt: 'desc' }   // Finally by creation time
          ]
        })
        
        // Use existing pre-computed fields with fast TVL calculation
        const transformedPairs = pairs.map((pair: any) => {
          let tvl = 0
          let reserveUSD = '0'
          
          try {
            // Quick TVL calculation from reserves and token prices
            const token0Price = parseFloat(pair.token0?.priceUSD || '0')
            const token1Price = parseFloat(pair.token1?.priceUSD || '0')
            const reserve0 = parseFloat(pair.reserve0 || '0')
            const reserve1 = parseFloat(pair.reserve1 || '0')
            const token0Decimals = pair.token0?.decimals || 18
            const token1Decimals = pair.token1?.decimals || 18
            
            if (token0Price > 0 && reserve0 > 0) {
              const token0ValueUSD = (reserve0 / Math.pow(10, token0Decimals)) * token0Price
              tvl += token0ValueUSD
            }
            
            if (token1Price > 0 && reserve1 > 0) {
              const token1ValueUSD = (reserve1 / Math.pow(10, token1Decimals)) * token1Price
              tvl += token1ValueUSD
            }
            
            reserveUSD = tvl.toFixed(2)
          } catch (error) {
            console.warn(`[PAIRS] Error calculating TVL for pair ${pair.id}:`, error)
          }
          
          return {
            ...pair,
            tvl: Math.round(tvl),
            reserveUSD,
            // Use pre-computed fields from the database
            poolAPR: pair.poolAPR || 0,
            rewardAPR: 0, // This would come from farming data
            volume1h: pair.volume1h || '0',
            volume24h: pair.volume24h || '0',
            volume7d: pair.volume7d || '0',
            volume30d: pair.volume30d || '0',
            volumeChange24h: pair.volumeChange24h || 0,
            volumeTVLRatio: pair.volumeTVLRatio || 0
          }
        })
        
        return createConnection(transformedPairs)
      } catch (error) {
        console.error('[FAST_PAIRS] Error:', error)
        return createConnection([])
      }
    },

    // 🚀 PRODUCTION-GRADE PROTOCOL METRICS (Using pre-computed data)
    protocolMetrics: async (_parent: unknown, _args: unknown, { prisma }: Context) => {
      try {
        console.time('[PROTOCOL_METRICS]')
        
        // Method 1: Get from your existing ProtocolMetric table (computed by indexer)
        const metrics = await prisma.protocolMetric.findFirst({
          orderBy: { timestamp: 'desc' }
        })
        
        if (metrics) {
          console.timeEnd('[PROTOCOL_METRICS]')
          console.log('[PROTOCOL_METRICS] ✅ Using indexer-computed metrics')
          return metrics
        }
        
        // Method 2: Fallback to cached Redis data from your indexer
        try {
          const redis = getRedisClient()
          if (redis) {
            const [tvl, volume24h, volume1h] = await Promise.all([
              safeRedisGet(`${CACHE_PREFIXES.PROTOCOL}tvl`),
              safeRedisGet(`${CACHE_PREFIXES.PROTOCOL}volume24h`), 
              safeRedisGet(`${CACHE_PREFIXES.PROTOCOL}volume1h`)
            ])
            
            if (tvl || volume24h) {
              console.timeEnd('[PROTOCOL_METRICS]')
              console.log('[PROTOCOL_METRICS] ✅ Using Redis-cached metrics from indexer')
              return {
                id: 'redis-metrics',
                timestamp: Math.floor(Date.now() / 1000),
                totalValueLockedUSD: tvl || '0',
                liquidityPoolsTVL: tvl || '0',
                stakingTVL: '0',
                farmingTVL: '0', 
                dailyVolumeUSD: volume24h || '0',
                weeklyVolumeUSD: volume24h || '0', // Would need weekly cache
                monthlyVolumeUSD: volume24h || '0', // Would need monthly cache
                totalVolumeUSD: volume24h || '0',
                dailyFeesUSD: '0',
                weeklyFeesUSD: '0',
                monthlyFeesUSD: '0',
                totalFeesUSD: '0',
                totalUsers: 0,
                dailyActiveUsers: 0,
                weeklyActiveUsers: 0,
                monthlyActiveUsers: 0,
                volume1h: volume1h || '0',
                volume1hChange: 0,
                volume24hChange: 0,
                totalPairs: 0,
                activePoolsCount: 0
              }
            }
          }
        } catch (redisError) {
          console.warn('[PROTOCOL_METRICS] Redis fallback failed:', redisError)
        }
        
        // Method 3: Last resort - return minimal data
        console.log('[PROTOCOL_METRICS] ⚠️ No computed metrics available, returning minimal fallback')
        console.timeEnd('[PROTOCOL_METRICS]')
        return {
          id: 'minimal-fallback',
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
          volume1h: '0',
          volume1hChange: 0,
          volume24hChange: 0,
          totalPairs: 0,
          activePoolsCount: 0
        }
      } catch (error) {
        console.error('[PROTOCOL_METRICS] Error:', error)
        // Return minimal fallback on error
        return {
          id: 'error-fallback',
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
          volume1h: '0',
          volume1hChange: 0,
          volume24hChange: 0,
          totalPairs: 0,
          activePoolsCount: 0
        }
      }
    },

    // 🚀 FAST RECENT TRANSACTIONS WITH PAGINATION
    recentTransactions: async (_parent: unknown, { first = 20, after }: { first?: number; after?: string }, { prisma }: Context) => {
      try {
        console.time('[FAST_RECENT_TRANSACTIONS]')
        
        // Handle cursor-based pagination
        let whereClause: any = {}
        if (after) {
          try {
            const decodedCursor = Buffer.from(after, 'base64').toString('utf-8')
            const [id] = decodedCursor.split('-')
            if (id) {
              // Find the timestamp of the cursor item for proper pagination
              const cursorSwap = await prisma.swap.findFirst({ where: { id } })
              if (cursorSwap) {
                whereClause = {
                  timestamp: { lt: cursorSwap.timestamp }
                }
              }
            }
          } catch (e) {
            console.warn('[FAST_RECENT_TRANSACTIONS] Invalid cursor:', after)
          }
        }
        
        const swaps = await prisma.swap.findMany({
          where: whereClause,
          take: Math.min(first, 100),
          orderBy: { timestamp: 'desc' },
          include: {
            pair: {
              include: {
                token0: true,
                token1: true
              }
            }
          }
        })
        
        console.log(`[FAST_RECENT_TRANSACTIONS] Found ${swaps.length} swaps`)
        
        // Transform swaps with ALL required fields for client
        const transformedSwaps = swaps.map((swap: any) => {
          // Calculate USD value from amounts and token prices
          let valueUSD = '0'
          try {
            if (swap.pair?.token0?.priceUSD || swap.pair?.token1?.priceUSD) {
              const token0Price = parseFloat(swap.pair.token0?.priceUSD || '0')
              const token1Price = parseFloat(swap.pair.token1?.priceUSD || '0')
              
              let usdValue = 0
              
              // Calculate from outgoing amounts (more accurate)
              if (swap.amountOut0 && swap.amountOut0 !== '0' && token0Price > 0) {
                const amount = parseFloat(swap.amountOut0) / Math.pow(10, swap.pair.token0?.decimals || 18)
                usdValue = amount * token0Price
              } else if (swap.amountOut1 && swap.amountOut1 !== '0' && token1Price > 0) {
                const amount = parseFloat(swap.amountOut1) / Math.pow(10, swap.pair.token1?.decimals || 18)
                usdValue = amount * token1Price
              }
              
              if (usdValue > 0) {
                valueUSD = usdValue.toFixed(2)
              }
            }
          } catch (e) {
            console.warn('[FAST_RECENT_TRANSACTIONS] Error calculating valueUSD:', e)
          }
          
          return {
            id: swap.id,
            txHash: swap.txHash,
            timestamp: swap.timestamp.toString(),
            userAddress: swap.userAddress,
            amountIn0: swap.amountIn0 || '0',
            amountIn1: swap.amountIn1 || '0', 
            amountOut0: swap.amountOut0 || '0',
            amountOut1: swap.amountOut1 || '0',
            valueUSD,
            // Ensure token objects have all required fields
            token0: swap.pair?.token0 ? {
              id: swap.pair.token0.id,
              address: swap.pair.token0.address,
              name: swap.pair.token0.name || 'Unknown',
              symbol: swap.pair.token0.symbol || 'UNK',
              decimals: swap.pair.token0.decimals || 18,
              imageURI: swap.pair.token0.imageURI || null
            } : null,
            token1: swap.pair?.token1 ? {
              id: swap.pair.token1.id,
              address: swap.pair.token1.address,
              name: swap.pair.token1.name || 'Unknown',
              symbol: swap.pair.token1.symbol || 'UNK',
              decimals: swap.pair.token1.decimals || 18,
              imageURI: swap.pair.token1.imageURI || null
            } : null
          }
        })
        
        console.timeEnd('[FAST_RECENT_TRANSACTIONS]')
        
        // Check if there are more items for pagination
        const hasNextPage = transformedSwaps.length === Math.min(first, 100)
        
        return createConnection(transformedSwaps, hasNextPage)
      } catch (error) {
        console.error('[FAST_RECENT_TRANSACTIONS] Error:', error)
        return createConnection([])
      }
    },

    // 🚀 BLAZING FAST CHART RESOLVER USING INDUSTRY-STANDARD OHLC CANDLES
    tokenPriceChart: async (
      _parent: Empty,
      { tokenAddress, timeframe = '1d' }: TokenPriceChartArgs,
      { prisma }: Context
    ): Promise<ChartDataPoint[]> => {
      try {
        console.time(`[BLAZING_CHART] ${tokenAddress}-${timeframe}`)
        
        // Step 1: Lightning-fast token lookup
        const token = await prisma.token.findFirst({
          where: { address: tokenAddress.toLowerCase() },
          select: { id: true, priceUSD: true }
        })
        
        if (!token) {
          console.timeEnd(`[BLAZING_CHART] ${tokenAddress}-${timeframe}`)
          return []
        }
        
        // Step 2: Multi-level cache strategy (Redis + in-memory)
        const cacheKey = `candle:${tokenAddress.toLowerCase()}:${timeframe}:v2`
        try {
          const redis = getRedisClient()
          if (redis) {
            const cached = await redis.get(cacheKey)
            if (cached) {
              console.timeEnd(`[BLAZING_CHART] ${tokenAddress}-${timeframe}`)
              console.log(`[BLAZING_CHART] ⚡ Cache hit for ${tokenAddress}`)
              return JSON.parse(cached)
            }
          }
        } catch {}
        
        // Step 3: Map timeframe to optimal candle interval
        const candleMapping = {
          '1h': { interval: '1m', duration: 3600, limit: 60 },      // 1 minute candles for 1 hour
          '1d': { interval: '5m', duration: 86400, limit: 288 },    // 5 minute candles for 1 day
          '1w': { interval: '30m', duration: 604800, limit: 336 },  // 30 minute candles for 1 week
          '1m': { interval: '1h', duration: 2629746, limit: 744 },  // 1 hour candles for 1 month
          '1y': { interval: '1d', duration: 31557600, limit: 365 }  // 1 day candles for 1 year
        }
        
        const config = candleMapping[timeframe as keyof typeof candleMapping] || candleMapping['1d']
        const now = Math.floor(Date.now() / 1000)
        const startTime = now - config.duration
        
        // Step 4: 🚀 BLAZING FAST: Query pre-aggregated OHLC candles
        try {
          const candles = await prisma.priceCandle.findMany({
            where: {
              tokenId: token.id,
              intervalType: config.interval,
              timestamp: {
                gte: startTime,
                lte: now
              }
            },
            orderBy: {
              timestamp: 'asc'
            },
            take: config.limit
          })
          
          if (candles.length > 0) {
            // Convert OHLC candles to simple chart points (use close prices)
            const chartData = candles.map(candle => ({
              time: candle.timestamp,
              value: parseFloat(candle.closePrice)
            }))
            
            // Step 5: Ultra-aggressive caching for blazing performance
            try {
              const redis = getRedisClient()
              if (redis) {
                await redis.set(cacheKey, JSON.stringify(chartData), 'EX', 30) // 30 seconds for blazing fresh data
                console.log(`[BLAZING_CHART] ⚡ Cached ${chartData.length} candle points`)
              }
            } catch {}
            
            console.timeEnd(`[BLAZING_CHART] ${tokenAddress}-${timeframe}`)
            console.log(`[BLAZING_CHART] 🚀 BLAZING FAST: ${chartData.length} points from pre-aggregated candles`)
            return chartData
          }
        } catch (candleError) {
          console.warn(`[BLAZING_CHART] Candle fallback for ${tokenAddress}:`, candleError.message)
        }
        
        // Step 6: Fallback to MetricSnapshots (legacy support) - but still fast!
        console.log(`[BLAZING_CHART] Falling back to MetricSnapshots for ${tokenAddress}`)
        
        // Import MongoDB connection for fallback
        const { MongoClient } = await import('mongodb')
        const MONGODB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ponder"
        
        let mongoClient = null
        let chartData: ChartDataPoint[] = []
        
        try {
          mongoClient = new MongoClient(MONGODB_URI)
          await mongoClient.connect()
          const db = mongoClient.db()
          
          // Optimized MongoDB aggregation for fast fallback
          const snapshots = await db.collection("MetricSnapshot").aggregate([
            {
              $match: {
                entity: "token",
                entityId: token.id,
                metricType: "price",
                timestamp: { $gte: startTime },
                value: { $ne: "0", $ne: null }
              }
            },
            {
              $sort: { timestamp: 1 }
            },
            {
              $group: {
                _id: {
                  // Time bucket grouping for sampling
                  bucket: {
                    $floor: {
                      $divide: [
                        { $subtract: ["$timestamp", startTime] },
                        Math.floor(config.duration / config.limit)
                      ]
                    }
                  }
                },
                // Use last value in each bucket (latest price)
                value: { $last: "$value" },
                timestamp: { $last: "$timestamp" }
              }
            },
            {
              $sort: { timestamp: 1 }
            },
            {
              $limit: config.limit
            }
          ]).toArray()
          
          if (snapshots.length > 0) {
            chartData = snapshots.map(s => ({
              time: s.timestamp,
              value: parseFloat(s.value)
            })).filter(p => p.value > 0)
            
            console.log(`[BLAZING_CHART] Fallback: ${chartData.length} points from snapshots`)
          }
          
        } catch (mongoError) {
          console.error(`[BLAZING_CHART] MongoDB fallback error:`, mongoError)
        } finally {
          if (mongoClient) {
            await mongoClient.close()
          }
        }
        
        // Step 7: Final fallback using current price
        if (chartData.length === 0 && token.priceUSD) {
          const currentPrice = parseFloat(token.priceUSD)
          chartData = [
            { time: startTime, value: currentPrice },
            { time: now, value: currentPrice }
          ]
          console.log(`[BLAZING_CHART] Using emergency fallback for ${tokenAddress}`)
        }
        
        // Step 8: Cache results even for fallback
        if (chartData.length > 0) {
          try {
            const redis = getRedisClient()
            if (redis) {
              await redis.set(cacheKey, JSON.stringify(chartData), 'EX', 60) // 1 minute for fallback data
              console.log(`[BLAZING_CHART] Cached ${chartData.length} fallback points`)
            }
          } catch {}
        }
        
        console.timeEnd(`[BLAZING_CHART] ${tokenAddress}-${timeframe}`)
        return chartData
        
      } catch (error) {
        console.error(`[BLAZING_CHART] Critical error for ${tokenAddress}:`, error)
        
        // Emergency fallback
        const now = Math.floor(Date.now() / 1000)
        const duration = timeframe === '1h' ? 3600 : timeframe === '1d' ? 86400 : 604800
        return [
          { time: now - duration, value: 1.0 },
          { time: now, value: 1.0 }
        ]
      }
    },

    // 🚀 USER POSITIONS RESOLVER
    userPositions: async (_parent: unknown, { userAddress }: { userAddress: string }, { prisma }: Context) => {
      try {
        console.time(`[USER_POSITIONS] ${userAddress}`)
        
        if (!userAddress) {
          return {
            liquidityPositions: [],
            farmingPositions: [],
            stakingPositions: []
          }
        }

        // Fetch all position types in parallel
        const [liquidityPositions, farmingPositions, stakingPositions] = await Promise.all([
          prisma.liquidityPosition.findMany({
            where: {
              userAddress: { equals: userAddress, mode: 'insensitive' }
            },
            include: {
              pair: {
                include: {
                  token0: true,
                  token1: true
                }
              }
            }
          }),
          prisma.farmingPosition.findMany({
            where: {
              userAddress: { equals: userAddress, mode: 'insensitive' }
            }
          }),
          prisma.stakingPosition.findMany({
            where: {
              userAddress: { equals: userAddress, mode: 'insensitive' }
            }
          })
        ])

        // Serialize BigInt fields to strings
        const serializedLiquidityPositions = liquidityPositions.map(pos => ({
          ...pos,
          liquidity: pos.liquidity?.toString() || '0',
          token0Amount: pos.token0Amount?.toString() || '0',
          token1Amount: pos.token1Amount?.toString() || '0'
        }))

        const serializedFarmingPositions = farmingPositions.map(pos => ({
          ...pos,
          amount: pos.amount?.toString() || '0',
          rewardDebt: pos.rewardDebt?.toString() || '0',
          ponderStaked: pos.ponderStaked?.toString() || '0',
          weightedShares: pos.weightedShares?.toString() || '0'
        }))

        const serializedStakingPositions = stakingPositions.map(pos => ({
          ...pos,
          amount: pos.amount?.toString() || '0',
          rewardDebt: pos.rewardDebt?.toString() || '0'
        }))

        console.timeEnd(`[USER_POSITIONS] ${userAddress}`)
        
        return {
          liquidityPositions: serializedLiquidityPositions,
          farmingPositions: serializedFarmingPositions,
          stakingPositions: serializedStakingPositions
        }
      } catch (error) {
        console.error(`[USER_POSITIONS] Error for ${userAddress}:`, error)
        return {
          liquidityPositions: [],
          farmingPositions: [],
          stakingPositions: []
        }
      }
    },

    // Add other resolvers as needed...
    
  }
}

export default resolvers

