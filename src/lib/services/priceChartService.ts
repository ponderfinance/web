import { formatUnits } from 'viem';
import { PrismaClient } from '@prisma/client';
import { ObjectId } from 'mongodb';
import { MongoClient } from 'mongodb';
import { TokenPriceService } from './tokenPriceService';

// Export the interface for other files to use
export interface ChartDataPoint {
  time: number;
  value: number;
}

/**
 * Service for managing token price chart data
 */
export class PriceChartService {
  /**
   * Get price chart data for a token
   * 
   * @param address Token address
   * @param tokenId Token ID in the database
   * @param timeframe Timeframe for chart data (e.g., '1d', '1w', '1m')
   * @param limit Maximum number of data points to return
   * @param prisma PrismaClient instance
   * @returns Array of chart data points
   */
  static async getTokenPriceChartData(
    address: string,
    tokenId: string,
    timeframe: string = '1d',
    limit: number = 100,
    prisma: PrismaClient
  ): Promise<ChartDataPoint[]> {
    try {
      // Find the token to get its details
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        select: {
          id: true,
          address: true,
          symbol: true,
          decimals: true,
        },
      });

      if (!token) {
        console.error(`[DEBUG] Token not found for ID: ${tokenId}`);
        return [];
      }

      console.log(`[DEBUG] Processing chart data for ${token.symbol || 'unknown token'}`);

      // Find the best pair to use for price data
      const { pairId, isToken0 } = await this.findBestPriceDataPair(tokenId, address, prisma) || {};

      if (!pairId) {
        console.error(`[DEBUG] No pairs found for token ${address}`);
        return [];
      }
      
      console.log(`[DEBUG] Using pair ${pairId}, isToken0: ${isToken0} for price chart data`);
      
      // Calculate time range based on timeframe
      const now = Math.floor(Date.now() / 1000);
      let fromTimestamp;
      
      switch (timeframe) {
        case '1h':
          fromTimestamp = now - 3600;
          break;
        case '1d':
          fromTimestamp = now - 86400;
          break;
        case '1w':
          fromTimestamp = now - 604800;
          break;
        case '1m':
          fromTimestamp = now - 2592000;
          break;
        case '1y':
          fromTimestamp = now - 31536000;
          break;
        default:
          fromTimestamp = 0; // Start from the first available snapshot
      }
      
      console.log(`[DEBUG] Time range: from ${new Date(fromTimestamp * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);

      try {
        // Get ALL snapshots for this pair regardless of time (we'll filter later)
        // This ensures we don't miss historical data
        const snapshots = await prisma.priceSnapshot.findMany({
          where: { pairId },
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            timestamp: true,
            price0: true,
            price1: true,
            blockNumber: true
          }
        });
        
        console.log(`[DEBUG] Found ${snapshots.length} total price snapshots for pair ${pairId}`);
        
        // Filter by timeframe and non-null prices
        const filteredSnapshots = snapshots.filter(snapshot => {
          const timestamp = Number(snapshot.timestamp);
          const relevantPrice = isToken0 ? snapshot.price0 : snapshot.price1;
          return timestamp >= fromTimestamp && 
                 relevantPrice !== null && 
                 relevantPrice !== undefined &&
                 relevantPrice !== '';
        });
        
        console.log(`[DEBUG] After filtering by timeframe and non-null prices: ${filteredSnapshots.length} snapshots remain`);
        
        if (filteredSnapshots.length === 0) {
          console.log('[DEBUG] No valid snapshots remain after filtering.');
          return [];
        }
        
        // Get token decimals with fallback
        const tokenDecimals = token.decimals || 18;
        console.log(`[DEBUG] Using token decimals: ${tokenDecimals}`);
        
        // Create chart points from snapshots without complex normalization
        // Instead, use direct values from snapshots which should already be correct
        const chartData: ChartDataPoint[] = filteredSnapshots.map(snapshot => {
          try {
            const timestamp = Number(snapshot.timestamp);
            const rawPrice = isToken0 ? snapshot.price0! : snapshot.price1!;
            const price = parseFloat(String(rawPrice));
            
            // Ensure value is a valid number
            if (isNaN(price) || price <= 0) {
              console.log(`[DEBUG] Skipping invalid price: ${rawPrice}`);
              return null;
            }
            
            return {
              time: timestamp,
              value: price
            };
          } catch (error) {
            console.error('[DEBUG] Error processing snapshot:', error);
            return null;
          }
        }).filter(Boolean) as ChartDataPoint[];
        
        console.log(`[DEBUG] Created ${chartData.length} valid chart points`);
        
        if (chartData.length === 0) {
          console.log('[DEBUG] No valid chart points could be created');
          return [];
        }
        
        // Sort by timestamp (ascending)
        const sortedData = chartData.sort((a, b) => a.time - b.time);
        
        // Apply a limit if specified
        const limitedData = limit > 0 ? sortedData.slice(0, limit) : sortedData;
        
        console.log(`[DEBUG] Final chart data has ${limitedData.length} points`);
        if (limitedData.length > 0) {
          const firstPoint = limitedData[0];
          const lastPoint = limitedData[limitedData.length - 1];
          console.log(`[DEBUG] First point: ${new Date(firstPoint.time * 1000).toISOString()} - ${firstPoint.value}`);
          console.log(`[DEBUG] Last point: ${new Date(lastPoint.time * 1000).toISOString()} - ${lastPoint.value}`);
        }
        
        return limitedData;
        
      } catch (error) {
        console.error('[DEBUG] Error getting chart data:', error);
        return [];
      }
    } catch (error) {
      console.error('[DEBUG] Error in getTokenPriceChartData:', error);
      return [];
    }
  }

  /**
   * Find the best trading pair to use for price chart data
   */
  static async findBestPriceDataPair(
    tokenId: string,
    tokenAddress: string,
    prisma: PrismaClient
  ): Promise<{ pairId: string; isToken0: boolean } | null> {
    try {
      console.log(`[DEBUG] Finding best pair for token ${tokenId} (${tokenAddress})`);
      
      // Get token information
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        select: {
          symbol: true,
          decimals: true
        }
      });
      
      if (!token) {
        console.error(`[DEBUG] Token not found: ${tokenId}`);
        return null;
      }
      
      // Find all pairs where this token is involved
      const pairsAsToken0 = await prisma.pair.findMany({
        where: { token0Id: tokenId },
        orderBy: { reserve1: 'desc' },
        include: {
          token1: { select: { symbol: true, decimals: true } }
        }
      });
      
      const pairsAsToken1 = await prisma.pair.findMany({
        where: { token1Id: tokenId },
        orderBy: { reserve0: 'desc' },
        include: {
          token0: { select: { symbol: true, decimals: true } }
        }
      });
      
      console.log(`[DEBUG] Found ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1`);
      
      // Special handling for important tokens
      const isStablecoin = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'].includes(token.symbol?.toUpperCase() || '');
      const isMainToken = token.symbol?.toUpperCase() === 'KKUB';
      
      // For stablecoins, prefer pairs with KKUB
      if (isStablecoin) {
        console.log(`[DEBUG] Token ${token.symbol} is a stablecoin, looking for KKUB pairs`);
        
        // Look for pairs with KKUB as token0
        for (const pair of pairsAsToken1) {
          if (pair.token0.symbol?.toUpperCase() === 'KKUB') {
            console.log(`[DEBUG] Found KKUB/${token.symbol} pair: ${pair.id}`);
            return { pairId: pair.id, isToken0: false };
          }
        }
        
        // Look for pairs with KKUB as token1
        for (const pair of pairsAsToken0) {
          if (pair.token1.symbol?.toUpperCase() === 'KKUB') {
            console.log(`[DEBUG] Found ${token.symbol}/KKUB pair: ${pair.id}`);
            return { pairId: pair.id, isToken0: true };
          }
        }
      }
      
      // For KKUB, prefer pairs with stablecoins
      if (isMainToken) {
        console.log(`[DEBUG] Token is KKUB, looking for stablecoin pairs`);
        
        const stablecoinSymbols = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'];
        
        // Look for pairs with stablecoins as token1
        for (const pair of pairsAsToken0) {
          if (stablecoinSymbols.includes(pair.token1.symbol?.toUpperCase() || '')) {
            console.log(`[DEBUG] Found KKUB/${pair.token1.symbol} pair: ${pair.id}`);
            return { pairId: pair.id, isToken0: true };
          }
        }
        
        // Look for pairs with stablecoins as token0
        for (const pair of pairsAsToken1) {
          if (stablecoinSymbols.includes(pair.token0.symbol?.toUpperCase() || '')) {
            console.log(`[DEBUG] Found ${pair.token0.symbol}/KKUB pair: ${pair.id}`);
            return { pairId: pair.id, isToken0: false };
          }
        }
      }
      
      // For regular tokens, use the pair with highest liquidity
      if (pairsAsToken0.length > 0) {
        console.log(`[DEBUG] Using highest liquidity pair as token0: ${pairsAsToken0[0].id}`);
        return { pairId: pairsAsToken0[0].id, isToken0: true };
      }
      
      if (pairsAsToken1.length > 0) {
        console.log(`[DEBUG] Using highest liquidity pair as token1: ${pairsAsToken1[0].id}`);
        return { pairId: pairsAsToken1[0].id, isToken0: false };
      }
      
      console.error(`[DEBUG] No pairs found for token ${tokenId}`);
      return null;
    } catch (error) {
      console.error('[DEBUG] Error finding best price data pair:', error);
      return null;
    }
  }
} 