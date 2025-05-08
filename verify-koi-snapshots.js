#!/usr/bin/env node

/**
 * Script to verify the recreated KOI price snapshots
 * This checks that the price data matches the expected values
 */

const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');
const dotenv = require('dotenv');

// Configure environment variables
dotenv.config();

// Create Prisma client
const prisma = new PrismaClient();

// KOI token address
const KOI_ADDRESS = '0xe0432224871917fb5a137f4a153a51ecf9f74f57'.toLowerCase();

/**
 * Function to verify the recreated KOI price snapshots
 */
async function verifyKoiPriceSnapshots() {
  console.log('\n=== KOI Price Snapshots Verification ===');
  console.log('Verifying the recreated price snapshots for KOI token');
  
  try {
    // Get KOI token information
    console.log('\nGetting KOI token information...');
    const koiToken = await prisma.token.findFirst({
      where: { address: KOI_ADDRESS },
      select: {
        id: true,
        name: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    if (!koiToken) {
      console.error('KOI token not found in database!');
      return;
    }
    
    console.log(`Found KOI token: ${koiToken.name} (${koiToken.symbol})`);
    console.log(`Current price: $${koiToken.priceUSD}`);
    
    // Find KOI pairs
    console.log('\nFinding pairs for KOI token...');
    const koiPairs = await prisma.pair.findMany({
      where: {
        OR: [
          { token0Id: koiToken.id },
          { token1Id: koiToken.id }
        ]
      },
      include: {
        token0: { select: { id: true, symbol: true, decimals: true, priceUSD: true } },
        token1: { select: { id: true, symbol: true, decimals: true, priceUSD: true } }
      }
    });
    
    if (koiPairs.length === 0) {
      console.log('No pairs found for KOI token.');
      return;
    }
    
    console.log(`Found ${koiPairs.length} pairs with KOI token`);
    
    // Process each pair
    for (const pair of koiPairs) {
      // Determine if KOI is token0 or token1 in this pair
      const isToken0 = pair.token0Id === koiToken.id;
      const counterpartToken = isToken0 ? pair.token1 : pair.token0;
      
      console.log(`\nPair: ${pair.token0.symbol}/${pair.token1.symbol}`);
      console.log(`Pair ID: ${pair.id}`);
      console.log(`Address: ${pair.address}`);
      console.log(`KOI is token${isToken0 ? '0' : '1'}`);
      console.log(`Counterpart token: ${counterpartToken.symbol} (price: $${counterpartToken.priceUSD})`);
      
      // Get the most recent price snapshots
      console.log(`\nFetching recent price snapshots...`);
      const priceSnapshots = await prisma.priceSnapshot.findMany({
        where: { pairId: pair.id },
        orderBy: { timestamp: 'desc' },
        take: 30
      });
      
      if (priceSnapshots.length === 0) {
        console.log('No price snapshots found for this pair.');
        continue;
      }
      
      console.log(`Found ${priceSnapshots.length} price snapshots`);
      
      // Examine the snapshot data and calculate the prices
      console.log('\nAnalyzing price snapshots:');
      console.log('Timestamp                  | Raw Exchange Rate | Calculated Price');
      console.log('---------------------------|-------------------|----------------');
      
      for (const snapshot of priceSnapshots) {
        // Get the timestamp
        const timestamp = new Date(Number(snapshot.timestamp) * 1000);
        
        // Get the raw exchange rate for KOI
        const exchangeRate = isToken0 ? snapshot.price0 : snapshot.price1;
        
        if (!exchangeRate) {
          console.log(`${timestamp.toISOString()} | N/A                | N/A`);
          continue;
        }
        
        // Parse the exchange rate
        const parsedExchangeRate = parseFloat(String(exchangeRate));
        
        // Format with proper decimals
        const counterpartDecimals = counterpartToken.decimals || 18;
        const tokenDecimals = koiToken.decimals || 18;
        const decimalPlaces = isToken0 ? counterpartDecimals : tokenDecimals;
        
        // Format the exchange rate
        let formattedExchangeRate;
        try {
          const valueBigInt = BigInt(String(parsedExchangeRate).split('.')[0]);
          formattedExchangeRate = Number(formatUnits(valueBigInt, decimalPlaces));
        } catch (err) {
          formattedExchangeRate = parsedExchangeRate / Math.pow(10, decimalPlaces);
        }
        
        // Calculate the USD price
        const counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
        const calculatedPrice = formattedExchangeRate * counterpartTokenPrice;
        
        // Check if the price is in the expected range (roughly $0.0003)
        const isNearExpected = calculatedPrice >= 0.0001 && calculatedPrice <= 0.002;
        const status = isNearExpected ? '✓' : '✗';
        
        // Display the data
        console.log(`${timestamp.toISOString()} | ${formattedExchangeRate.toExponential(5)} | $${calculatedPrice.toFixed(8)} ${status}`);
      }
      
      // Display KOI price over time chart (ASCII art)
      console.log('\nKOI Price History (recent snapshots):');
      
      // Sort by timestamp ascending for the chart
      const sortedSnapshots = [...priceSnapshots].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
      
      // Calculate prices for the chart
      const prices = sortedSnapshots.map(snapshot => {
        const exchangeRate = isToken0 ? snapshot.price0 : snapshot.price1;
        if (!exchangeRate) return null;
        
        const parsedExchangeRate = parseFloat(String(exchangeRate));
        const counterpartDecimals = counterpartToken.decimals || 18;
        const tokenDecimals = koiToken.decimals || 18;
        const decimalPlaces = isToken0 ? counterpartDecimals : tokenDecimals;
        
        let formattedExchangeRate;
        try {
          const valueBigInt = BigInt(String(parsedExchangeRate).split('.')[0]);
          formattedExchangeRate = Number(formatUnits(valueBigInt, decimalPlaces));
        } catch (err) {
          formattedExchangeRate = parsedExchangeRate / Math.pow(10, decimalPlaces);
        }
        
        const counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
        return formattedExchangeRate * counterpartTokenPrice;
      }).filter(price => price !== null);
      
      // Simple ASCII chart
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const chartHeight = 10;
      const chartWidth = 60;
      
      console.log(`Price range: $${minPrice.toFixed(8)} - $${maxPrice.toFixed(8)}`);
      console.log(`Chart period: ${new Date(Number(sortedSnapshots[0].timestamp) * 1000).toISOString()} - ${new Date(Number(sortedSnapshots[sortedSnapshots.length-1].timestamp) * 1000).toISOString()}`);
      
      // Draw chart
      for (let y = 0; y < chartHeight; y++) {
        const price = maxPrice - ((maxPrice - minPrice) * y / (chartHeight - 1));
        let line = `$${price.toFixed(8)} |`;
        
        for (let x = 0; x < chartWidth; x++) {
          const index = Math.floor(x * prices.length / chartWidth);
          const dataPrice = prices[index];
          
          // Check if the current price point is within current row's price range
          const nextRowPrice = y === chartHeight - 1 ? minPrice : maxPrice - ((maxPrice - minPrice) * (y + 1) / (chartHeight - 1));
          if (dataPrice <= price && dataPrice > nextRowPrice) {
            line += '*';
          } else {
            line += ' ';
          }
        }
        
        console.log(line);
      }
      
      console.log('-'.repeat(chartWidth + 10));
      console.log('Time →');
    }
    
  } catch (error) {
    console.error('Error verifying price snapshots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification script
verifyKoiPriceSnapshots()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 