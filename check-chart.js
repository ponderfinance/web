const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simple version that directly queries price snapshots
async function checkChartData() {
  try {
    console.log('Checking token chart data...');
    
    // Get some tokens
    const tokens = await prisma.token.findMany({
      take: 3,
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    if (tokens.length === 0) {
      console.log('No tokens found in database');
      return;
    }
    
    // Check each token's chart data
    for (const token of tokens) {
      console.log(`\nChecking chart data for ${token.symbol || token.address.slice(0, 8)}...`);
      
      // Check for each timeframe
      const timeframes = ['1h', '1d', '1w', '1m'];
      
      for (const timeframe of timeframes) {
        console.log(`\nTimeframe: ${timeframe}`);
        
        try {
          // Determine time window based on timeframe
          const now = Math.floor(Date.now() / 1000);
          let fromTimestamp;
          
          switch (timeframe.toLowerCase()) {
            case '1h':
              fromTimestamp = now - 3600; // 1 hour
              break;
            case '1d':
              fromTimestamp = now - 86400; // 1 day
              break;
            case '1w':
              fromTimestamp = now - 604800; // 1 week
              break;
            case '1m':
              fromTimestamp = now - 2592000; // 30 days
              break;
            default:
              fromTimestamp = now - 86400; // Default to 1 day
          }
          
          // Find pairs containing this token
          const pairs = await prisma.pair.findMany({
            where: {
              OR: [
                { token0Id: token.id },
                { token1Id: token.id }
              ]
            },
            include: {
              token0: {
                select: {
                  id: true,
                  symbol: true,
                  decimals: true,
                  priceUSD: true
                }
              },
              token1: {
                select: {
                  id: true,
                  symbol: true,
                  decimals: true,
                  priceUSD: true
                }
              }
            }
          });
          
          console.log(`Found ${pairs.length} pairs for ${token.symbol || token.address.slice(0, 8)}`);
          
          if (pairs.length === 0) {
            console.log('No pairs found, cannot generate chart data');
            continue;
          }
          
          // Get price snapshots for each pair
          let allSnapshots = [];
          
          for (const pair of pairs) {
            const isToken0 = pair.token0Id === token.id;
            const counterToken = isToken0 ? pair.token1 : pair.token0;
            
            console.log(`Checking pair with ${counterToken.symbol || counterToken.id}`);
            
            if (!counterToken.priceUSD || parseFloat(counterToken.priceUSD) === 0) {
              console.log(`Counterpart token has no price, skipping pair`);
              continue;
            }
            
            const priceSnapshots = await prisma.priceSnapshot.findMany({
              where: {
                pairId: pair.id,
                timestamp: { gte: BigInt(fromTimestamp) }
              },
              orderBy: { timestamp: 'asc' },
              take: 100
            });
            
            console.log(`Found ${priceSnapshots.length} snapshots for this pair`);
            
            if (priceSnapshots.length === 0) {
              continue;
            }
            
            // Process snapshots to get prices in USD
            const processedSnapshots = priceSnapshots.map(snapshot => {
              const rawPrice = isToken0 ? snapshot.price0 : snapshot.price1;
              
              if (!rawPrice) {
                return null;
              }
              
              try {
                // Parse the price
                const price = parseFloat(rawPrice);
                if (isNaN(price) || price <= 0) {
                  return null;
                }
                
                // Calculate price in USD using counterpart token's price
                const counterpartPriceUSD = parseFloat(counterToken.priceUSD);
                let priceUSD;
                
                if (isToken0) {
                  // If our token is token0, price0 represents how much of token1 for 1 token0
                  priceUSD = price * counterpartPriceUSD;
                } else {
                  // If our token is token1, price1 represents how much of token0 for 1 token1
                  priceUSD = counterpartPriceUSD / price;
                }
                
                return {
                  timestamp: Number(snapshot.timestamp),
                  value: priceUSD
                };
              } catch (error) {
                return null;
              }
            }).filter(Boolean);
            
            allSnapshots = [...allSnapshots, ...processedSnapshots];
          }
          
          if (allSnapshots.length === 0) {
            console.log('No valid price data found');
            continue;
          }
          
          // Sort all snapshots by timestamp
          allSnapshots.sort((a, b) => a.timestamp - b.timestamp);
          
          // Group by time intervals for the chart
          const chartData = [];
          let interval;
          
          switch (timeframe) {
            case '1h':
              interval = 60; // 1 minute intervals
              break;
            case '1d':
              interval = 3600; // 1 hour intervals
              break;
            case '1w':
              interval = 86400; // 1 day intervals
              break;
            case '1m':
              interval = 86400; // 1 day intervals
              break;
            default:
              interval = 3600; // Default to hourly
          }
          
          // Group data points into intervals
          const intervalMap = new Map();
          allSnapshots.forEach(snapshot => {
            const intervalKey = Math.floor(snapshot.timestamp / interval) * interval;
            if (!intervalMap.has(intervalKey)) {
              intervalMap.set(intervalKey, []);
            }
            intervalMap.get(intervalKey).push(snapshot.value);
          });
          
          // Calculate average price for each interval
          for (const [time, values] of intervalMap.entries()) {
            const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
            chartData.push({
              time,
              value: avgValue
            });
          }
          
          console.log(`Generated ${chartData.length} chart data points`);
          
          if (chartData.length > 0) {
            console.log('Sample data points:');
            const sampleData = chartData.slice(0, 3).map(point => ({
              time: new Date(point.time * 1000).toISOString(),
              value: point.value
            }));
            console.log(JSON.stringify(sampleData, null, 2));
          }
        } catch (error) {
          console.error(`Error getting chart data for timeframe ${timeframe}:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking chart data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChartData(); 