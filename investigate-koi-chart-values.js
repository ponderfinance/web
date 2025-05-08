#!/usr/bin/env node

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
 * Function to investigate why KOI token chart shows different values than actual price
 */
async function investigateKoiChartDiscrepancy() {
  console.log('\n=== KOI Chart Value Investigation ===');
  console.log('Investigating why KOI token chart shows incorrect values...');
  
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
      
      // Examine the snapshot data and calculate the expected price
      console.log('\nAnalyzing recent price snapshots:');
      
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
        
        // Check if price is in blockchain format
        const needsFormatting = parsedExchangeRate > 1e6;
        if (needsFormatting) {
          // Format with the proper decimals
          try {
            const counterpartDecimals = counterpartToken.decimals || 18;
            const formattedExchangeRate = Number(formatUnits(BigInt(Math.floor(parsedExchangeRate)), counterpartDecimals));
            console.log(`  Formatted exchange rate: ${formattedExchangeRate} (using decimals=${counterpartDecimals})`);
            
            // Calculate USD price the way the PriceChartService does
            const counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
            const calculatedPrice = formattedExchangeRate * counterpartTokenPrice;
            console.log(`  Calculated USD price: $${calculatedPrice}`);
            console.log(`  Current token price: $${koiToken.priceUSD}`);
            console.log(`  Ratio (calculated/actual): ${calculatedPrice / parseFloat(koiToken.priceUSD)}`);
          } catch (err) {
            console.log(`  Error formatting exchange rate: ${err.message}`);
          }
        } else {
          // Direct value (already in the correct format)
          // Calculate USD price
          const counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
          const calculatedPrice = parsedExchangeRate * counterpartTokenPrice;
          console.log(`  Calculated USD price: $${calculatedPrice}`);
          console.log(`  Current token price: $${koiToken.priceUSD}`);
          console.log(`  Ratio (calculated/actual): ${calculatedPrice / parseFloat(koiToken.priceUSD)}`);
        }
        
        // Check if the price is inverted
        const invertedCalc = 1 / parsedExchangeRate;
        const invertedPrice = invertedCalc * parseFloat(counterpartToken.priceUSD || '0');
        console.log(`\n  If the price was inverted:`);
        console.log(`  Inverted exchange rate: ${invertedCalc}`);
        console.log(`  Inverted USD price: $${invertedPrice}`);
        console.log(`  Ratio (inverted/actual): ${invertedPrice / parseFloat(koiToken.priceUSD)}`);
        
        // Check if it's a direct conversion error
        console.log('\n  Testing other conversion possibilities:');
        
        // Test scenarios where exchange rate itself is misinterpreted
        const directUsdPrice = parsedExchangeRate;
        console.log(`  If raw value is directly the USD price: $${directUsdPrice}`);
        
        // Test if we're using opposite token's price for multiplication
        const wrongTokenPrice = isToken0 
          ? parsedExchangeRate * parseFloat(pair.token0.priceUSD || '0') 
          : parsedExchangeRate * parseFloat(pair.token1.priceUSD || '0');
        console.log(`  If multiplying by wrong token's price: $${wrongTokenPrice}`);
        
        // Testing order of formatting vs. multiplication (should be format first, then multiply)
        if (needsFormatting) {
          try {
            // Wrong order: multiply first, then format
            const wrongOrderValue = Number(formatUnits(BigInt(Math.floor(parsedExchangeRate * parseFloat(counterpartToken.priceUSD || '0'))), counterpartToken.decimals || 18));
            console.log(`  If order is wrong (multiply first, then format): $${wrongOrderValue}`);
          } catch (err) {
            console.log(`  Error in wrong order calculation: ${err.message}`);
          }
        }
      }
    }
    
    console.log('\n=== Investigation Complete ===');
    console.log('Based on the investigation:');
    console.log('1. Compare the calculated prices using different methods to the actual token price');
    console.log('2. Check for any patterns in the discrepancy ratio');
    console.log('3. Look for scenarios where the calculated price is ~5x higher (as in the chart)');
    console.log('4. Check if the issue is in the price calculation, formatting, or chart display');
    
  } catch (error) {
    console.error('Error investigating KOI chart discrepancy:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the investigation
investigateKoiChartDiscrepancy()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 