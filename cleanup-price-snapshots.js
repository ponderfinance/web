#!/usr/bin/env node

/**
 * Script to clean up incorrect KOI price snapshots after May 8th, 14:38
 * Also handles recent problematic snapshots from May 8th, 19:33
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

// May 8th, 14:38 timestamp (seconds since epoch)
// This is the cutoff time after which snapshots appear to be incorrect
const CUTOFF_TIMESTAMP = Math.floor(new Date('2025-05-08T14:38:00Z').getTime() / 1000);

/**
 * Function to clean up incorrect price snapshots
 */
async function cleanupIncorrectSnapshots() {
  console.log('\n=== KOI Price Snapshots Cleanup ===');
  console.log(`Cleaning up incorrect KOI price snapshots after ${new Date(CUTOFF_TIMESTAMP * 1000).toISOString()}`);
  console.log('Also checking for any other problematic snapshots with abnormal prices');
  
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
      console.log(`\nProcessing pair: ${pair.id}`);
      
      // Determine if KOI is token0 or token1 in this pair
      const isToken0 = pair.token0Id === koiToken.id;
      const counterpartToken = isToken0 ? pair.token1 : pair.token0;
      
      console.log(`KOI is token${isToken0 ? '0' : '1'}`);
      console.log(`Counterpart token: ${counterpartToken.symbol}`);
      
      // Step 1: Find snapshots after the cutoff timestamp
      const afterCutoffSnapshots = await prisma.priceSnapshot.findMany({
        where: {
          pairId: pair.id,
          timestamp: { gt: CUTOFF_TIMESTAMP }
        },
        orderBy: { timestamp: 'asc' }
      });
      
      console.log(`Found ${afterCutoffSnapshots.length} snapshots after the cutoff timestamp`);
      
      if (afterCutoffSnapshots.length > 0) {
        // Log for verification
        console.log(`First snapshot: ${new Date(Number(afterCutoffSnapshots[0].timestamp) * 1000).toISOString()}`);
        console.log(`Last snapshot: ${new Date(Number(afterCutoffSnapshots[afterCutoffSnapshots.length - 1].timestamp) * 1000).toISOString()}`);
        
        // Delete all snapshots after cutoff
        const deleteResult = await prisma.priceSnapshot.deleteMany({
          where: {
            pairId: pair.id,
            timestamp: { gt: CUTOFF_TIMESTAMP }
          }
        });
        
        console.log(`Deleted ${deleteResult.count} snapshots after cutoff`);
      }
      
      // Step 2: Find and analyze all remaining snapshots to check for abnormal prices
      console.log('\nChecking for abnormal snapshots by price...');
      
      const remainingSnapshots = await prisma.priceSnapshot.findMany({
        where: { pairId: pair.id },
        orderBy: { timestamp: 'desc' }
      });
      
      if (remainingSnapshots.length === 0) {
        console.log('No snapshots remain for this pair');
        continue;
      }
      
      console.log(`Analyzing ${remainingSnapshots.length} remaining snapshots`);
      
      // Expected price range (25% variation from current price)
      const expectedPrice = parseFloat(koiToken.priceUSD);
      const lowerBound = expectedPrice * 0.75; // 25% lower
      const upperBound = expectedPrice * 1.25; // 25% higher
      
      console.log(`Expected price: $${expectedPrice}`);
      console.log(`Acceptable range: $${lowerBound} to $${upperBound}`);
      
      // Find abnormal snapshots
      const abnormalSnapshotIds = [];
      
      for (const snapshot of remainingSnapshots) {
        const exchangeRate = isToken0 ? snapshot.price0 : snapshot.price1;
        
        if (!exchangeRate) continue;
        
        // Calculate the price using the appropriate decimals
        const parsedExchangeRate = parseFloat(String(exchangeRate));
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
        
        // Check if the calculated price is within expected range
        if (calculatedPrice < lowerBound || calculatedPrice > upperBound) {
          abnormalSnapshotIds.push(snapshot.id);
          console.log(`Abnormal snapshot found: ${new Date(Number(snapshot.timestamp) * 1000).toISOString()}`);
          console.log(`  Price: $${calculatedPrice} (outside range $${lowerBound}-$${upperBound})`);
        }
      }
      
      // Delete abnormal snapshots if any were found
      if (abnormalSnapshotIds.length > 0) {
        console.log(`Found ${abnormalSnapshotIds.length} abnormal snapshots to delete`);
        
        // Delete them
        for (const id of abnormalSnapshotIds) {
          await prisma.priceSnapshot.delete({
            where: { id: id }
          });
        }
        
        console.log(`Deleted ${abnormalSnapshotIds.length} abnormal snapshots`);
      } else {
        console.log('No abnormal snapshots found');
      }
    }
    
    console.log('\n=== Cleanup Complete ===');
    console.log('All incorrect and abnormal KOI price snapshots have been deleted.');
    console.log('NOTE: If the indexer has a persistent issue creating incorrect snapshots,');
    console.log('it may be necessary to investigate the indexer code for a permanent fix.');
    
  } catch (error) {
    console.error('Error cleaning up snapshots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup script
cleanupIncorrectSnapshots()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
