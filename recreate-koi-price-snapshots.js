#!/usr/bin/env node

/**
 * Script to recreate price snapshots for KOI/KKUB pair from swap data
 * This fixes the missing price snapshots that were accidentally deleted
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
// KKUB token address
const KKUB_ADDRESS = '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5'.toLowerCase();

/**
 * Function to recreate price snapshots for the KOI/KKUB pair
 */
async function recreateKoiPriceSnapshots() {
  console.log('\n=== KOI Price Snapshots Recreation ===');
  console.log('Recreating price snapshots for KOI/KKUB pair from swap data');
  
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
    
    // Get KKUB token information
    console.log('\nGetting KKUB token information...');
    const kkubToken = await prisma.token.findFirst({
      where: { address: KKUB_ADDRESS },
      select: {
        id: true,
        name: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    if (!kkubToken) {
      console.error('KKUB token not found in database!');
      return;
    }
    
    console.log(`Found KKUB token: ${kkubToken.name} (${kkubToken.symbol})`);
    console.log(`Current price: $${kkubToken.priceUSD}`);
    
    // Find KOI/KKUB pair
    console.log('\nFinding KOI/KKUB pair...');
    const koiPair = await prisma.pair.findFirst({
      where: {
        OR: [
          { 
            token0Id: koiToken.id,
            token1Id: kkubToken.id
          },
          { 
            token0Id: kkubToken.id,
            token1Id: koiToken.id
          }
        ]
      },
      include: {
        token0: { select: { id: true, symbol: true, decimals: true, priceUSD: true } },
        token1: { select: { id: true, symbol: true, decimals: true, priceUSD: true } }
      }
    });
    
    if (!koiPair) {
      console.error('KOI/KKUB pair not found in database!');
      return;
    }
    
    // Determine if KOI is token0 or token1 in this pair
    const isToken0 = koiPair.token0Id === koiToken.id;
    const counterpartToken = isToken0 ? koiPair.token1 : koiPair.token0;
    
    console.log(`Found KOI/KKUB pair: ${koiPair.token0.symbol}/${koiPair.token1.symbol}`);
    console.log(`Pair ID: ${koiPair.id}`);
    console.log(`Address: ${koiPair.address}`);
    console.log(`KOI is token${isToken0 ? '0' : '1'}`);
    console.log(`Counterpart token: ${counterpartToken.symbol} (price: $${counterpartToken.priceUSD})`);
    
    // Get current price snapshots to avoid duplicates
    console.log('\nChecking existing price snapshots...');
    const existingSnapshots = await prisma.priceSnapshot.findMany({
      where: { pairId: koiPair.id },
      select: { timestamp: true }
    });
    
    const existingTimestamps = new Set(existingSnapshots.map(s => Number(s.timestamp)));
    console.log(`Found ${existingSnapshots.length} existing price snapshots`);
    
    // Get all swaps for the KOI/KKUB pair
    console.log('\nFetching swap data for KOI/KKUB pair...');
    const swaps = await prisma.swap.findMany({
      where: { pairId: koiPair.id },
      orderBy: { timestamp: 'asc' }
    });
    
    console.log(`Found ${swaps.length} swaps for KOI/KKUB pair`);
    
    if (swaps.length === 0) {
      console.log('No swap data found for KOI/KKUB pair.');
      return;
    }
    
    // Process swaps and create price snapshots
    console.log('\nProcessing swaps and creating price snapshots...');
    
    const snapshots = [];
    let lastProcessedTimestamp = 0;
    
    for (const swap of swaps) {
      // Skip if we already have a snapshot for this timestamp
      if (existingTimestamps.has(Number(swap.timestamp))) {
        continue;
      }
      
      // To avoid creating too many snapshots, only create one per hour
      const swapHour = Math.floor(Number(swap.timestamp) / 3600) * 3600;
      if (swapHour <= lastProcessedTimestamp) {
        continue;
      }
      
      lastProcessedTimestamp = swapHour;
      
      // Calculate exchange rate based on the swap amounts
      let price0, price1;
      
      // We need to determine which tokens were swapped based on the amounts
      if (BigInt(swap.amountIn0) > 0 && BigInt(swap.amountOut1) > 0) {
        // Token0 was swapped for Token1
        price0 = (BigInt(swap.amountOut1) * 10n ** 18n) / BigInt(swap.amountIn0);
        price1 = (BigInt(swap.amountIn0) * 10n ** 18n) / BigInt(swap.amountOut1);
      } else if (BigInt(swap.amountIn1) > 0 && BigInt(swap.amountOut0) > 0) {
        // Token1 was swapped for Token0
        price0 = (BigInt(swap.amountIn1) * 10n ** 18n) / BigInt(swap.amountOut0);
        price1 = (BigInt(swap.amountOut0) * 10n ** 18n) / BigInt(swap.amountIn1);
      } else {
        // Cannot determine price from this swap
        continue;
      }
      
      // Create a new price snapshot
      snapshots.push({
        pairId: koiPair.id,
        price0: price0.toString(),
        price1: price1.toString(),
        timestamp: BigInt(swapHour),
        blockNumber: BigInt(swap.blockNumber)
      });
      
      // Log for verification
      const timestamp = new Date(swapHour * 1000);
      console.log(`Created snapshot for ${timestamp.toISOString()}`);
      
      const koiExchangeRate = isToken0 ? price0 : price1;
      const counterpartDecimals = counterpartToken.decimals || 18;
      const tokenDecimals = isToken0 ? koiPair.token0.decimals : koiPair.token1.decimals;
      const decimalPlaces = isToken0 ? counterpartDecimals : tokenDecimals;
      
      // Format the exchange rate
      let formattedExchangeRate;
      try {
        const valueBigInt = BigInt(String(koiExchangeRate).split('.')[0]);
        formattedExchangeRate = Number(formatUnits(valueBigInt, decimalPlaces));
      } catch (err) {
        formattedExchangeRate = Number(koiExchangeRate) / Math.pow(10, decimalPlaces);
      }
      
      // Calculate the USD price
      const counterpartTokenPrice = parseFloat(counterpartToken.priceUSD || '0');
      const calculatedPrice = formattedExchangeRate * counterpartTokenPrice;
      
      console.log(`  Calculated KOI price: $${calculatedPrice}`);
    }
    
    // Insert new price snapshots into the database
    if (snapshots.length > 0) {
      console.log(`\nInserting ${snapshots.length} new price snapshots into the database...`);
      
      await prisma.priceSnapshot.createMany({
        data: snapshots
      });
      
      console.log(`Successfully inserted ${snapshots.length} new price snapshots`);
    } else {
      console.log('\nNo new price snapshots to insert');
    }
    
    console.log('\n=== Recreation Complete ===');
    console.log(`Successfully recreated price snapshots for KOI/KKUB pair from swap data`);
    
  } catch (error) {
    console.error('Error recreating price snapshots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
recreateKoiPriceSnapshots()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 