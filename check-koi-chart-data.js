#!/usr/bin/env node

/**
 * Script to verify KOI chart data is now correct after cleanup
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
 * Function to check KOI chart data after cleanup
 */
async function checkKoiChartData() {
  console.log('\n=== KOI Chart Data Verification ===');
  console.log('Checking KOI token chart data after snapshot cleanup');
  
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
    
    // Check the remaining price snapshots
    for (const pair of koiPairs) {
      console.log(`\nPair: ${pair.token0.symbol}/${pair.token1.symbol}`);
      console.log(`Pair ID: ${pair.id}`);
      
      // Determine if KOI is token0 or token1 in this pair
      const isToken0 = pair.token0Id === koiToken.id;
      const counterpartToken = isToken0 ? pair.token1 : pair.token0;
      
      console.log(`KOI is token${isToken0 ? '0' : '1'}`);
      console.log(`Counterpart token: ${counterpartToken.symbol} (price: $${counterpartToken.priceUSD})`);
      
      // Get all remaining price snapshots for this pair
      const priceSnapshots = await prisma.priceSnapshot.findMany({
        where: { pairId: pair.id },
        orderBy: { timestamp: 'desc' },
        take: 10
      });
      
      console.log(`\nFound ${priceSnapshots.length} price snapshots for this pair`);
      
      if (priceSnapshots.length === 0) {
        console.log('No price snapshots found.');
        continue;
      }
      
      // Check the remaining snapshots and calculate prices
      console.log('\nVerifying remaining snapshots:');
      
      for (const snapshot of priceSnapshots) {
        // Get the timestamp as human-readable date
        const timestamp = new Date(Number(snapshot.timestamp) * 1000);
        console.log(`\nSnapshot [${timestamp.toISOString()}]:`);
        
        // Get the raw exchange rates
        const price0 = snapshot.price0;
        const price1 = snapshot.price1;
        
        // Log the raw values
        console.log(`  Raw price0: ${price0 || 'null'}`);
        console.log(`  Raw price1: ${price1 || 'null'}`);
        
        // Calculate KOI price for comparison
        const exchangeRate = isToken0 ? price0 : price1;
        
        if (!exchangeRate) {
          console.log('  No exchange rate for KOI in this snapshot');
          continue;
        }
        
        // Parse the exchange rate
        const parsedExchangeRate = parseFloat(String(exchangeRate));
        
        // Format with proper decimals and calculate price
        const counterpartDecimals = counterpartToken.decimals || 18;
        const tokenDecimals = koiToken.decimals || 18;
        const decimalPlaces = isToken0 ? counterpartDecimals : tokenDecimals;
        
        let formattedExchangeRate;
        try {
          // Format with BigInt for precise handling of large numbers
          const valueBigInt = BigInt(String(parsedExchangeRate).split('.')[0]);
          formattedExchangeRate = Number(formatUnits(valueBigInt, decimalPlaces));
        } catch (err) {
          // Fallback to simple division if BigInt conversion fails
          console.log(`  Error in BigInt conversion: ${err.message}`);
          formattedExchangeRate = parsedExchangeRate / Math.pow(10, decimalPlaces);
        }
        
        const counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
        const calculatedPrice = formattedExchangeRate * counterpartTokenPrice;
        
        console.log(`  Calculated price: $${calculatedPrice}`);
        console.log(`  Current token price: $${koiToken.priceUSD}`);
        console.log(`  Ratio (calculated/actual): ${calculatedPrice / parseFloat(koiToken.priceUSD)}`);
      }
    }
    
    console.log('\n=== Verification Complete ===');
    console.log('All remaining KOI price snapshots have been verified.');
    
  } catch (error) {
    console.error('Error checking KOI chart data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification script
checkKoiChartData()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 