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
      console.log(`[DEBUG] Fetching price chart for token: ${address}, tokenId: ${tokenId}, timeframe: ${timeframe}, limit: ${limit}`);
      
      // Normalize address
      const normalizedAddress = address.toLowerCase();
      
      // Find token info
      const token = await prisma.token.findFirst({
        where: { address: normalizedAddress },
        select: {
          id: true,
          symbol: true,
          decimals: true,
          pairsAsToken0: true,
          pairsAsToken1: true
        }
      });

      if (!token) {
        console.error(`[DEBUG] Token not found: ${address}`);
        return [];
      }

      console.log(`[DEBUG] Found token: ${token.symbol}, id: ${token.id}`);
      console.log(`[DEBUG] Number of pairs: pairsAsToken0=${token.pairsAsToken0?.length || 0}, pairsAsToken1=${token.pairsAsToken1?.length || 0}`);
      
      // Determine time window based on timeframe
      const now = Math.floor(Date.now() / 1000);
      let fromTimestamp: number;
      let timeWindow: number;
      
      switch (timeframe.toLowerCase()) {
        case '1h':
          fromTimestamp = now - 3600; // 1 hour
          timeWindow = 3600;
          break;
        case '1d':
          fromTimestamp = now - 86400; // 1 day
          timeWindow = 86400;
          break;
        case '1w':
          fromTimestamp = now - 604800; // 1 week
          timeWindow = 604800;
          break;
        case '1m':
          fromTimestamp = now - 2592000; // 30 days
          timeWindow = 2592000;
          break;
        case '1y':
          fromTimestamp = now - 31536000; // 365 days
          timeWindow = 31536000;
          break;
        default:
          fromTimestamp = now - 86400; // Default to 1 day
          timeWindow = 86400;
      }
      
      console.log(`[DEBUG] Using time range: ${new Date(fromTimestamp * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);
      
      // Find the best pair for price data from token's relationships
      let pairId: string | null = null;
      let isToken0: boolean = false;
      
      // Try to find a pair from token relationships
      if (token.pairsAsToken0 && token.pairsAsToken0.length > 0) {
        pairId = token.pairsAsToken0[0].id;
        isToken0 = true;
        console.log(`[DEBUG] Using pair from token.pairsAsToken0: ${pairId}`);
      } else if (token.pairsAsToken1 && token.pairsAsToken1.length > 0) {
        pairId = token.pairsAsToken1[0].id;
        isToken0 = false;
        console.log(`[DEBUG] Using pair from token.pairsAsToken1: ${pairId}`);
      } else {
        // If token's relationships are empty, search for pairs directly in the DB
        console.log(`[DEBUG] No pairs found in token relationships, searching in DB directly`);
        
        const pairsAsToken0 = await prisma.pair.findMany({
          where: { token0Id: tokenId },
          take: 1,
          orderBy: { createdAt: 'desc' }
        });
        
        if (pairsAsToken0.length > 0) {
          pairId = pairsAsToken0[0].id;
          isToken0 = true;
          console.log(`[DEBUG] Found pair for token0 from DB: ${pairId}`);
        } else {
          const pairsAsToken1 = await prisma.pair.findMany({
            where: { token1Id: tokenId },
            take: 1,
            orderBy: { createdAt: 'desc' }
          });
          
          if (pairsAsToken1.length > 0) {
            pairId = pairsAsToken1[0].id;
            isToken0 = false;
            console.log(`[DEBUG] Found pair for token1 from DB: ${pairId}`);
          }
        }
      }
      
      if (!pairId) {
        console.error(`[DEBUG] No pairs found for token ${address}`);
        return [];
      }
      
      console.log(`[DEBUG] Using pair ${pairId}, isToken0: ${isToken0} for price chart data`);
      
      // Get price snapshots for the pair
      console.log(`[DEBUG] Querying price snapshots with pairId: ${pairId}, timestamp >= ${fromTimestamp}`);
      
      // Declare processedSnapshots variable
      let processedSnapshots: any[] = [];

      try {
        // For MongoDB provider, we need to handle filtering differently
        // First, get all snapshots without the NULL filter
        const snapshots = await prisma.priceSnapshot.findMany({
          where: {
            pairId: pairId,
            timestamp: { gte: fromTimestamp }
          },
          orderBy: { timestamp: 'asc' },
          take: limit * 2 // Get more to account for filtering
        });
        
        console.log(`[DEBUG] Found ${snapshots.length} total price snapshots for pair ${pairId}`);
        
        // Then filter out NULL values in memory
        const filteredSnapshots = snapshots.filter(snapshot => 
          isToken0 ? snapshot.price0 != null : snapshot.price1 != null
        );
        
        console.log(`[DEBUG] After filtering NULL prices: ${filteredSnapshots.length} valid snapshots`);
        
        if (filteredSnapshots.length === 0) {
          // If no snapshots found in the timeframe with non-NULL prices,
          // try to get the most recent ones instead
          console.log('[DEBUG] No snapshots found in the requested timeframe with valid prices. Trying to get the most recent ones...');
          
          const recentSnapshots = await prisma.priceSnapshot.findMany({
            where: { pairId: pairId },
            orderBy: { timestamp: 'desc' },
            take: limit * 2 // Get more to account for filtering
          });
          
          // Filter out NULL values
          const filteredRecent = recentSnapshots.filter(snapshot => 
            isToken0 ? snapshot.price0 != null : snapshot.price1 != null
          );
          
          console.log(`[DEBUG] Found ${filteredRecent.length} recent price snapshots with non-NULL prices`);
          
          // Sort by timestamp ascending like the original query
          processedSnapshots = filteredRecent.sort((a, b) => a.timestamp - b.timestamp).slice(0, limit);
        } else {
          processedSnapshots = filteredSnapshots.slice(0, limit);
        }
        
        // Log first few snapshots for debugging
        if (processedSnapshots.length > 0) {
          console.log(`[DEBUG] First snapshot: ${JSON.stringify(processedSnapshots[0])}`);
          if (processedSnapshots.length > 1) {
            console.log(`[DEBUG] Second snapshot: ${JSON.stringify(processedSnapshots[1])}`);
          }
        }
        
        // Get token decimals - default to 18 if not specified
        const tokenDecimals = token.decimals || 18;
        console.log(`[DEBUG] Using token decimals: ${tokenDecimals} for normalization`);
        
        // Process snapshots and normalize prices directly using viem
        const chartData: ChartDataPoint[] = processedSnapshots
          .map(snapshot => {
            try {
              // Get raw price from the snapshot
              const rawPrice = isToken0 
                ? snapshot.price0?.toString() || '0' 
                : snapshot.price1?.toString() || '0';
              
              // Parse the price to a float
              const parsedPrice = parseFloat(rawPrice);
              
              // Skip invalid values
              if (isNaN(parsedPrice) || parsedPrice <= 0) {
                return null;
              }
              
              // For very small values that might be already normalized, use them directly
              if (parsedPrice < 0.000001) {
                return {
                  time: Math.floor(Number(snapshot.timestamp)),
                  value: Math.max(0.000001, parsedPrice) // Ensure minimum displayable value
                };
              }
              
              // For larger values that might represent blockchain values, normalize them
              // Try safest approach first - if the number is too large for BigInt, fall back to Math.pow
              let normalizedPrice: number;
              try {
                normalizedPrice = parseFloat(formatUnits(BigInt(Math.round(parsedPrice)), tokenDecimals));
              } catch (error) {
                // Fallback for very large numbers
                normalizedPrice = parsedPrice / Math.pow(10, tokenDecimals);
              }
              
              // Ensure the value isn't too small to display properly
              if (normalizedPrice > 0 && normalizedPrice < 0.000001) {
                normalizedPrice = 0.000001; // Minimum displayable value
              }
              
              return {
                time: Math.floor(Number(snapshot.timestamp)),
                value: normalizedPrice
              };
            } catch (error) {
              console.error(`[DEBUG] Error processing price snapshot: ${error}`);
              return null;
            }
          })
          .filter(Boolean) as ChartDataPoint[]; // Remove null values
        
        console.log(`[DEBUG] Generated ${chartData.length} chart data points after processing`);
        
        // Log sample of processed data
        if (chartData.length > 0) {
          console.log(`[DEBUG] Processed data sample: ${JSON.stringify(chartData.slice(0, 3))}`);
        }
        
        // Add log for final chart data
        console.log(`[DEBUG] Final chart data contains ${chartData.length} points`);
        if (chartData.length > 0) {
          console.log(`[DEBUG] Sample chart data: ${JSON.stringify(chartData.slice(0, 3))}`);
        }
        
        // Final formatting pass to ensure no exponential notation in the values
        const formattedChartData = chartData.map(point => ({
          time: point.time,
          // Format small values to avoid exponential notation, then parse back to number
          value: parseFloat(point.value.toFixed(12))
        }));
        
        return formattedChartData;
      } catch (error) {
        console.error('[DEBUG] Error querying price snapshots:', error);
        
        // Fallback to an alternative approach if the where clause fails
        console.log('[DEBUG] Trying alternative approach to filter out NULL prices...');
        
        // Get all snapshots and filter in memory
        const allSnapshots = await prisma.priceSnapshot.findMany({
          where: {
            pairId: pairId,
            timestamp: { gte: fromTimestamp }
          },
          orderBy: { timestamp: 'asc' },
          take: limit * 2 // Get more to account for filtering
        });
        
        console.log(`[DEBUG] Found ${allSnapshots.length} total snapshots (may include NULL prices)`);
        
        // Filter snapshots with valid prices
        const filteredSnapshots = allSnapshots.filter(snapshot => 
          isToken0 ? snapshot.price0 != null : snapshot.price1 != null
        );
        
        console.log(`[DEBUG] After filtering NULL prices: ${filteredSnapshots.length} valid snapshots`);
        
        if (filteredSnapshots.length === 0) {
          // If still no valid snapshots, try to get recent ones without time constraint
          console.log('[DEBUG] No valid snapshots in timeframe, trying to get most recent valid ones...');
          
          const recentSnapshots = await prisma.priceSnapshot.findMany({
            where: { pairId: pairId },
            orderBy: { timestamp: 'desc' },
            take: limit * 2 // Get more to account for filtering
          });
          
          const filteredRecent = recentSnapshots.filter(snapshot => 
            isToken0 ? snapshot.price0 != null : snapshot.price1 != null
          );
          
          console.log(`[DEBUG] Found ${filteredRecent.length} recent snapshots with valid prices`);
          
          // Sort by timestamp ascending like the original query
          processedSnapshots = filteredRecent.sort((a, b) => a.timestamp - b.timestamp).slice(0, limit);
        } else {
          processedSnapshots = filteredSnapshots.slice(0, limit);
        }
        
        // Get token decimals - default to 18 if not specified
        const tokenDecimals = token.decimals || 18;
        console.log(`[DEBUG] Using token decimals: ${tokenDecimals} for normalization in fallback path`);
        
        // Process snapshots and normalize prices directly using viem
        const chartData: ChartDataPoint[] = processedSnapshots
          .map(snapshot => {
            try {
              // Get raw price from the snapshot
              const rawPrice = isToken0 
                ? snapshot.price0?.toString() || '0' 
                : snapshot.price1?.toString() || '0';
              
              // Parse the price to a float
              const parsedPrice = parseFloat(rawPrice);
              
              // Skip invalid values
              if (isNaN(parsedPrice) || parsedPrice <= 0) {
                return null;
              }
              
              // For very small values that might be already normalized, use them directly
              if (parsedPrice < 0.000001) {
                return {
                  time: Math.floor(Number(snapshot.timestamp)),
                  value: Math.max(0.000001, parsedPrice) // Ensure minimum displayable value
                };
              }
              
              // For larger values that might represent blockchain values, normalize them
              // Try safest approach first - if the number is too large for BigInt, fall back to Math.pow
              let normalizedPrice: number;
              try {
                normalizedPrice = parseFloat(formatUnits(BigInt(Math.round(parsedPrice)), tokenDecimals));
              } catch (error) {
                // Fallback for very large numbers
                normalizedPrice = parsedPrice / Math.pow(10, tokenDecimals);
              }
              
              // Ensure the value isn't too small to display properly
              if (normalizedPrice > 0 && normalizedPrice < 0.000001) {
                normalizedPrice = 0.000001; // Minimum displayable value
              }
              
              return {
                time: Math.floor(Number(snapshot.timestamp)),
                value: normalizedPrice
              };
            } catch (error) {
              console.error(`[DEBUG] Error processing price snapshot in fallback path: ${error}`);
              return null;
            }
          })
          .filter(Boolean) as ChartDataPoint[]; // Remove null values
        
        console.log(`[DEBUG] Generated ${chartData.length} chart data points from fallback path`);
        
        // Log sample of processed data
        if (chartData.length > 0) {
          console.log(`[DEBUG] Fallback processed data sample: ${JSON.stringify(chartData.slice(0, 3))}`);
        }
        
        // Add log for final chart data
        console.log(`[DEBUG] Final chart data contains ${chartData.length} points`);
        if (chartData.length > 0) {
          console.log(`[DEBUG] Sample chart data: ${JSON.stringify(chartData.slice(0, 3))}`);
        }
        
        // Final formatting pass to ensure no exponential notation in the values
        const formattedChartData = chartData.map(point => ({
          time: point.time,
          // Format small values to avoid exponential notation, then parse back to number
          value: parseFloat(point.value.toFixed(12))
        }));
        
        return formattedChartData;
      }
    } catch (error) {
      console.error('[DEBUG] Error in getTokenPriceChartData:', error);
      return [];
    }
  }
} 