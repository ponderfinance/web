/**
 * Metrics Service
 * 
 * Centralized service responsible for all metrics calculations in the application.
 * Serves as a single source of truth for volume, TVL, and other metrics.
 * 
 * Features:
 * - Cacheable metrics with smart invalidation
 * - Real-time calculation where needed
 * - Consistent calculation methods across the application
 * - Time-aware staleness detection
 */

import { formatUnits, parseUnits } from 'viem';
import { prisma } from '@/src/lib/db/prisma';
import { getRedisClient } from '@/src/lib/redis/client';
import { CacheManager, CachePrefix } from './cacheManager';
import { TokenPriceService } from './tokenPriceService';
import { calculatePairTVL } from '@/src/lib/graphql/priceUtils';
import { Prisma } from '@prisma/client'
import { getKey, setKey } from '@/src/lib/redis'
import prismaClient from '@/src/lib/db/prisma'
import tokenPriceService from './tokenPriceService'

// Constants for cache TTL (in seconds)
const CACHE_TTL = {
  SHORT: 60, // 1 minute for highly volatile data (e.g., real-time volume)
  MEDIUM: 5 * 60, // 5 minutes for regular metrics
  LONG: 30 * 60, // 30 minutes for stable metrics
};

// Interfaces for metrics data
export interface ProtocolMetrics {
  id: string;
  timestamp: number;
  totalValueLockedUSD: string;
  liquidityPoolsTVL: string;
  stakingTVL: string;
  farmingTVL: string;
  dailyVolumeUSD: string;
  weeklyVolumeUSD: string;
  monthlyVolumeUSD: string;
  volume1h: string;
  volume1hChange: number;
  volume24hChange: number | null;
  dailyFeesUSD: string;
  totalPairs: number;
  activePoolsCount: number;
}

export interface PairMetrics {
  id: string;
  address: string;
  reserveUSD: string;
  tvl: string;
  volume1h: string;
  volume24h: string;
  volume7d: string;
  volume30d: string;
  volumeChange24h: number | null;
  volumeTVLRatio: number;
  poolAPR: number;
  lastUpdate: number;
}

export interface TokenMetrics {
  id: string;
  priceUSD: string;
  priceChange24h: number | null;
  priceChange1h: number | null;
  priceChange7d: number | null;
  volume1h: string;
  volumeUSD24h: string;
  volume7d: string;
  volume30d: string;
  volumeChange24h: number | null;
  tvl: string;
  marketCap: string;
  fdv: string;
  lastUpdate: number;
}

/**
 * Service for all metrics calculations
 */
export const MetricsService = {
  /**
   * Get protocol-wide metrics
   */
  async getProtocolMetrics(forceRefresh = false): Promise<ProtocolMetrics> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = await CacheManager.get<ProtocolMetrics>(
          CachePrefix.METRICS, 
          'protocol', 
          'metrics'
        );
        
        if (cached) {
          // Check for staleness
          const now = Math.floor(Date.now() / 1000);
          // If metrics are less than 5 minutes old, use them
          if (now - cached.timestamp < CACHE_TTL.MEDIUM) {
            return cached;
          }
        }
      }
      
      // Get the latest metric from the database
      const metric = await prisma.protocolMetric.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      
      if (!metric) {
        // Return default values if no metrics exist yet
        const defaultMetric: ProtocolMetrics = {
          id: 'default',
          timestamp: Math.floor(Date.now() / 1000),
          totalValueLockedUSD: '0',
          liquidityPoolsTVL: '0',
          stakingTVL: '0',
          farmingTVL: '0',
          dailyVolumeUSD: '0',
          weeklyVolumeUSD: '0',
          monthlyVolumeUSD: '0',
          volume1h: '0',
          volume1hChange: 0,
          volume24hChange: 0,
          dailyFeesUSD: '0',
          totalPairs: 0,
          activePoolsCount: 0
        };
        
        // Cache the default metric
        await CacheManager.set(
          CachePrefix.METRICS, 
          'protocol', 
          defaultMetric, 
          'metrics', 
          { ttl: CACHE_TTL.SHORT }
        );
        
        return defaultMetric;
      }
      
      // Check if volume data is stale
      const now = Math.floor(Date.now() / 1000);
      const metricTime = typeof metric.timestamp === 'string' 
        ? parseInt(metric.timestamp, 10) 
        : metric.timestamp;
      
      // If volume data is more than 30 minutes old, get recent swaps
      let volume24h = metric.dailyVolumeUSD;
      
      if (now - metricTime > CACHE_TTL.LONG) {
        // Calculate recent volume
        volume24h = await this.calculateRealTime24hVolume('protocol', 'protocol');
      }
      
      // Convert to the expected format
      const protocolMetric: ProtocolMetrics = {
        id: metric.id || 'default',
        timestamp: metricTime,
        totalValueLockedUSD: metric.totalValueLockedUSD || '0',
        liquidityPoolsTVL: metric.liquidityPoolsTVL || '0',
        stakingTVL: metric.stakingTVL || '0',
        farmingTVL: metric.farmingTVL || '0',
        dailyVolumeUSD: volume24h,
        weeklyVolumeUSD: metric.weeklyVolumeUSD || '0',
        monthlyVolumeUSD: metric.monthlyVolumeUSD || '0',
        volume1h: metric.volume1h || '0',
        volume1hChange: typeof metric.volume1hChange === 'number' ? metric.volume1hChange : 0,
        volume24hChange: metric.volume24hChange,
        dailyFeesUSD: metric.dailyFeesUSD || '0',
        totalPairs: metric.totalPairs || 0,
        activePoolsCount: metric.activePoolsCount || 0
      };
      
      // Cache the protocol metric
      await CacheManager.set(
        CachePrefix.METRICS, 
        'protocol', 
        protocolMetric, 
        'metrics', 
        { ttl: CACHE_TTL.MEDIUM }
      );
      
      return protocolMetric;
    } catch (error) {
      console.error('Error retrieving protocol metrics:', error);
      // Return default values if there was an error
      return {
        id: 'default',
        timestamp: Math.floor(Date.now() / 1000),
        totalValueLockedUSD: '0',
        liquidityPoolsTVL: '0',
        stakingTVL: '0',
        farmingTVL: '0',
        dailyVolumeUSD: '0',
        weeklyVolumeUSD: '0',
        monthlyVolumeUSD: '0',
        volume1h: '0',
        volume1hChange: 0,
        volume24hChange: 0,
        dailyFeesUSD: '0',
        totalPairs: 0,
        activePoolsCount: 0
      };
    }
  },
  
  /**
   * Get metrics for a specific pair
   */
  async getPairMetrics(pairId: string, forceRefresh = false): Promise<PairMetrics> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = await CacheManager.get<PairMetrics>(
          CachePrefix.METRICS,
          pairId,
          'metrics'
        );
        
        if (cached) {
          // Check for staleness
          const now = Math.floor(Date.now() / 1000);
          // If metrics are less than 5 minutes old, use them
          if (now - cached.lastUpdate < CACHE_TTL.MEDIUM) {
            return cached;
          }
        }
      }
      
      // Get pair data with tokens
      const pair = await prisma.pair.findUnique({
        where: { id: pairId },
        include: {
          token0: true,
          token1: true
        }
      });
      
      if (!pair) {
        throw new Error(`Pair not found with ID: ${pairId}`);
      }
      
      // Calculate TVL
      const tvl = await this.calculatePairTVL(pairId);
      
      // Check if volume data is stale
      const now = Math.floor(Date.now() / 1000);
      
      // Calculate real-time volume if needed
      let volume24h = pair.volume24h || '0';
      const volume1h = pair.volume1h || '0';
      const volume7d = pair.volume7d || '0';
      const volume30d = pair.volume30d || '0';
      
      // If we need real-time volume data
      if (forceRefresh || !volume24h || volume24h === '0') {
        // Get real-time volume
        volume24h = await this.calculateRealTime24hVolume(pairId, 'pair');
      }
      
      // Calculate additional metrics
      const tvlValue = parseFloat(tvl);
      const volumeValue = parseFloat(volume24h);
      const volumeTVLRatio = tvlValue > 0 ? volumeValue / tvlValue : 0;
      const dailyFeeRevenue = volumeValue * 0.003; // 0.3% fee
      const poolAPR = tvlValue > 0 ? (dailyFeeRevenue / tvlValue) * 365 * 100 : 0;
      
      // Create metrics object
      const pairMetrics: PairMetrics = {
        id: pairId,
        address: pair.address,
        reserveUSD: tvl, // Use calculated TVL for reserveUSD
        tvl,
        volume1h,
        volume24h,
        volume7d,
        volume30d,
        volumeChange24h: pair.volumeChange24h,
        volumeTVLRatio,
        poolAPR,
        lastUpdate: now
      };
      
      // Cache the pair metrics
      await CacheManager.set(
        CachePrefix.METRICS,
        pairId,
        pairMetrics,
        'metrics',
        { ttl: CACHE_TTL.MEDIUM }
      );
      
      return pairMetrics;
    } catch (error) {
      console.error(`Error retrieving metrics for pair ${pairId}:`, error);
      return {
        id: pairId,
        address: '',
        reserveUSD: '0',
        tvl: '0',
        volume1h: '0',
        volume24h: '0',
        volume7d: '0',
        volume30d: '0',
        volumeChange24h: null,
        volumeTVLRatio: 0,
        poolAPR: 0,
        lastUpdate: Math.floor(Date.now() / 1000)
      };
    }
  },
  
  /**
   * Get metrics for a specific token
   */
  async getTokenMetrics(tokenId: string, forceRefresh = false): Promise<TokenMetrics> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = await CacheManager.get<TokenMetrics>(
          CachePrefix.METRICS,
          tokenId,
          'metrics'
        );
        
        if (cached) {
          // Check for staleness
          const now = Math.floor(Date.now() / 1000);
          // If metrics are less than 5 minutes old, use them
          if (now - cached.lastUpdate < CACHE_TTL.MEDIUM) {
            return cached;
          }
        }
      }
      
      // Get token data
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        include: {
          pairsAsToken0: {
            include: {
              token0: true,
              token1: true
            }
          },
          pairsAsToken1: {
            include: {
              token0: true,
              token1: true
            }
          }
        }
      });
      
      if (!token) {
        throw new Error(`Token not found with ID: ${tokenId}`);
      }
      
      // Get latest price data
      const priceData = await TokenPriceService.getTokenPriceUSD(tokenId);
      const priceUSD = priceData > 0 ? priceData.toString() : (token.priceUSD || '0');
      
      // Check if volume data is stale
      const now = Math.floor(Date.now() / 1000);
      
      // Calculate or reuse volume metrics
      let volumeUSD24h = token.volumeUSD24h || '0';
      
      // If we need real-time volume data
      if (forceRefresh || !volumeUSD24h || volumeUSD24h === '0') {
        // Check for recent swaps to ensure volume is still valid
        volumeUSD24h = await this.calculateRealTime24hVolume(tokenId, 'token');
      }
      
      // Calculate TVL
      const tvl = await this.calculateTokenTVL(tokenId);
      
      // Calculate marketCap and FDV
      const marketCap = await this.calculateTokenMarketCap(token);
      const fdv = await this.calculateTokenFDV(token);
      
      // Create metrics object
      const tokenMetrics: TokenMetrics = {
        id: tokenId,
        priceUSD,
        priceChange24h: token.priceChange24h,
        priceChange1h: token.priceChange1h || 0,
        priceChange7d: token.priceChange7d || 0,
        volume1h: token.volume1h || '0',
        volumeUSD24h,
        volume7d: token.volume7d || '0',
        volume30d: token.volume30d || '0',
        volumeChange24h: token.volumeChange24h,
        tvl,
        marketCap,
        fdv,
        lastUpdate: now
      };
      
      // Cache the token metrics
      await CacheManager.set(
        CachePrefix.METRICS,
        tokenId,
        tokenMetrics,
        'metrics',
        { ttl: CACHE_TTL.MEDIUM }
      );
      
      return tokenMetrics;
    } catch (error) {
      console.error(`Error retrieving metrics for token ${tokenId}:`, error);
      return {
        id: tokenId,
        priceUSD: '0',
        priceChange24h: null,
        priceChange1h: null,
        priceChange7d: null,
        volume1h: '0',
        volumeUSD24h: '0',
        volume7d: '0',
        volume30d: '0',
        volumeChange24h: null,
        tvl: '0',
        marketCap: '0',
        fdv: '0',
        lastUpdate: Math.floor(Date.now() / 1000)
      };
    }
  },
  
  /**
   * Calculate real-time 24h volume for any entity
   */
  async calculateRealTime24hVolume(entityId: string, entityType: 'token' | 'pair' | 'protocol'): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 60 * 60;
      
      let swaps = [];
      let totalVolumeUSD = 0;
      
      if (entityType === 'protocol') {
        // For protocol, get all swaps
        swaps = await prisma.swap.findMany({
          where: {
            timestamp: { gte: oneDayAgo.toString() }
          },
          include: {
            pair: {
              include: {
                token0: true,
                token1: true
              }
            }
          }
        });
      } else if (entityType === 'pair') {
        // For pair, get swaps for this pair
        swaps = await prisma.swap.findMany({
          where: {
            pairId: entityId,
            timestamp: { gte: oneDayAgo.toString() }
          },
          include: {
            pair: {
              include: {
                token0: true,
                token1: true
              }
            }
          }
        });
      } else if (entityType === 'token') {
        // For token, get swaps for all pairs that include this token
        swaps = await prisma.swap.findMany({
          where: {
            OR: [
              { pair: { token0Id: entityId } },
              { pair: { token1Id: entityId } }
            ],
            timestamp: { gte: oneDayAgo.toString() }
          },
          include: {
            pair: {
              include: {
                token0: true,
                token1: true
              }
            }
          }
        });
      }
      
      // Calculate volume in USD
      for (const swap of swaps) {
        try {
          // If the swap already has a precomputed valueUSD, use that
          if (swap.valueUSD && parseFloat(swap.valueUSD) > 0) {
            totalVolumeUSD += parseFloat(swap.valueUSD);
            continue;
          }
          
          // Otherwise calculate from actual swap amounts
          const pair = swap.pair;
          if (!pair || !pair.token0 || !pair.token1) continue;
          
          const token0Decimals = pair.token0.decimals || 18;
          const token1Decimals = pair.token1.decimals || 18;
          
          // Get token prices - use the price from token object or get from service
          let token0Price = parseFloat(pair.token0.priceUSD || '0');
          let token1Price = parseFloat(pair.token1.priceUSD || '0');
          
          if (token0Price <= 0) {
            token0Price = await TokenPriceService.getTokenPriceUSD(pair.token0Id);
          }
          
          if (token1Price <= 0) {
            token1Price = await TokenPriceService.getTokenPriceUSD(pair.token1Id);
          }
          
          // Calculate values based on available data
          let swapVolumeUSD = 0;
          
          if (token0Price > 0) {
            const amount0 = Number(formatUnits(BigInt(swap.amountIn0 || '0'), token0Decimals)) +
                           Number(formatUnits(BigInt(swap.amountOut0 || '0'), token0Decimals));
            swapVolumeUSD = amount0 * token0Price;
          } else if (token1Price > 0) {
            const amount1 = Number(formatUnits(BigInt(swap.amountIn1 || '0'), token1Decimals)) +
                           Number(formatUnits(BigInt(swap.amountOut1 || '0'), token1Decimals));
            swapVolumeUSD = amount1 * token1Price;
          }
          
          totalVolumeUSD += swapVolumeUSD;
        } catch (error) {
          console.error(`Error calculating volume for swap ${swap.id}:`, error);
          // Continue with other swaps
        }
      }
      
      return totalVolumeUSD.toString();
    } catch (error) {
      console.error(`Error calculating real-time volume for ${entityType} ${entityId}:`, error);
      return '0';
    }
  },
  
  /**
   * Calculate TVL for a pair
   */
  async calculatePairTVL(pairId: string): Promise<string> {
    try {
      const pair = await prisma.pair.findUnique({
        where: { id: pairId },
        include: {
          token0: true,
          token1: true
        }
      });
      
      if (!pair) return '0';
      
      // Get token prices
      const token0Price = parseFloat(pair.token0.priceUSD || '0');
      const token1Price = parseFloat(pair.token1.priceUSD || '0');
      
      // Get token decimals
      const token0Decimals = pair.token0.decimals || 18;
      const token1Decimals = pair.token1.decimals || 18;
      
      // Calculate the USD value of reserves
      let reserve0Value = 0, reserve1Value = 0;
      
      if (token0Price > 0 && pair.reserve0) {
        const reserve0 = Number(formatUnits(BigInt(pair.reserve0), token0Decimals));
        reserve0Value = reserve0 * token0Price;
      }
      
      if (token1Price > 0 && pair.reserve1) {
        const reserve1 = Number(formatUnits(BigInt(pair.reserve1), token1Decimals));
        reserve1Value = reserve1 * token1Price;
      }
      
      // Calculate total TVL as sum of both sides
      const tvl = reserve0Value + reserve1Value;
      
      return tvl.toString();
    } catch (error) {
      console.error(`Error calculating TVL for pair ${pairId}:`, error);
      return '0';
    }
  },
  
  /**
   * Calculate TVL for a token across all its pairs
   */
  async calculateTokenTVL(tokenId: string): Promise<string> {
    try {
      // Get all pairs where this token is token0 or token1
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        include: {
          pairsAsToken0: {
            include: {
              token0: true,
              token1: true
            }
          },
          pairsAsToken1: {
            include: {
              token0: true,
              token1: true
            }
          }
        }
      });
      
      if (!token) return '0';
      
      let totalTVL = 0;
      const tokenDecimals = token.decimals || 18;
      const tokenPrice = parseFloat(token.priceUSD || '0');
      
      // Process token0 pairs
      for (const pair of token.pairsAsToken0) {
        if (!pair.reserve0) continue;
        
        // Get token price - either from token object or try to calculate
        let effectivePrice = tokenPrice;
        if (effectivePrice <= 0) {
          effectivePrice = await TokenPriceService.getTokenPriceUSD(tokenId);
        }
        
        if (effectivePrice > 0) {
          const reserve = Number(formatUnits(BigInt(pair.reserve0), tokenDecimals));
          totalTVL += reserve * effectivePrice;
        }
      }
      
      // Process token1 pairs
      for (const pair of token.pairsAsToken1) {
        if (!pair.reserve1) continue;
        
        // Get token price - either from token object or try to calculate
        let effectivePrice = tokenPrice;
        if (effectivePrice <= 0) {
          effectivePrice = await TokenPriceService.getTokenPriceUSD(tokenId);
        }
        
        if (effectivePrice > 0) {
          const reserve = Number(formatUnits(BigInt(pair.reserve1), tokenDecimals));
          totalTVL += reserve * effectivePrice;
        }
      }
      
      return totalTVL.toString();
    } catch (error) {
      console.error(`Error calculating TVL for token ${tokenId}:`, error);
      return '0';
    }
  },
  
  /**
   * Calculate market cap for a token
   */
  async calculateTokenMarketCap(token: any): Promise<string> {
    try {
      // Get token price
      const tokenPrice = parseFloat(token.priceUSD || '0');
      if (tokenPrice <= 0) return '0';
      
      // Try to get supply from the supply model
      const supply = await prisma.tokenSupply.findUnique({
        where: { tokenId: token.id }
      });
      
      // If we have circulating supply data, use it for accurate calculation
      if (supply && supply.circulating) {
        const circulatingSupply = parseFloat(supply.circulating);
        const marketCap = tokenPrice * circulatingSupply;
        return marketCap.toString();
      }
      
      // Fallback to using total supply with a ratio
      if (supply && supply.total) {
        const totalSupply = parseFloat(supply.total);
        // Assume circulating is ~70% of total as fallback
        const estimatedCirculating = totalSupply * 0.7;
        const marketCap = tokenPrice * estimatedCirculating;
        return marketCap.toString();
      }
      
      // Ultimate fallback
      return (tokenPrice * 1000000).toString(); // Assume 1M token supply
    } catch (error) {
      console.error(`Error calculating market cap:`, error);
      return '0';
    }
  },
  
  /**
   * Calculate fully diluted valuation (FDV) for a token
   */
  async calculateTokenFDV(token: any): Promise<string> {
    try {
      // Get token price
      const tokenPrice = parseFloat(token.priceUSD || '0');
      if (tokenPrice <= 0) return '0';
      
      // Try to get supply from the supply model
      const supply = await prisma.tokenSupply.findUnique({
        where: { tokenId: token.id }
      });
      
      // If we have total supply data, use it for accurate calculation
      if (supply && supply.total) {
        const totalSupply = parseFloat(supply.total);
        const fdv = tokenPrice * totalSupply;
        return fdv.toString();
      }
      
      // Fallback to using marketCap * multiplier
      const marketCap = await this.calculateTokenMarketCap(token);
      const fdv = parseFloat(marketCap) * 1.5; // Assume FDV is 1.5x marketCap as fallback
      
      return fdv.toString();
    } catch (error) {
      console.error(`Error calculating FDV:`, error);
      return '0';
    }
  },
  
  /**
   * Mark metrics as dirty after a transaction to trigger recalculation
   */
  async markMetricsDirty(
    entity: { id: string, type: 'token' | 'pair' | 'protocol' }
  ): Promise<void> {
    try {
      await CacheManager.invalidate(
        CachePrefix.METRICS,
        entity.id,
        'metrics'
      );
      
      // For efficiency, also mark the protocol metrics as dirty
      // when a pair or token is updated
      if (entity.type !== 'protocol') {
        await CacheManager.invalidate(
          CachePrefix.METRICS,
          'protocol',
          'metrics'
        );
      }
    } catch (error) {
      console.error(`Error marking metrics as dirty:`, error);
    }
  },
  
  /**
   * Check if a metric is stale based on time
   */
  isMetricStale(timestamp: number | string | null, staleThreshold = CACHE_TTL.MEDIUM): boolean {
    if (!timestamp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    const metricTime = typeof timestamp === 'string' 
      ? parseInt(timestamp, 10) 
      : timestamp;
    
    return now - metricTime > staleThreshold;
  }
};

export default MetricsService; 