// Script to check price snapshots for a token
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function main() {
  console.log('Starting to check price snapshots...');
  
  const prisma = new PrismaClient();
  
  try {
    // The token address from the logs
    const tokenAddress = '0xe0432224871917fb5a137f4a153a51ecf9f74f57';
    
    // Find the token
    const token = await prisma.token.findFirst({
      where: { address: tokenAddress.toLowerCase() },
      include: {
        pairsAsToken0: true,
        pairsAsToken1: true
      }
    });
    
    if (!token) {
      console.error(`Token not found: ${tokenAddress}`);
      return;
    }
    
    console.log(`Found token: ${token.symbol || tokenAddress}`);
    console.log(`Token ID: ${token.id}`);
    
    // Get all pairs for this token
    const pairs = [
      ...token.pairsAsToken0.map(p => ({ ...p, isToken0: true })),
      ...token.pairsAsToken1.map(p => ({ ...p, isToken0: false }))
    ];
    
    console.log(`Found ${pairs.length} pairs for this token`);
    
    // Check price snapshots for each pair
    for (const pair of pairs) {
      console.log(`\nChecking pair: ${pair.address}`);
      console.log(`Pair ID: ${pair.id}`);
      console.log(`Is token0: ${pair.isToken0}`);
      
      // Count price snapshots
      const snapshotCount = await prisma.priceSnapshot.count({
        where: { pairId: pair.id }
      });
      
      console.log(`Found ${snapshotCount} price snapshots for this pair`);
      
      if (snapshotCount > 0) {
        // Get a sample of snapshots
        const snapshots = await prisma.priceSnapshot.findMany({
          where: { pairId: pair.id },
          orderBy: { timestamp: 'desc' },
          take: 5
        });
        
        console.log('Sample snapshots:');
        snapshots.forEach(snapshot => {
          console.log(`Timestamp: ${new Date(snapshot.timestamp * 1000).toISOString()}`);
          console.log(`Price0: ${snapshot.price0}`);
          console.log(`Price1: ${snapshot.price1}`);
          console.log('---');
        });
      }
    }
    
    // Check if there are any price snapshots at all in the database
    const totalSnapshots = await prisma.priceSnapshot.count();
    console.log(`\nTotal price snapshots in database: ${totalSnapshots}`);
    
    if (totalSnapshots > 0) {
      // Use MongoDB's native aggregation
      const sampleSnapshots = await prisma.$runCommandRaw({
        aggregate: "PriceSnapshot",
        pipeline: [
          { $sort: { timestamp: -1 } },
          { $limit: 5 }
        ],
        cursor: {}
      });
      
      if (sampleSnapshots.cursor && sampleSnapshots.cursor.firstBatch) {
        console.log('Sample snapshots from any pair:');
        sampleSnapshots.cursor.firstBatch.forEach(snapshot => {
          console.log(`Pair ID: ${snapshot.pairId}`);
          const timestamp = typeof snapshot.timestamp === 'object' 
            ? new Date(snapshot.timestamp).getTime() / 1000 
            : snapshot.timestamp;
          console.log(`Timestamp: ${new Date(timestamp * 1000).toISOString()}`);
          console.log(`Price0: ${snapshot.price0}`);
          console.log(`Price1: ${snapshot.price1}`);
          console.log('---');
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 