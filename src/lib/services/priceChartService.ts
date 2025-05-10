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

// MongoDB connection URL
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ponder";

// Get MongoDB client
const getMongoClient = async () => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
};

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
    let mongoClient = null;
    
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
        // Connect to MongoDB to fetch MetricSnapshot data
        mongoClient = await getMongoClient();
        const db = mongoClient.db();
        
        console.log(`[DEBUG] Connected to MongoDB, looking for price snapshots for token ${tokenId}`);
        
        // Query the MetricSnapshot collection for token price data
        const metricSnapshots = await db.collection("MetricSnapshot").find({
          entity: "token",
          entityId: tokenId,
          metricType: "price",
          timestamp: { $gte: fromTimestamp },
        })
        .sort({ timestamp: 1 })
        .limit(limit)
        .toArray();
        
        console.log(`[DEBUG] Found ${metricSnapshots.length} price metric snapshots for token ${token.symbol}`);
        
        if (metricSnapshots.length === 0) {
          console.log(`[DEBUG] No price metric snapshots found for token ${token.symbol}`);
          
          // Don't fall back to the old method using PriceSnapshots
          console.error(`[DEBUG] No price metrics available in MongoDB. Please run the backfill script.`);
          return [];
        }
        
        // Convert the metric snapshots to chart data points
        const dataPoints = metricSnapshots.map(snapshot => {
          try {
            const time = typeof snapshot.timestamp === 'number' 
              ? snapshot.timestamp 
              : typeof snapshot.timestamp === 'string'
                ? parseInt(snapshot.timestamp, 10) 
                : Number(snapshot.timestamp);
                
            const value = typeof snapshot.value === 'string'
              ? parseFloat(snapshot.value)
              : Number(snapshot.value);
              
            if (isNaN(time) || isNaN(value) || value <= 0) {
              console.warn(`[CHART] Invalid snapshot data: time=${time}, value=${value}`);
              return null;
            }
            
            return { time, value };
          } catch (err) {
            console.error(`[CHART] Error processing metric snapshot: ${err}`);
            return null;
          }
        }).filter(Boolean) as ChartDataPoint[];
        
        console.log(`[DEBUG] Created ${dataPoints.length} valid chart points from metric snapshots`);
        
        if (dataPoints.length === 0) {
          console.log(`[DEBUG] No valid chart points from metric snapshots`);
          
          // Don't fall back to the old method using PriceSnapshots
          console.error(`[DEBUG] No valid chart data could be created from metrics. Please run the backfill script.`);
          return [];
        }
        
        // Explicitly sort by timestamp (ascending) to ensure proper order
        const sortedData = dataPoints.sort((a, b) => Number(a.time) - Number(b.time));
        
        // Log the data range for debugging
        if (sortedData.length > 0) {
          const firstPoint = sortedData[0];
          const lastPoint = sortedData[sortedData.length - 1];
          console.log(`[DEBUG] First point: ${new Date(firstPoint.time * 1000).toISOString()} - $${firstPoint.value}`);
          console.log(`[DEBUG] Last point: ${new Date(lastPoint.time * 1000).toISOString()} - $${lastPoint.value}`);
        }
        
        return sortedData;
      } catch (error) {
        console.error('[DEBUG] Error getting chart data from MongoDB:', error);
        
        // Don't fall back to using PriceSnapshots
        console.error(`[DEBUG] Failed to fetch data from MongoDB. Please ensure the metrics data exists.`);
        return [];
      } finally {
        // Close MongoDB connection
        if (mongoClient) {
          await mongoClient.close();
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error in getTokenPriceChartData:', error);
      return [];
    }
  }
  
  /**
   * Legacy method to get price chart data from PriceSnapshot table
   * This is used as a fallback if MetricSnapshot data is not available
   */
  private static async getTokenPriceChartDataFromPriceSnapshots(
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

      // Get pair information to determine counterpart token
      const pair = await prisma.pair.findUnique({
        where: { id: pairId },
        include: {
          token0: true,
          token1: true
        }
      });
      
      if (!pair) {
        console.error(`[DEBUG] Pair ${pairId} not found`);
        return [];
      }
      
      // Get the counterpart token - the other token in the pair
      const counterpartToken = isToken0 ? pair.token1 : pair.token0;
      
      // Get the current USD price of the counterpart token
      // We need this to convert exchange rates to USD prices
      console.log(`Using actual ${counterpartToken.symbol} price from database: $${counterpartToken.priceUSD}`);
      let counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
      
      // If we don't have a stored price, try to get it from TokenPriceService
      if (!counterpartTokenPrice) {
        counterpartTokenPrice = await TokenPriceService.getTokenPriceUSD(counterpartToken.id);
        console.log(`Got ${counterpartToken.symbol} price from TokenPriceService: $${counterpartTokenPrice}`);
      }
      
      if (!counterpartTokenPrice) {
        console.error(`[DEBUG] Could not determine price for counterpart token ${counterpartToken.symbol}`);
        return [];
      }

      // Now that timestamps are stored as numbers, explicitly query by number comparison
      const snapshots = await prisma.priceSnapshot.findMany({
        where: { 
          pairId,
          timestamp: { gte: fromTimestamp } // Using numeric comparison since timestamp is stored as number
        },
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
      
      // Filter by non-null prices
      const filteredSnapshots = snapshots.filter(snapshot => {
        const relevantPrice = isToken0 ? snapshot.price0 : snapshot.price1;
        return relevantPrice !== null && 
               relevantPrice !== undefined &&
               relevantPrice !== '';
      });
      
      console.log(`[DEBUG] After filtering by non-null prices: ${filteredSnapshots.length} snapshots remain`);
      
      if (filteredSnapshots.length === 0) {
        console.log('[DEBUG] No valid snapshots remain after filtering.');
        return [];
      }
      
      // Get token decimals with fallback
      const tokenDecimals = token.decimals || 18;
      console.log(`[DEBUG] Using token decimals: ${tokenDecimals}`);
      
      // Parse and clean price values
      console.log(`[CHART] Processing ${filteredSnapshots.length} price snapshots...`);
      const dataPoints = filteredSnapshots.map((snapshot) => {
        try {
          // Get the exchange rate from the snapshot - this is NOT a USD price!
          // It's the exchange rate between the tokens in the pair
          const rawExchangeRate = isToken0 ? snapshot.price0! : snapshot.price1!;
          const exchangeRate = parseFloat(String(rawExchangeRate));
          
          if (isNaN(exchangeRate) || exchangeRate === 0) {
            console.warn(`[CHART] Invalid price value found: ${rawExchangeRate}`);
            return null;
          }

          // Ensure timestamp is treated as a number
          // This is crucial for correct sorting after conversion from string to number
          const time = typeof snapshot.timestamp === 'number' 
            ? snapshot.timestamp 
            : typeof snapshot.timestamp === 'string'
              ? parseInt(snapshot.timestamp, 10) 
              : Number(snapshot.timestamp);

          // Convert exchange rate to USD price
          let usdPrice: number;
          
          if (isToken0) {
            // If our token is token0, then price0 is the price of token0 in terms of token1
            // So we multiply by the USD price of token1
            usdPrice = exchangeRate * counterpartTokenPrice / 1e18;
          } else {
            // If our token is token1, then price1 is the price of token1 in terms of token0
            // So we multiply by the USD price of token0  
            usdPrice = exchangeRate * counterpartTokenPrice / 1e18;
          }

          return {
            time,
            value: usdPrice
          };
        } catch (err) {
          console.error(`[CHART] Error processing snapshot: ${err}`);
          return null;
        }
      }).filter(Boolean) as ChartDataPoint[];
      
      console.log(`[DEBUG] Created ${dataPoints.length} valid chart points`);
      
      if (dataPoints.length === 0) {
        console.log('[DEBUG] No valid chart points could be created');
        return [];
      }
      
      // Explicitly sort by timestamp (ascending) to ensure proper order
      // This is important now that timestamps are stored as numbers instead of strings
      console.log('[DEBUG] Sorting chart data points by timestamp (numerical sort)');
      const sortedData = dataPoints.sort((a, b) => {
        // Ensure numeric comparison
        return Number(a.time) - Number(b.time);
      });
      
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
      console.error('[DEBUG] Error getting chart data from price snapshots:', error);
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
        orderBy: [{ createdAt: 'desc' }, { reserve0: 'desc' }], // Sort by creation date and reserve amount
        include: {
          token1: { select: { symbol: true, decimals: true } }
        }
      });
      
      const pairsAsToken1 = await prisma.pair.findMany({
        where: { token1Id: tokenId },
        orderBy: [{ createdAt: 'desc' }, { reserve1: 'desc' }], // Sort by creation date and reserve amount
        include: {
          token0: { select: { symbol: true, decimals: true } }
        }
      });
      
      console.log(`[DEBUG] Found ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1`);
      
      // Use simplified approach for stablecoins (USDT, USDC, etc.)
      const isStablecoin = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'].includes(token.symbol?.toUpperCase() || '');
      
      if (isStablecoin) {
        // For stablecoins, just use highest liquidity pair
        if (pairsAsToken0.length > 0) {
          console.log(`[DEBUG] Using highest liquidity pair for stablecoin ${token.symbol} as token0: ${pairsAsToken0[0].id}`);
          return { pairId: pairsAsToken0[0].id, isToken0: true };
        }
        
        if (pairsAsToken1.length > 0) {
          console.log(`[DEBUG] Using highest liquidity pair for stablecoin ${token.symbol} as token1: ${pairsAsToken1[0].id}`);
          return { pairId: pairsAsToken1[0].id, isToken0: false };
        }
      }
      
      // For other tokens (including KKUB), prefer pairs with stablecoins
      const stablecoinSymbols = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'];
      
      // Look for pairs with stablecoins as token1
      for (const pair of pairsAsToken0) {
        if (stablecoinSymbols.includes(pair.token1.symbol?.toUpperCase() || '')) {
          console.log(`[DEBUG] Found pair with stablecoin ${pair.token1.symbol} for token ${token.symbol}`);
          return { pairId: pair.id, isToken0: true };
        }
      }
      
      // Look for pairs with stablecoins as token0
      for (const pair of pairsAsToken1) {
        if (stablecoinSymbols.includes(pair.token0.symbol?.toUpperCase() || '')) {
          console.log(`[DEBUG] Found pair with stablecoin ${pair.token0.symbol} for token ${token.symbol}`);
          return { pairId: pair.id, isToken0: false };
        }
      }
      
      // If no stablecoin pairs found, fall back to highest liquidity pair
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