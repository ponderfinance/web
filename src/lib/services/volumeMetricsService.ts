import { PrismaClient } from '@prisma/client'
import { CacheManager, CachePrefix } from './cacheManager'

const prisma = new PrismaClient()

/**
 * Service for calculating and managing volume metrics across different timeframes
 */
export const VolumeMetricsService = {
  /**
   * Calculate volume metrics for a pair over different time periods
   */
  async calculatePairVolumeMetrics(pairId: string): Promise<void> {
    try {
      console.log(`Calculating volume metrics for pair ${pairId}`)
      
      // Get current timestamp
      const now = Date.now()
      const nowSeconds = Math.floor(now / 1000)
      
      // Define time boundaries for different periods
      const oneHourAgo = now - 60 * 60 * 1000
      const oneDayAgo = now - 24 * 60 * 60 * 1000
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
      const prevDayStart = oneDayAgo - 24 * 60 * 60 * 1000
      
      // Get the pair to access token information
      const pair = await prisma.pair.findUnique({
        where: { id: pairId },
        include: { 
          token0: true,
          token1: true
        }
      })
      
      if (!pair) {
        console.error(`Pair ${pairId} not found`)
        return
      }
      
      // Get swaps for this pair within the last 30 days
      const swaps = await prisma.swap.findMany({
        where: {
          pairId,
          timestamp: { gte: BigInt(Math.floor(thirtyDaysAgo / 1000)) }
        },
        orderBy: { timestamp: 'desc' }
      })
      
      // Helper function to calculate USD value from token amounts
      const calculateUsdValue = (amountIn0: string, amountIn1: string): number => {
        let usdValue = 0
        const token0Price = pair.token0.priceUSD ? parseFloat(pair.token0.priceUSD) : 0
        const token1Price = pair.token1.priceUSD ? parseFloat(pair.token1.priceUSD) : 0
        
        if (token0Price > 0) {
          const amount0 = parseFloat(amountIn0) / Math.pow(10, pair.token0.decimals || 18)
          usdValue += amount0 * token0Price
        }
        
        if (token1Price > 0) {
          const amount1 = parseFloat(amountIn1) / Math.pow(10, pair.token1.decimals || 18)
          usdValue += amount1 * token1Price
        }
        
        return usdValue
      }
      
      // Calculate volume for each time period
      const volumeInPeriod = (from: number): number => {
        return swaps
          .filter(swap => BigInt(swap.timestamp) >= BigInt(Math.floor(from / 1000)))
          .reduce((acc, swap) => {
            return acc + calculateUsdValue(swap.amountIn0, swap.amountIn1)
          }, 0)
      }
      
      // Calculate volumes
      const volume1h = volumeInPeriod(oneHourAgo)
      const volume24h = volumeInPeriod(oneDayAgo)
      const volume7d = volumeInPeriod(sevenDaysAgo)
      const volume30d = volumeInPeriod(thirtyDaysAgo)
      
      // Calculate previous 24h volume for change percentage
      const prevDayVolume = swaps
        .filter(swap => 
          BigInt(swap.timestamp) >= BigInt(Math.floor(prevDayStart / 1000)) && 
          BigInt(swap.timestamp) < BigInt(Math.floor(oneDayAgo / 1000))
        )
        .reduce((acc, swap) => {
          return acc + calculateUsdValue(swap.amountIn0, swap.amountIn1)
        }, 0)
      
      // Calculate volume change percentage
      const volumeChange24h = prevDayVolume > 0 
        ? ((volume24h - prevDayVolume) / prevDayVolume) * 100 
        : 0
      
      // Calculate TVL from reserves and token prices
      let tvl = 0
      const token0Price = pair.token0.priceUSD ? parseFloat(pair.token0.priceUSD) : 0
      const token1Price = pair.token1.priceUSD ? parseFloat(pair.token1.priceUSD) : 0
      
      if (token0Price > 0) {
        const reserve0Value = parseFloat(pair.reserve0) / Math.pow(10, pair.token0.decimals || 18) * token0Price
        tvl += reserve0Value
      }
      
      if (token1Price > 0) {
        const reserve1Value = parseFloat(pair.reserve1) / Math.pow(10, pair.token1.decimals || 18) * token1Price
        tvl += reserve1Value
      }
      
      const volumeTVLRatio = tvl > 0 ? volume24h / tvl : 0
      
      // Calculate approx APR based on 0.3% fee and daily volume
      const dailyFeeRevenue = volume24h * 0.003 // 0.3% fee
      const poolAPR = tvl > 0 ? (dailyFeeRevenue / tvl) * 365 * 100 : 0 // Annualized percentage
      
      // Update pair with calculated volumes
      await prisma.pair.update({
        where: { id: pairId },
        data: {
          volume1h: volume1h.toString(),
          volume24h: volume24h.toString(),
          volume7d: volume7d.toString(),
          volume30d: volume30d.toString(),
          volumeChange24h,
          volumeTVLRatio,
          poolAPR
        }
      })
      
      // Create volume metric record for historical tracking
      await prisma.volumeMetric.create({
        data: {
          timestamp: BigInt(nowSeconds),
          entity: 'pair',
          entityId: pairId,
          volume1h: volume1h.toString(),
          volume24h: volume24h.toString(),
          volume7d: volume7d.toString(),
          volume30d: volume30d.toString(),
          volumeChange24h
        }
      })
      
      // Cache calculated values
      try {
        CacheManager.set(CachePrefix.VOLUME, `${pairId}:24h`, volume24h.toString())
        CacheManager.set(CachePrefix.VOLUME, `${pairId}:7d`, volume7d.toString())
      } catch (error) {
        console.error('Failed to cache volume metrics:', error)
      }
      
      console.log(`Updated volume metrics for pair ${pairId}: 24h=${volume24h}, 7d=${volume7d}`)
    } catch (error) {
      console.error(`Error calculating volume metrics for pair ${pairId}:`, error)
    }
  },
  
  /**
   * Calculate volume metrics for a token across all pairs
   */
  async calculateTokenVolumeMetrics(tokenId: string): Promise<void> {
    try {
      console.log(`Calculating volume metrics for token ${tokenId}`)
      
      // Find all pairs where this token is either token0 or token1
      const pairs = await prisma.pair.findMany({
        where: {
          OR: [
            { token0Id: tokenId },
            { token1Id: tokenId }
          ]
        }
      })
      
      if (pairs.length === 0) {
        console.log(`No pairs found for token ${tokenId}`)
        return
      }
      
      // Sum up the volumes from all pairs
      const volume1h = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume1h || '0'), 0)
      const volume24h = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume24h || '0'), 0)
      const volume7d = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume7d || '0'), 0)
      const volume30d = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume30d || '0'), 0)
      
      // Get previous volume metric to calculate change
      const prevMetric = await prisma.volumeMetric.findFirst({
        where: {
          entity: 'token',
          entityId: tokenId
        },
        orderBy: {
          timestamp: 'desc'
        }
      })
      
      // Calculate volume change percentage
      const volumeChange24h = prevMetric && parseFloat(prevMetric.volume24h) > 0
        ? ((volume24h - parseFloat(prevMetric.volume24h)) / parseFloat(prevMetric.volume24h)) * 100
        : 0
      
      // Update token with calculated volumes
      await prisma.token.update({
        where: { id: tokenId },
        data: {
          volume1h: volume1h.toString(),
          volumeUSD24h: volume24h.toString(),
          volume7d: volume7d.toString(),
          volume30d: volume30d.toString(),
          volumeChange24h
        }
      })
      
      // Create volume metric record for historical tracking
      await prisma.volumeMetric.create({
        data: {
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          entity: 'token',
          entityId: tokenId,
          volume1h: volume1h.toString(),
          volume24h: volume24h.toString(),
          volume7d: volume7d.toString(),
          volume30d: volume30d.toString(),
          volumeChange24h
        }
      })
      
      console.log(`Updated volume metrics for token ${tokenId}: 24h=${volume24h}, 7d=${volume7d}`)
    } catch (error) {
      console.error(`Error calculating volume metrics for token ${tokenId}:`, error)
    }
  },
  
  /**
   * Calculate global protocol volume metrics
   */
  async calculateProtocolVolumeMetrics(): Promise<void> {
    try {
      console.log('Calculating protocol volume metrics')
      
      // Get all pairs
      const pairs = await prisma.pair.findMany()
      
      // Calculate total volumes
      const volume1h = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume1h || '0'), 0)
      const volume24h = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume24h || '0'), 0)
      const volume7d = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume7d || '0'), 0)
      const volume30d = pairs.reduce((sum, pair) => sum + parseFloat(pair.volume30d || '0'), 0)
      
      // Get previous protocol metric
      const prevMetric = await prisma.volumeMetric.findFirst({
        where: {
          entity: 'protocol',
          entityId: 'global'
        },
        orderBy: {
          timestamp: 'desc'
        }
      })
      
      // Calculate volume change percentage
      const volume1hChange = prevMetric && parseFloat(prevMetric.volume1h) > 0
        ? ((volume1h - parseFloat(prevMetric.volume1h)) / parseFloat(prevMetric.volume1h)) * 100
        : 0
      
      // Count active pools (had volume in last 24h)
      const activePoolsCount = pairs.filter(pair => parseFloat(pair.volume24h || '0') > 0).length
      
      // Get or create protocol metric
      const protocolMetric = await prisma.protocolMetric.findFirst()
      
      if (protocolMetric) {
        await prisma.protocolMetric.update({
          where: { id: protocolMetric.id },
          data: {
            timestamp: Math.floor(Date.now() / 1000),
            dailyVolumeUSD: volume24h.toString(),
            weeklyVolumeUSD: volume7d.toString(),
            monthlyVolumeUSD: volume30d.toString(),
            volume1h: volume1h.toString(),
            volume1hChange,
            totalPairs: pairs.length,
            activePoolsCount
          }
        })
      } else {
        // Create a new protocol metric if none exists
        await prisma.protocolMetric.create({
          data: {
            timestamp: Math.floor(Date.now() / 1000),
            totalValueLockedUSD: '0',
            liquidityPoolsTVL: '0',
            stakingTVL: '0',
            farmingTVL: '0',
            dailyVolumeUSD: volume24h.toString(),
            weeklyVolumeUSD: volume7d.toString(),
            monthlyVolumeUSD: volume30d.toString(),
            totalVolumeUSD: volume30d.toString(),
            dailyFeesUSD: (volume24h * 0.003).toString(),
            weeklyFeesUSD: (volume7d * 0.003).toString(),
            monthlyFeesUSD: (volume30d * 0.003).toString(),
            totalFeesUSD: (volume30d * 0.003).toString(),
            totalUsers: 0,
            dailyActiveUsers: 0,
            weeklyActiveUsers: 0,
            monthlyActiveUsers: 0,
            volume1h: volume1h.toString(),
            volume1hChange,
            totalPairs: pairs.length,
            activePoolsCount
          }
        })
      }
      
      // Create volume metric record for historical tracking
      await prisma.volumeMetric.create({
        data: {
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          entity: 'protocol',
          entityId: 'global',
          volume1h: volume1h.toString(),
          volume24h: volume24h.toString(),
          volume7d: volume7d.toString(),
          volume30d: volume30d.toString(),
          volumeChange1h: volume1hChange
        }
      })
      
      console.log(`Updated protocol volume metrics: 24h=${volume24h}, 7d=${volume7d}`)
    } catch (error) {
      console.error('Error calculating protocol volume metrics:', error)
    }
  },
  
  /**
   * Update metrics for all entities - called periodically
   */
  async updateAllMetrics(): Promise<void> {
    try {
      console.log('Starting metrics update for all entities')
      
      // Get all pairs
      const pairs = await prisma.pair.findMany({
        select: { id: true }
      })
      
      // Calculate pair metrics
      for (const pair of pairs) {
        await this.calculatePairVolumeMetrics(pair.id)
      }
      
      // Get all tokens
      const tokens = await prisma.token.findMany({
        select: { id: true }
      })
      
      // Calculate token metrics
      for (const token of tokens) {
        await this.calculateTokenVolumeMetrics(token.id)
      }
      
      // Calculate protocol metrics
      await this.calculateProtocolVolumeMetrics()
      
      console.log('Completed metrics update for all entities')
    } catch (error) {
      console.error('Error updating all metrics:', error)
    }
  }
}

export default VolumeMetricsService 