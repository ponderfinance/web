require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

async function updateRealPrices() {
  console.log('Starting to update token prices based on actual on-chain reserves...');
  const prisma = new PrismaClient();
  
  try {
    // Get stablecoins
    const stablecoins = await prisma.token.findMany({
      where: {
        symbol: { in: ['USDT', 'USDC'] }
      },
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUsd: true
      }
    });

    console.log(`Found ${stablecoins.length} stablecoins to analyze`);
    
    // Get KKUB token
    const kkubToken = await prisma.token.findFirst({
      where: { symbol: 'KKUB' },
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUsd: true
      }
    });
    
    if (!kkubToken) {
      console.log('KKUB token not found');
      return;
    }
    
    console.log(`Current KKUB price: $${kkubToken.priceUsd}`);
    
    // First calculate exact stablecoin prices based on current reserves
    for (const stablecoin of stablecoins) {
      console.log(`\nAnalyzing ${stablecoin.symbol} pair with KKUB...`);
      
      // Find stablecoin-KKUB pair
      const pair = await prisma.pair.findFirst({
        where: {
          OR: [
            { token0Id: stablecoin.id, token1Id: kkubToken.id },
            { token0Id: kkubToken.id, token1Id: stablecoin.id }
          ]
        },
        include: {
          token0: true,
          token1: true
        }
      });
      
      if (!pair) {
        console.log(`No pair found for ${stablecoin.symbol}/KKUB, skipping`);
        continue;
      }
      
      // Get current reserves from pair
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);
      
      if (reserve0 <= 0n || reserve1 <= 0n) {
        console.log(`Invalid reserves for ${stablecoin.symbol}/KKUB pair, skipping`);
        continue;
      }
      
      const isStablecoinToken0 = pair.token0Id === stablecoin.id;
      const token0Decimals = parseInt(pair.token0.decimals) || 18;
      const token1Decimals = parseInt(pair.token1.decimals) || 18;

      // Calculate current exchange rate based on reserves
      let exchangeRate;
      let stablecoinPrice;
      
      if (isStablecoinToken0) {
        // Stablecoin is token0, KKUB is token1
        const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals));
        const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals));
        
        // Exchange rate: how much KKUB per stablecoin
        exchangeRate = reserve1Formatted / reserve0Formatted;
        console.log(`Current exchange rate: ${exchangeRate} KKUB per ${stablecoin.symbol}`);
        
        // Stablecoin price = KKUB price × exchange rate
        stablecoinPrice = parseFloat(kkubToken.priceUsd) * exchangeRate;
      } else {
        // KKUB is token0, Stablecoin is token1
        const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals));
        const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals));
        
        // Exchange rate: how much stablecoin per KKUB
        exchangeRate = reserve1Formatted / reserve0Formatted;
        console.log(`Current exchange rate: ${exchangeRate} ${stablecoin.symbol} per KKUB`);
        
        // Stablecoin price = KKUB price / exchange rate
        stablecoinPrice = parseFloat(kkubToken.priceUsd) / exchangeRate;
      }
      
      try {
        // Check if we need a price snapshot for historical data
        await ensurePriceSnapshot(prisma, pair.id, reserve0, reserve1, token0Decimals, token1Decimals);
      } catch (e) {
        console.log(`Warning: Could not create price snapshot: ${e.message}`);
      }
      
      console.log(`Calculated ${stablecoin.symbol} price: $${stablecoinPrice}`);
      
      // Update stablecoin price in database directly
      console.log(`Updating ${stablecoin.symbol} price from $${stablecoin.priceUsd} to $${stablecoinPrice}`);
      
      // MongoDB-compatible update
      await prisma.token.update({
        where: { id: stablecoin.id },
        data: { 
          priceUsd: stablecoinPrice.toString(),
          lastPriceUpdate: new Date(),
          stablePair: 'MANUAL'  // Flag to prevent auto-updates
        }
      });
      
      // Double-check the update worked
      const updatedToken = await prisma.token.findUnique({
        where: { id: stablecoin.id },
        select: { priceUsd: true }
      });
      
      console.log(`Verified ${stablecoin.symbol} price is now: $${updatedToken.priceUsd}`);
    }
    
    // Get the updated stablecoin prices
    const updatedStablecoins = await prisma.token.findMany({
      where: {
        symbol: { in: ['USDT', 'USDC'] }
      },
      select: {
        id: true,
        symbol: true,
        priceUsd: true
      }
    });
    
    console.log("\nUpdated stablecoin prices:");
    for (const stablecoin of updatedStablecoins) {
      console.log(`${stablecoin.symbol}: $${stablecoin.priceUsd}`);
    }
    
    console.log('\nAll prices updated based on actual on-chain reserves.');
    
    // Check for processes that might override prices
    console.log('\nChecking for automatic price update processes...');
    
    // Look for files related to price updates
    console.log('Hint: Check the following areas that might override these prices:');
    console.log('1. Check if the API or GraphQL resolvers might be setting default prices');
    console.log('2. Look for cron jobs or scheduled tasks that update token prices');
    console.log('3. Review the tokenPriceService for any logic that might force $1 for stablecoins');
    console.log('4. Check if any background worker or server process is running that resets prices');
    
    // Clear Redis cache to ensure new prices are used
    console.log('\nYou should also run scripts/clear-all-redis.js to ensure cache is cleared');
    
  } catch (error) {
    console.error('Error updating token prices:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to ensure we have price snapshots for historical data
async function ensurePriceSnapshot(prisma, pairId, reserve0, reserve1, decimals0, decimals1) {
  try {
    // Calculate price values
    const price0 = reserve1 > 0n ? (reserve0 * BigInt(10 ** 18)) / reserve1 : 0n;
    const price1 = reserve0 > 0n ? (reserve1 * BigInt(10 ** 18)) / reserve0 : 0n;
    
    // Check if we have a recent snapshot (within the last hour)
    const recentSnapshot = await prisma.priceSnapshot.findFirst({
      where: {
        pairId,
        timestamp: {
          gte: Math.floor(Date.now() / 1000) - 3600 // Within the last hour
        }
      }
    });
    
    if (!recentSnapshot) {
      console.log(`Creating new price snapshot for pair ${pairId}`);
      
      // Get the latest block number for the snapshot (we'll use 1 as placeholder)
      const blockNumber = 1;
      
      // Create a new snapshot with required fields for MongoDB
      await prisma.priceSnapshot.create({
        data: {
          pairId,
          timestamp: Math.floor(Date.now() / 1000),
          price0: price0.toString(),
          price1: price1.toString(),
          blockNumber: blockNumber.toString()
        }
      });
      
      console.log(`Created new price snapshot for ${pairId}`);
    } else {
      console.log(`Recent price snapshot exists for pair ${pairId}`);
    }
  } catch (error) {
    console.error(`Error ensuring price snapshot: ${error.message}`);
    throw error; // Re-throw to be caught by caller
  }
}

// Run the script
updateRealPrices()
  .then(() => console.log('Price update completed successfully'))
  .catch(console.error);