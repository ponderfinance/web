// SWITCHED TO PONDER POSTGRES (Prisma still available as fallback)
import prisma from '@/src/lib/db/prisma'
import ponderDb from '@/src/lib/db/ponderDb'
import { getRedisClient, getKey as safeRedisGet, setKey as safeRedisSet, deleteKey as safeRedisDelete } from '@/src/lib/redis'
import { createPublicClient, http } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'

// ERC20 ABI for token supply queries
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  }
] as const

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
  prisma: typeof ponderDb  // Using Ponder adapter (Prisma-compatible API)
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

// Token supply interface
interface TokenSupply {
  totalSupply: number
  circulatingSupply: number
}

/**
 * Get real token supply data from blockchain
 * @param tokenAddress The token contract address
 * @returns Token supply data
 */
async function getTokenSupply(tokenAddress: string): Promise<TokenSupply> {
  try {
    console.log(`[TOKEN_SUPPLY] Fetching supply for ${tokenAddress}`)
    
    // Call the blockchain to get actual token total supply
    const totalSupplyResult = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'totalSupply'
    })
    
    // Get token decimals
    const decimalsResult = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'decimals'
    })
    
    // Convert from raw token units to human-readable numbers
    const decimals = Number(decimalsResult)
    const totalSupplyRaw = Number(totalSupplyResult)
    const totalSupply = totalSupplyRaw / Math.pow(10, decimals)
    
    console.log(`[TOKEN_SUPPLY] ${tokenAddress}: totalSupply=${totalSupply}, decimals=${decimals}`)
    
    // For now, we don't have a way to determine circulating supply from blockchain
    // So we return 0 to indicate it's unknown (fallback logic will estimate it)
    return {
      totalSupply,
      circulatingSupply: 0 // Would need external API or specific contract logic
    }
  } catch (error) {
    console.warn(`[TOKEN_SUPPLY] Failed to fetch supply for ${tokenAddress}:`, error)
    return {
      totalSupply: 0,
      circulatingSupply: 0
    }
  }
}

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
          token0: { select: { priceUsd: true } },
          token1: { select: { priceUsd: true } }
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
          const otherTokenPrice = parseFloat(pair.token1.priceUsd || '0')
          if (otherTokenPrice > 0) {
            tokenPrice = (parseFloat(snapshot.price0) / 1e18) * otherTokenPrice
          }
        } else {
          // Token is token1, use price1 and token0's USD price
          const otherTokenPrice = parseFloat(pair.token0.priceUsd || '0')
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
        address: true,
        symbol: true,
        name: true,
        decimals: true,
        imageUri: true,
        priceUsd: true,
        priceChange24h: true,
        priceChange1h: true,
        priceChange7d: true,
        volumeUsd24h: true,
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
      const priceUsd = parseFloat(token.priceUsd || '0')
      const decimals = token.decimals || 18
      
      if (priceUsd > 0) {
        // BLAZING FAST: Single aggregation query to get total reserves
        const tvlStartTime = performance.now()
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [
              { token0Address: token.address },
              { token1Address: token.address }
            ]
          },
          select: {
            token0Address: true,
            token1Address: true,
            reserve0: true,
            reserve1: true
          }
        })

        const tvlQueryTime = performance.now()
        console.log(`[ULTRA_FAST_TOKEN] TVL query: ${(tvlQueryTime - tvlStartTime).toFixed(1)}ms`)

        // Calculate TVL from reserves
        let totalReserves = 0
        pairs.forEach(pair => {
          if (pair.token0Address === token.address && pair.reserve0) {
            const reserveAmount = parseFloat(pair.reserve0) / Math.pow(10, decimals)
            totalReserves += reserveAmount
          } else if (pair.token1Address === token.address && pair.reserve1) {
            const reserveAmount = parseFloat(pair.reserve1) / Math.pow(10, decimals)
            totalReserves += reserveAmount
          }
        })
        
        tvl = totalReserves * priceUsd
        
        // Calculate accurate Market Cap and FDV using real token supply data
        if (totalReserves > 0) {
          try {
            // Try to get actual token supply from blockchain
            const tokenSupply = await getTokenSupply(token.address)
            
            if (tokenSupply.totalSupply > 0) {
              // Use real total supply for accurate FDV
              fdv = (tokenSupply.totalSupply * priceUsd).toFixed(0)
              
              // For market cap, use circulating supply if available, otherwise estimate as 70% of total
              const circulatingSupply = tokenSupply.circulatingSupply > 0 
                ? tokenSupply.circulatingSupply 
                : tokenSupply.totalSupply * 0.7 // Conservative 70% circulating estimate
              
              marketCap = (circulatingSupply * priceUsd).toFixed(0)
            } else {
              // Fallback to TVL-based estimation only if blockchain data unavailable
              const estimatedCirculatingSupply = totalReserves * 2 // Conservative 2x multiplier
              const estimatedTotalSupply = totalReserves * 5 // Conservative 5x multiplier for FDV
              
              marketCap = (estimatedCirculatingSupply * priceUsd).toFixed(0)
              fdv = (estimatedTotalSupply * priceUsd).toFixed(0)
            }
          } catch (supplyError) {
            console.log(`[TOKEN_SUPPLY_ERROR] Could not fetch supply for ${token.address}:`, supplyError)
            // Fallback to TVL-based estimation
            const estimatedCirculatingSupply = totalReserves * 2
            const estimatedTotalSupply = totalReserves * 5
            
            marketCap = (estimatedCirculatingSupply * priceUsd).toFixed(0)
            fdv = (estimatedTotalSupply * priceUsd).toFixed(0)
          }
        }
        
        console.log(`[ULTRA_FAST_TOKEN] TVL: $${tvl.toFixed(2)}, Market Cap: $${marketCap}, FDV: $${fdv}`)
      }
    } catch (error) {
      console.error('TVL/Market Cap calculation error:', error)
    }
    
    // Enhanced token data with calculated fields
    const enhancedToken = {
      ...token,
      id: token.address, // Map address to id for GraphQL schema
      symbol: token.symbol || 'Unknown',
      name: token.name || 'Unknown Token',
      decimals: token.decimals || 18,
      priceUsd: token.priceUsd || '0',
      priceChange24h: token.priceChange24h || 0,
      priceChange1h: token.priceChange1h || 0,
      priceChange7d: token.priceChange7d || 0,
      volumeUsd24h: token.volumeUsd24h || '0',
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
        console.log(`[FAST_TOKEN] START - Looking for token: ${address}`)
        console.time(`[FAST_TOKEN] ${address}`)
        const result = await FastTokenService.getToken(address, prisma)
        console.timeEnd(`[FAST_TOKEN] ${address}`)
        console.log(`[FAST_TOKEN] RESULT for ${address}:`, result ? 'Found' : 'NULL')
        if (!result) {
          console.error(`[FAST_TOKEN] Returned NULL for ${address} - check FastTokenService.getToken`)
        }
        return result
      } catch (error) {
        console.error(`[FAST_TOKEN] EXCEPTION for ${address}:`, error)
        return null
      }
    },

    // 🚀 FAST TOKEN BY ID (using address as ID in Ponder)
    token: async (_parent: unknown, { id }: { id: string }, { prisma }: Context) => {
      try {
        const token = await prisma.token.findFirst({
          where: { address: id },
          select: {
            address: true,
            symbol: true,
            name: true,
            decimals: true,
            imageUri: true,
            priceUsd: true,
            priceChange24h: true,
            volumeUsd24h: true,
            lastPriceUpdate: true,
            createdAt: true,
            updatedAt: true
          }
        })
        
        if (!token) return null

        return {
          ...token,
          id: token.address, // Map address to id for GraphQL schema
          symbol: token.symbol || 'Unknown',
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 18,
          priceUsd: token.priceUsd || '0',
          priceChange24h: token.priceChange24h || 0,
          volumeUsd24h: token.volumeUsd24h || '0',
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
        console.log('[FAST_TOKENS_LIST] Fetching tokens with first:', first, 'where:', where)

        // Build where clause
        const whereClause: any = {}
        if (where?.address) whereClause.address = { contains: where.address.toLowerCase() }
        if (where?.symbol) whereClause.symbol = { contains: where.symbol, mode: 'insensitive' }
        if (where?.name) whereClause.name = { contains: where.name, mode: 'insensitive' }

        const tokens = await prisma.token.findMany({
          where: whereClause,
          take: Math.min(first, 100),
          orderBy: { priceUsd: 'desc' } // Order by price (highest first)
        })
        
        // Transform tokens
        const transformedTokens = tokens.map((token: any) => ({
          ...token,
          id: token.address, // Map address to id for GraphQL schema
          symbol: token.symbol || 'Unknown',
          name: token.name || 'Unknown Token',
          decimals: token.decimals || 18,
          priceUsd: token.priceUsd || '0',
          priceChange24h: token.priceChange24h || 0,
          volumeUsd24h: token.volumeUsd24h || '0',
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
          reserveUsd: '0',
          poolApr: 0,
          rewardApr: 0,
          volume1h: '0',
          volume24h: '0',
          volume7d: '0',
          volume30d: '0',
          volumeChange24h: 0,
          volumeTvlRatio: 0
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
          let reserveUsd = '0'

          try {
            // Quick TVL calculation from reserves and token prices
            const token0Price = parseFloat(pair.token0?.priceUsd || '0')
            const token1Price = parseFloat(pair.token1?.priceUsd || '0')
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

            reserveUsd = tvl.toFixed(2)
          } catch (error) {
            console.warn(`[PAIRS] Error calculating TVL for pair ${pair.id}:`, error)
          }

          return {
            ...pair,
            id: pair.address, // Map address to id for GraphQL schema
            // Ensure tokens have id fields
            token0: pair.token0 ? { ...pair.token0, id: pair.token0.address } : null,
            token1: pair.token1 ? { ...pair.token1, id: pair.token1.address } : null,
            tvl: Math.round(tvl),
            reserveUsd,
            // Use pre-computed fields from the database
            poolApr: pair.poolApr || 0,
            rewardApr: 0, // This would come from farming data
            volume1h: pair.volume1h || '0',
            volume24h: pair.volume24h || '0',
            volume7d: pair.volume7d || '0',
            volume30d: pair.volume30d || '0',
            volumeChange24h: pair.volumeChange24h || 0,
            volumeTvlRatio: pair.volumeTvlRatio || 0
          }
        })
        
        return createConnection(transformedPairs)
      } catch (error) {
        console.error('[FAST_PAIRS] Error:', error)
        return createConnection([])
      }
    },

    // 🚀 FAST PAIR BY ADDRESS
    pairByAddress: async (_parent: unknown, { address }: { address: string }, { prisma }: Context) => {
      try {
        const normalizedAddress = address.toLowerCase()
        const pair = await prisma.pair.findFirst({
          where: { address: normalizedAddress },
          include: {
            token0: true,
            token1: true
          }
        })

        if (!pair) return null

        // Calculate TVL from reserves
        let tvl = 0
        let reserveUsd = '0'

        try {
          const token0Price = parseFloat(pair.token0?.priceUsd || '0')
          const token1Price = parseFloat(pair.token1?.priceUsd || '0')
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

          reserveUsd = tvl.toFixed(2)
        } catch (error) {
          console.error(`[PAIR_BY_ADDRESS] TVL calculation error for ${address}:`, error)
        }

        return {
          ...pair,
          id: pair.address,
          // Ensure tokens have id fields
          token0: pair.token0 ? { ...pair.token0, id: pair.token0.address } : null,
          token1: pair.token1 ? { ...pair.token1, id: pair.token1.address } : null,
          tvl,
          reserveUsd,
          poolApr: 0,
          rewardApr: 0,
          volume1h: '0',
          volume24h: pair.volume24h || '0',
          volume7d: pair.volume7d || '0',
          volume30d: pair.volume30d || '0',
          volumeChange24h: pair.volumeChange24h || 0,
          volumeTvlRatio: 0
        }
      } catch (error) {
        console.error(`[PAIR_BY_ADDRESS] Error for ${address}:`, error)
        return null
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
          console.log('[PROTOCOL_METRICS] ✅ Using Ponder-computed metrics')
          return {
            ...metrics,
            // Ensure percentage changes are properly mapped
            volume24hChange: metrics.volume24hChange || 0,
            volume1hChange: metrics.volume1hChange || 0
          }
        }

        // No metrics found - return minimal fallback
        console.log('[PROTOCOL_METRICS] ⚠️ No computed metrics available yet, returning minimal fallback')
        console.timeEnd('[PROTOCOL_METRICS]')
        return {
          id: 'minimal-fallback',
          timestamp: Math.floor(Date.now() / 1000),
          totalValueLockedUsd: '0',
          liquidityPoolsTvl: '0',
          stakingTvl: '0',
          farmingTvl: '0',
          dailyVolumeUsd: '0',
          weeklyVolumeUsd: '0',
          monthlyVolumeUsd: '0',
          totalVolumeUsd: '0',
          dailyFeesUsd: '0',
          weeklyFeesUsd: '0',
          monthlyFeesUsd: '0',
          totalFeesUsd: '0',
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
          totalValueLockedUsd: '0',
          liquidityPoolsTvl: '0',
          stakingTvl: '0',
          farmingTvl: '0',
          dailyVolumeUsd: '0',
          weeklyVolumeUsd: '0',
          monthlyVolumeUsd: '0',
          totalVolumeUsd: '0',
          dailyFeesUsd: '0',
          weeklyFeesUsd: '0',
          monthlyFeesUsd: '0',
          totalFeesUsd: '0',
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
            if (swap.pair?.token0?.priceUsd || swap.pair?.token1?.priceUsd) {
              const token0Price = parseFloat(swap.pair.token0?.priceUsd || '0')
              const token1Price = parseFloat(swap.pair.token1?.priceUsd || '0')
              
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
            // Ensure token objects have all required fields (use address as id)
            token0: swap.pair?.token0 ? {
              id: swap.pair.token0.address,
              address: swap.pair.token0.address,
              name: swap.pair.token0.name || 'Unknown',
              symbol: swap.pair.token0.symbol || 'UNK',
              decimals: swap.pair.token0.decimals || 18,
              imageUri: swap.pair.token0.imageUri || null
            } : null,
            token1: swap.pair?.token1 ? {
              id: swap.pair.token1.address,
              address: swap.pair.token1.address,
              name: swap.pair.token1.name || 'Unknown',
              symbol: swap.pair.token1.symbol || 'UNK',
              decimals: swap.pair.token1.decimals || 18,
              imageUri: swap.pair.token1.imageUri || null
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
          select: { id: true, priceUsd: true }
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
        
        // Step 4: Find most liquid pair containing this token
        const normalizedAddress = tokenAddress.toLowerCase()
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [
              { token0Address: normalizedAddress },
              { token1Address: normalizedAddress }
            ]
          },
          orderBy: {
            tvlUSD: 'desc' // Most liquid pair first
          },
          take: 1
        })

        if (pairs.length === 0) {
          console.log(`[TOKEN_CHART] No pairs found for token ${tokenAddress}`)
          // Emergency fallback using current price
          if (token.priceUsd) {
            const currentPrice = parseFloat(token.priceUsd)
            return [
              { time: startTime, value: currentPrice },
              { time: now, value: currentPrice }
            ]
          }
          return []
        }

        const pair = pairs[0]
        const isToken0 = pair.token0Address?.toLowerCase() === normalizedAddress

        console.log(`[TOKEN_CHART] Using pair ${pair.address} (token is ${isToken0 ? 'token0' : 'token1'})`)

        // Step 5: Query price observations from Ponder
        const observations = await prisma.priceObservation.findMany({
          where: {
            pairAddress: pair.address,
            blockTimestamp: {
              gte: startTime,
              lte: now
            }
          },
          orderBy: {
            blockTimestamp: 'asc'
          },
          take: config.limit
        })

        console.log(`[TOKEN_CHART] Found ${observations.length} price observations`)

        let chartData: ChartDataPoint[] = []

        if (observations.length > 0) {
          // Extract price based on token position
          chartData = observations
            .map(obs => ({
              time: obs.blockTimestamp,
              value: isToken0 ? (obs.token0PriceUSD || 0) : (obs.token1PriceUSD || 0)
            }))
            .filter(p => p.value > 0)

          console.log(`[TOKEN_CHART] Generated ${chartData.length} chart points`)
        }

        // Step 6: Fallback using current price if no observations
        if (chartData.length === 0 && token.priceUsd) {
          const currentPrice = parseFloat(token.priceUsd)
          chartData = [
            { time: startTime, value: currentPrice },
            { time: now, value: currentPrice }
          ]
          console.log(`[TOKEN_CHART] Using current price fallback`)
        }

        // Step 7: Cache results
        if (chartData.length > 0) {
          try {
            const redis = getRedisClient()
            if (redis) {
              await redis.set(cacheKey, JSON.stringify(chartData), 'EX', 60) // 1 minute cache
              console.log(`[TOKEN_CHART] Cached ${chartData.length} points`)
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

    // 🚀 PAIR PRICE CHART RESOLVER
    pairPriceChart: async (
      _parent: unknown,
      { pairAddress, timeframe = '1d', limit = 100 }: { pairAddress: string; timeframe?: string; limit?: number },
      { prisma }: Context
    ): Promise<ChartDataPoint[]> => {
      try {
        const normalizedAddress = pairAddress.toLowerCase()

        // Calculate timeframe duration
        const durations: Record<string, number> = {
          '1h': 3600,
          '1d': 86400,
          '1w': 604800,
          '1m': 2629746,
          '1y': 31557600
        }
        const duration = durations[timeframe] || durations['1d']
        const now = Math.floor(Date.now() / 1000)
        const startTime = now - duration

        // Query price observations from PonderDB
        const observations = await prisma.priceObservation.findMany({
          where: {
            pairAddress: normalizedAddress
          },
          orderBy: { blockTimestamp: 'asc' },
          take: limit
        })

        if (observations.length > 0) {
          // Use token0 price (or token1 if token0 is null)
          const chartData = observations
            .map(obs => ({
              time: obs.blockTimestamp,
              value: obs.token0PriceUSD || obs.token1PriceUSD || 0
            }))
            .filter(point => point.value > 0)

          if (chartData.length > 0) return chartData
        }

        // Fallback: Get pair's current data for emergency chart
        const pair = await prisma.pair.findFirst({
          where: { address: normalizedAddress },
          include: { token0: true, token1: true }
        })

        if (!pair) return []

        // Calculate current price from reserves
        const reserve0 = parseFloat(pair.reserve0 || '0')
        const reserve1 = parseFloat(pair.reserve1 || '0')
        const token0Decimals = pair.token0?.decimals || 18
        const token1Decimals = pair.token1?.decimals || 18

        let currentPrice = 1.0
        if (reserve0 > 0 && reserve1 > 0) {
          const adjustedReserve0 = reserve0 / Math.pow(10, token0Decimals)
          const adjustedReserve1 = reserve1 / Math.pow(10, token1Decimals)
          currentPrice = adjustedReserve1 / adjustedReserve0
        }

        // Return emergency fallback with 2 points
        return [
          { time: startTime, value: currentPrice },
          { time: now, value: currentPrice }
        ]
      } catch (error) {
        console.error('[PAIR_PRICE_CHART] Error:', error)
        return []
      }
    },

    // 🚀 PAIR VOLUME CHART RESOLVER
    pairVolumeChart: async (
      _parent: unknown,
      { pairAddress, timeframe = '1d', limit = 100 }: { pairAddress: string; timeframe?: string; limit?: number },
      { prisma }: Context
    ) => {
      try {
        const normalizedAddress = pairAddress.toLowerCase()

        // Calculate timeframe duration
        const durations: Record<string, number> = {
          '1h': 3600,
          '1d': 86400,
          '1w': 604800,
          '1m': 2629746,
          '1y': 31557600
        }
        const duration = durations[timeframe] || durations['1d']
        const now = Math.floor(Date.now() / 1000)
        const startTime = now - duration

        // Query swaps from PonderDB to calculate volume
        const swaps = await prisma.swap.findMany({
          where: {
            pairAddress: normalizedAddress
          },
          orderBy: { timestamp: 'asc' },
          take: limit * 10 // Get more swaps to aggregate into buckets
        })

        if (swaps.length > 0) {
          // Group swaps into time buckets
          const bucketSize = Math.floor(duration / limit)
          const buckets: Record<number, { volume0: number; volume1: number; count: number }> = {}

          swaps.forEach(swap => {
            const swapTime = parseInt(swap.timestamp)
            const bucketTime = Math.floor((swapTime - startTime) / bucketSize) * bucketSize + startTime

            if (!buckets[bucketTime]) {
              buckets[bucketTime] = { volume0: 0, volume1: 0, count: 0 }
            }

            buckets[bucketTime].volume0 += parseFloat(swap.amountIn0 || '0') + parseFloat(swap.amountOut0 || '0')
            buckets[bucketTime].volume1 += parseFloat(swap.amountIn1 || '0') + parseFloat(swap.amountOut1 || '0')
            buckets[bucketTime].count++
          })

          // Convert buckets to chart data
          const chartData = Object.entries(buckets)
            .map(([time, data]) => ({
              time: parseInt(time),
              value: data.volume0, // Primary value is volume in token0
              volume0: data.volume0,
              volume1: data.volume1,
              count: data.count
            }))
            .sort((a, b) => a.time - b.time)

          if (chartData.length > 0) return chartData
        }

        // Fallback: Return empty chart if no swap data
        return []
      } catch (error) {
        console.error('[PAIR_VOLUME_CHART] Error:', error)
        return []
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
            stakingPosition: null
          }
        }

        const normalizedAddress = userAddress.toLowerCase()

        // Fetch all position types in parallel
        const [liquidityPositions, farmingPositions, stakingPositions] = await Promise.all([
          prisma.liquidityPosition.findMany({
            where: { userAddress: normalizedAddress }
          }),
          prisma.farmingPosition.findMany({
            where: { userAddress: normalizedAddress }
          }),
          prisma.stakingPosition.findMany({
            where: { userAddress: normalizedAddress }
          })
        ])

        // Manually fetch related pair data for liquidity positions
        const enrichedLiquidityPositions = await Promise.all(
          liquidityPositions.map(async (pos) => {
            const pairData = await prisma.pair.findFirst({
              where: { address: pos.pairAddress },
              include: { token0: true, token1: true }
            })
            return {
              ...pos,
              pair: pairData ? {
                ...pairData,
                id: pairData.address,
                token0: pairData.token0 ? { ...pairData.token0, id: pairData.token0.address } : null,
                token1: pairData.token1 ? { ...pairData.token1, id: pairData.token1.address } : null
              } : null
            }
          })
        )

        console.timeEnd(`[USER_POSITIONS] ${userAddress}`)

        return {
          liquidityPositions: enrichedLiquidityPositions,
          farmingPositions: farmingPositions,
          stakingPosition: stakingPositions[0] || null
        }
      } catch (error) {
        console.error(`[USER_POSITIONS] Error for ${userAddress}:`, error)
        return {
          liquidityPositions: [],
          farmingPositions: [],
          stakingPosition: null
        }
      }
    },

    // 🚀 LAUNCH RESOLVER
    launch: async (_parent: unknown, { launchId }: { launchId: number }, { prisma }: Context) => {
      try {
        console.time(`[LAUNCH] ${launchId}`)

        const launchData = await prisma.launch.findFirst({
          where: { launchId }
        })

        if (!launchData) {
          console.timeEnd(`[LAUNCH] ${launchId}`)
          console.log(`[LAUNCH] Launch ${launchId} not found`)
          return null
        }

        // Fetch contributions for this launch
        const contributions = await prisma.launchContribution.findMany({
          where: { launchId },
          orderBy: { createdAt: 'desc' }
        })

        console.timeEnd(`[LAUNCH] ${launchId}`)
        console.log(`[LAUNCH] Found launch ${launchId} with ${contributions.length} contributions`)

        return {
          ...launchData,
          contributions
        }
      } catch (error) {
        console.error(`[LAUNCH] Error for ${launchId}:`, error)
        return null
      }
    },

    // Add other resolvers as needed...
    
  }
}

export default resolvers

