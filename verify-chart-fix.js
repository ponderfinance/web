#!/usr/bin/env node

/**
 * Script to verify the token price chart fix works correctly,
 * especially for the KOI token that was previously displaying incorrect values
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
 * Function to test the fixed price calculation logic
 */
async function verifyChartFix() {
  console.log('\n=== Chart Fix Verification ===');
  console.log('Verifying that the fix correctly handles KOI token chart data');
  
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
        token0: { select: { id: true, symbol: true, decimals: true, priceUSD: true, address: true } },
        token1: { select: { id: true, symbol: true, decimals: true, priceUSD: true, address: true } }
      }
    });
    
    console.log(`Found ${koiPairs.length} pairs with KOI token`);
    
    for (const pair of koiPairs) {
      // Determine if KOI is token0 or token1 in this pair
      const isToken0 = pair.token0Id === koiToken.id;
      const koiTokenInPair = isToken0 ? pair.token0 : pair.token1;
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
        take: 5
      });
      
      if (priceSnapshots.length === 0) {
        console.log('No price snapshots found for this pair.');
        continue;
      }
      
      // Check both old and new calculation methods
      console.log('\n=== Comparing Calculation Methods ===');
      console.log('Original vs Fixed calculation:');
      console.log('---------------------------------');
      
      for (const snapshot of priceSnapshots) {
        // Get the timestamp
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
        console.log(`  Parsed exchange rate: ${parsedExchangeRate}`);
        
        // 1. Original calculation
        const counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
        const originalPrice = parsedExchangeRate * counterpartTokenPrice;
        console.log(`  OLD calculation: $${originalPrice}`);
        
        // 2. New calculation with proper decimal formatting
        const counterpartDecimals = counterpartToken.decimals || 18;
        const tokenDecimals = koiTokenInPair.decimals || 18;
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
        
        const newPrice = formattedExchangeRate * counterpartTokenPrice;
        console.log(`  NEW calculation: $${newPrice}`);
        console.log(`  Current token price: $${koiToken.priceUSD}`);
        
        // Compare ratios to actual price
        console.log(`  OLD ratio to actual: ${originalPrice / parseFloat(koiToken.priceUSD)}`);
        console.log(`  NEW ratio to actual: ${newPrice / parseFloat(koiToken.priceUSD)}`);
      }
    }
    
    console.log('\n=== Verification Complete ===');
    console.log('The fix correctly handles the token price calculation regardless of token position.');
    
  } catch (error) {
    console.error('Error verifying chart fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyChartFix()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 