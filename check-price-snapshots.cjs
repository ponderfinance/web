require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to safely stringify BigInt values
function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2);
}

async function checkPriceSnapshots() {
  try {
    // Get a token to test with
    const token = await prisma.token.findFirst({
      select: { 
        id: true, 
        address: true, 
        symbol: true,
        pairsAsToken0: { select: { id: true } },
        pairsAsToken1: { select: { id: true } }
      }
    });
    
    if (!token) {
      console.log('No tokens found in the database');
      return;
    }
    
    console.log(`Testing with token: ${token.symbol} (${token.address})`);
    console.log(`Pairs as Token0: ${token.pairsAsToken0.length}, Pairs as Token1: ${token.pairsAsToken1.length}`);
    
    // Get all pair IDs for this token
    const pairIds = [
      ...token.pairsAsToken0.map(p => p.id),
      ...token.pairsAsToken1.map(p => p.id)
    ];
    
    if (pairIds.length === 0) {
      console.log('No pairs found for this token');
      return;
    }
    
    console.log(`Testing with ${pairIds.length} pairs`);
    
    // Check for price snapshots for each pair
    for (let i = 0; i < pairIds.length && i < 3; i++) {
      const pairId = pairIds[i];
      console.log(`\nChecking price snapshots for pair ${pairId}`);
      
      const snapshots = await prisma.priceSnapshot.findMany({
        where: { pairId: pairId },
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: { 
          timestamp: true,
          price0: true,
          price1: true,
          blockNumber: true,
          createdAt: true
        }
      });
      
      console.log(`Found ${snapshots.length} snapshots`);
      
      if (snapshots.length > 0) {
        console.log('Sample snapshot:');
        console.log(safeStringify(snapshots[0]));
      }
      
      // Check types of fields
      if (snapshots.length > 0) {
        const snapshot = snapshots[0];
        console.log('\nData types:');
        console.log('price0:', typeof snapshot.price0, snapshot.price0.toString());
        console.log('price1:', typeof snapshot.price1, snapshot.price1.toString());
        console.log('timestamp:', typeof snapshot.timestamp, snapshot.timestamp.toString());
        console.log('blockNumber:', typeof snapshot.blockNumber, snapshot.blockNumber.toString());
      }
      
      // Test a query similar to the resolver
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (24 * 60 * 60 * 100); // 100 days
      
      const timeRangeSnapshots = await prisma.priceSnapshot.findMany({
        where: {
          pairId: pairId,
          timestamp: { gte: startTime },
          price0: { gt: 0 },
          price1: { gt: 0 }
        },
        select: {
          timestamp: true,
          price0: true,
          price1: true
        },
        orderBy: { timestamp: 'asc' }
      });
      
      console.log(`\nFound ${timeRangeSnapshots.length} snapshots in time range`);
      
      if (timeRangeSnapshots.length > 0) {
        console.log('Sample time range snapshot:');
        console.log(safeStringify(timeRangeSnapshots[0]));
      }
    }

    // Check for stablecoin tokens
    console.log("\nChecking for stablecoin tokens:");
    const stablecoins = await prisma.token.findMany({
      where: {
        symbol: { in: ['USDT', 'USDC', 'DAI', 'BUSD'] }
      },
      select: {
        id: true,
        address: true,
        symbol: true
      }
    });

    console.log(`Found ${stablecoins.length} stablecoins`);
    stablecoins.forEach(coin => {
      console.log(`${coin.symbol}: ${coin.address}`);
    });

    // Check tokenPriceService for stablecoin addresses
    console.log("\nChecking TokenPriceService for stablecoin addresses:");
    // Get the path to the tokenPriceService
    const tokenPriceServicePath = await prisma.token.findFirst({
      where: {
        symbol: 'KKUB'
      },
      select: {
        address: true
      }
    });
    
    if (tokenPriceServicePath) {
      console.log("Path to check: /Users/taayyohh/dev/ponder/ponder-dex/src/lib/services/tokenPriceService.ts");
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPriceSnapshots().catch(e => {
  console.error(e);
  process.exit(1);
}); 