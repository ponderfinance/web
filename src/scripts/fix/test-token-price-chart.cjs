const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function main() {
  console.log('Testing tokenPriceChart query...');
  
  // Connect to MongoDB
  const prisma = new PrismaClient();
  
  try {
    // Get a sample token
    const token = await prisma.token.findFirst({
      where: { symbol: 'KKUB' },
      select: { id: true, address: true, symbol: true }
    });
    
    if (!token) {
      console.error('No token found with symbol KKUB');
      return;
    }
    
    console.log(`Found token: ${token.symbol} (${token.address})`);
    
    // Get price snapshots for this token
    const pairs = await prisma.pair.findMany({
      where: {
        OR: [
          { token0Id: token.id },
          { token1Id: token.id }
        ]
      },
      select: {
        id: true,
        token0Id: true,
        token1Id: true,
        token0: {
          select: {
            id: true,
            address: true,
            symbol: true,
            decimals: true
          }
        },
        token1: {
          select: {
            id: true,
            address: true,
            symbol: true,
            decimals: true
          }
        }
      }
    });
    
    console.log(`Found ${pairs.length} pairs for ${token.symbol}`);
    
    // Get price snapshots for each pair
    for (const pair of pairs) {
      console.log(`\nChecking pair: ${pair.token0.symbol}-${pair.token1.symbol}`);
      
      // Get the most recent snapshots
      const snapshots = await prisma.priceSnapshot.findMany({
        where: {
          pairId: pair.id
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 5
      });
      
      console.log(`Found ${snapshots.length} snapshots for this pair`);
      
      if (snapshots.length > 0) {
        console.log('Sample snapshots:');
        snapshots.forEach((snapshot, index) => {
          console.log(`Snapshot ${index + 1}:`);
          console.log(`  ID: ${snapshot.id}`);
          console.log(`  Timestamp: ${snapshot.timestamp} (${new Date(Number(snapshot.timestamp) * 1000).toISOString()})`);
          console.log(`  Price0: ${snapshot.price0}`);
          console.log(`  Price1: ${snapshot.price1}`);
        });
      }
    }
    
    // Now let's simulate the tokenPriceChart query
    console.log('\nSimulating tokenPriceChart query...');
    
    // Determine time window
    const now = Math.floor(Date.now() / 1000);
    const timeWindow = 24 * 60 * 60; // 1 day
    const startTime = now - timeWindow;
    
    console.log(`Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);
    
    // Get price snapshots for all pairs
    const allSnapshots = [];
    
    for (const pair of pairs) {
      const snapshots = await prisma.priceSnapshot.findMany({
        where: {
          pairId: pair.id,
          timestamp: { gte: startTime }
        },
        orderBy: { timestamp: 'asc' }
      });
      
      console.log(`Found ${snapshots.length} snapshots for pair ${pair.id} in the time range`);
      
      if (snapshots.length > 0) {
        allSnapshots.push(...snapshots);
      }
    }
    
    console.log(`Total snapshots found: ${allSnapshots.length}`);
    
    if (allSnapshots.length > 0) {
      console.log('Sample snapshots:');
      allSnapshots.slice(0, 5).forEach((snapshot, index) => {
        console.log(`Snapshot ${index + 1}:`);
        console.log(`  ID: ${snapshot.id}`);
        console.log(`  Pair ID: ${snapshot.pairId}`);
        console.log(`  Timestamp: ${snapshot.timestamp} (${new Date(Number(snapshot.timestamp) * 1000).toISOString()})`);
        console.log(`  Price0: ${snapshot.price0}`);
        console.log(`  Price1: ${snapshot.price1}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected from database');
  }
}

main(); 