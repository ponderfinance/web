// Script to fix price snapshots and generate missing ones
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function main() {
  console.log('Starting to fix price snapshots...');
  
  const prisma = new PrismaClient();
  
  try {
    // Debug: Check for any swaps in the database
    const allSwapsCount = await prisma.$runCommandRaw({
      count: 'Swap',
    });
    console.log('Total swaps in database:', allSwapsCount.n);

    // First, let's fix any existing price snapshots with wrong timestamp format
    console.log('Fixing existing price snapshots...');
    
    // Use MongoDB's native command to find and update snapshots
    const snapshots = await prisma.$runCommandRaw({
      find: "PriceSnapshot",
      filter: {}
    });

    const snapshotArray = snapshots.cursor?.firstBatch || [];
    console.log(`Found ${snapshotArray.length} price snapshots to fix`);

    for (const snapshot of snapshotArray) {
      let timestamp = snapshot.timestamp;
      // If timestamp is a Date object or string, convert it to Unix seconds
      if (typeof timestamp === 'object' || typeof timestamp === 'string') {
        timestamp = Math.floor(new Date(timestamp).getTime() / 1000);
        await prisma.$runCommandRaw({
          update: "PriceSnapshot",
          updates: [
            {
              q: { _id: snapshot._id },
              u: { $set: { timestamp } }
            }
          ]
        });
      }
    }
    console.log('Fixed existing snapshots');

    // Now let's generate missing price snapshots
    // Get all pairs
    const pairs = await prisma.pair.findMany({
      include: {
        token0: true,
        token1: true
      }
    });
    
    console.log(`Found ${pairs.length} pairs total`);
    
    // For each pair, check if it has recent price snapshots
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);
    
    for (const pair of pairs) {
      // Check if pair has any recent snapshots using native MongoDB command
      const recentSnapshots = await prisma.$runCommandRaw({
        count: "PriceSnapshot",
        query: {
          pairId: pair.id,
          timestamp: { $gte: oneDayAgo }
        }
      });
      
      if (recentSnapshots.n === 0) {
        console.log(`\nGenerating snapshots for pair: ${pair.address}`);
        console.log(`Token0: ${pair.token0.symbol || pair.token0.address}`);
        console.log(`Token1: ${pair.token1.symbol || pair.token1.address}`);
        
        // Get recent swaps for this pair using MongoDB's native query
        const swaps = await prisma.$runCommandRaw({
          find: "Swap",
          filter: {
            pairId: pair.id,
            timestamp: { $gte: oneDayAgo }
          },
          sort: { timestamp: 1 }
        });
        
        const swapArray = swaps.cursor?.firstBatch || [];
        console.log(`Found ${swapArray.length} recent swaps`);
        
        if (swapArray.length > 0) {
          // Calculate prices from swaps
          for (const swap of swapArray) {
            try {
              const amount0In = BigInt(swap.amount0In || swap.amountIn0 || '0');
              const amount1In = BigInt(swap.amount1In || swap.amountIn1 || '0');
              const amount0Out = BigInt(swap.amount0Out || swap.amountOut0 || '0');
              const amount1Out = BigInt(swap.amount1Out || swap.amountOut1 || '0');
              
              // Calculate prices
              let price0 = '0', price1 = '0';
              
              if (amount0In > 0n && amount1Out > 0n) {
                // Token0 was sold for Token1
                price0 = (amount1Out * BigInt(10 ** 18) / amount0In).toString();
                price1 = (amount0In * BigInt(10 ** 18) / amount1Out).toString();
              } else if (amount1In > 0n && amount0Out > 0n) {
                // Token1 was sold for Token0
                price0 = (amount1In * BigInt(10 ** 18) / amount0Out).toString();
                price1 = (amount0Out * BigInt(10 ** 18) / amount1In).toString();
              }
              
              if (price0 !== '0' && price1 !== '0') {
                // Ensure timestamp is a Unix timestamp in seconds
                let timestamp = swap.timestamp;
                if (typeof timestamp === 'object' || typeof timestamp === 'string') {
                  timestamp = Math.floor(new Date(timestamp).getTime() / 1000);
                }
                
                // Create price snapshot using native MongoDB command
                await prisma.$runCommandRaw({
                  insert: "PriceSnapshot",
                  documents: [{
                    pairId: pair.id,
                    price0,
                    price1,
                    timestamp,
                    blockNumber: swap.blockNumber,
                    createdAt: new Date()
                  }]
                });
              }
            } catch (error) {
              console.error(`Error processing swap for pair ${pair.address}:`, error);
              continue;
            }
          }
          
          console.log('Generated price snapshots from swaps');
        } else {
          console.log('No recent swaps found to generate price snapshots from');
        }
      } else {
        console.log(`Pair ${pair.address} already has recent snapshots`);
      }
    }
    
    console.log('\nFinished processing all pairs');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 