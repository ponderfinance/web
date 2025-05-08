#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');
const dotenv = require('dotenv');

// Configure environment variables
dotenv.config();

// Create Prisma client
const prisma = new PrismaClient();

// KOI token address (updated with the correct address from the database)
const KOI_ADDRESS = '0xe0432224871917fb5a137f4a153a51ecf9f74f57'.toLowerCase();

/**
 * Function to analyze KOI price data and chart information
 */
async function diagnoseKoiChartData() {
  console.log('\n=== KOI Chart Data Diagnosis Tool ===');
  console.log('Analyzing price data for KOI token...');
  
  try {
    // Step 1: Get token information
    console.log('\nStep 1: Getting KOI token information...');
    const koiToken = await prisma.token.findFirst({
      where: { address: KOI_ADDRESS },
      select: {
        id: true,
        name: true,
        symbol: true,
        decimals: true,
        priceUSD: true,
        priceChange24h: true
      }
    });
    
    if (!koiToken) {
      console.error('KOI token not found in database!');
      return;
    }
    
    console.log(`Found KOI token: ${koiToken.name} (${koiToken.symbol})`);
    console.log(`ID: ${koiToken.id}`);
    console.log(`Decimals: ${koiToken.decimals}`);
    console.log(`Current price: $${koiToken.priceUSD}`);
    console.log(`24h price change: ${koiToken.priceChange24h}%`);
    
    // Step 2: Find pairs with KOI
    console.log('\nStep 2: Finding pairs containing KOI...');
    const koiPairs = await prisma.pair.findMany({
      where: {
        OR: [
          { token0Id: koiToken.id },
          { token1Id: koiToken.id }
        ]
      },
      include: {
        token0: { select: { symbol: true, decimals: true, address: true } },
        token1: { select: { symbol: true, decimals: true, address: true } }
      }
    });
    
    console.log(`Found ${koiPairs.length} pairs with KOI token`);
    
    if (koiPairs.length === 0) {
      console.error('No pairs found for KOI token!');
      return;
    }
    
    for (const pair of koiPairs) {
      const isToken0 = pair.token0Id === koiToken.id;
      console.log(`\nPair: ${isToken0 ? pair.token0.symbol : pair.token1.symbol}/${isToken0 ? pair.token1.symbol : pair.token0.symbol}`);
      console.log(`Pair ID: ${pair.id}`);
      console.log(`Address: ${pair.address}`);
      console.log(`KOI is token${isToken0 ? '0' : '1'}`);
      
      // Step 3: Analyze price snapshots for this pair
      console.log(`\nAnalyzing price snapshots for ${pair.token0.symbol}/${pair.token1.symbol}...`);
      const priceSnapshots = await prisma.priceSnapshot.findMany({
        where: { pairId: pair.id },
        orderBy: { timestamp: 'desc' },
        take: 50
      });
      
      console.log(`Found ${priceSnapshots.length} price snapshots`);
      
      if (priceSnapshots.length === 0) {
        console.log('No price snapshots found for this pair.');
        continue;
      }
      
      // Display sample of price snapshots
      console.log('\nSample of recent price snapshots:');
      for (let i = 0; i < Math.min(5, priceSnapshots.length); i++) {
        const snapshot = priceSnapshots[i];
        const timestamp = new Date(Number(snapshot.timestamp) * 1000);
        const priceField = isToken0 ? 'price0' : 'price1';
        const rawPrice = snapshot[priceField];
        
        console.log(`[${timestamp.toISOString()}]`);
        console.log(`  Raw price: ${rawPrice} (type: ${typeof rawPrice})`);
        
        if (rawPrice) {
          // Try to parse the price value
          try {
            const parsedPrice = parseFloat(rawPrice);
            console.log(`  Parsed price: ${parsedPrice}`);
            
            // Check if price looks like raw blockchain value (large number)
            if (parsedPrice > 1e12) {
              // Attempt to format using token decimals
              const counterpartDecimals = isToken0 ? pair.token1.decimals : pair.token0.decimals;
              const formattedPrice = Number(formatUnits(BigInt(Math.floor(parsedPrice)), counterpartDecimals));
              console.log(`  Formatted price (with decimals = ${counterpartDecimals}): ${formattedPrice}`);
            }
          } catch (err) {
            console.log(`  Error parsing price: ${err.message}`);
          }
        } else {
          console.log(`  Price is ${rawPrice} (null, undefined, or empty string)`);
        }
      }
      
      // Step 4: Simulate chart data creation for this pair
      console.log('\nSimulating chart data creation...');
      
      // Find the counterpart token's current price (for converting to USD)
      const counterpartToken = isToken0 ? pair.token1 : pair.token0;
      const counterpartTokenDetails = await prisma.token.findUnique({
        where: { id: isToken0 ? pair.token1Id : pair.token0Id },
        select: { priceUSD: true }
      });
      
      const counterpartTokenPrice = parseFloat(counterpartTokenDetails?.priceUSD || '0');
      console.log(`Counterpart token (${counterpartToken.symbol}) price: $${counterpartTokenPrice}`);
      
      // Generate chart data points
      const chartData = priceSnapshots.map(snapshot => {
        try {
          // Get the raw exchange rate
          const rawExchangeRate = isToken0 ? snapshot.price0 : snapshot.price1;
          
          if (!rawExchangeRate) {
            return { time: Number(snapshot.timestamp), value: null, error: 'Missing price value' };
          }
          
          const exchangeRate = parseFloat(String(rawExchangeRate));
          
          if (isNaN(exchangeRate) || exchangeRate === 0) {
            return { time: Number(snapshot.timestamp), value: null, error: 'Invalid price value' };
          }
          
          // Convert to USD price
          let usdPrice = exchangeRate * counterpartTokenPrice;
          
          // Check if this looks like a raw blockchain value (needs decimals formatting)
          if (usdPrice > 1e6) {
            try {
              const counterpartDecimals = isToken0 ? pair.token1.decimals : pair.token0.decimals;
              usdPrice = Number(formatUnits(BigInt(Math.floor(exchangeRate)), counterpartDecimals)) * counterpartTokenPrice;
            } catch (err) {
              return { 
                time: Number(snapshot.timestamp), 
                value: null, 
                error: `Decimal formatting error: ${err.message}` 
              };
            }
          }
          
          return {
            time: Number(snapshot.timestamp),
            value: usdPrice,
            raw: exchangeRate
          };
        } catch (err) {
          return { 
            time: Number(snapshot.timestamp), 
            value: null, 
            error: `Processing error: ${err.message}` 
          };
        }
      }).filter(point => point.value !== null)
        .sort((a, b) => a.time - b.time);
      
      // Analyze chart data for anomalies
      console.log(`\nGenerated ${chartData.length} chart data points`);
      
      if (chartData.length > 0) {
        // Find min, max, average values
        const values = chartData.map(point => point.value).filter(v => v !== null);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        console.log(`Value range: min=${minValue}, max=${maxValue}, avg=${avgValue}`);
        
        // Check for extreme outliers
        const standardDev = Math.sqrt(
          values.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / values.length
        );
        
        const outliers = chartData.filter(point => {
          if (point.value === null) return false;
          return Math.abs(point.value - avgValue) > standardDev * 3;
        });
        
        console.log(`Found ${outliers.length} outliers (> 3 standard deviations from mean)`);
        
        if (outliers.length > 0) {
          console.log('\nSample outliers:');
          outliers.slice(0, 3).forEach(point => {
            console.log(`Time: ${new Date(point.time * 1000).toISOString()}, Value: ${point.value}, Raw: ${point.raw}`);
          });
        }
        
        // Display sample of chart data points
        console.log('\nSample chart data points:');
        for (let i = 0; i < Math.min(5, chartData.length); i++) {
          const point = chartData[i];
          console.log(`Time: ${new Date(point.time * 1000).toISOString()}`);
          console.log(`Value: ${point.value}, Raw: ${point.raw}`);
        }
      } else {
        console.log('No valid chart data points generated!');
      }
    }
    
    console.log('\n=== KOI Chart Data Diagnosis Complete ===');
    
  } catch (error) {
    console.error('Error diagnosing KOI chart data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
diagnoseKoiChartData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 