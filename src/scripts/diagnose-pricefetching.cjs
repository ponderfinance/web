const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('Starting price data diagnostics...');
  
  // Initialize Prisma client
  const prisma = new PrismaClient();
  
  try {
    // 1. Get a sample pair to work with
    const pairs = await prisma.pair.findMany({
      take: 5,
      include: {
        token0: true,
        token1: true
      }
    });
    
    if (pairs.length === 0) {
      console.log('No pairs found in the database');
      return;
    }
    
    // Log found pairs
    console.log(`Found ${pairs.length} pairs:`);
    for (const pair of pairs) {
      console.log(`- ${pair.address}: ${pair.token0.symbol || 'Unknown'} / ${pair.token1.symbol || 'Unknown'}`);
    }
    
    // Select the first pair for testing
    const testPair = pairs[0];
    console.log(`\nUsing pair ${testPair.address} for testing`);
    
    // 2. Set up time window parameters similar to resolver
    const referenceTime = 1744062332; // April 7, 2025 (matching resolver)
    const timeWindow = 24 * 60 * 60 * 30; // 30 days (typical chart timeframe)
    const startTime = referenceTime - timeWindow;
    
    console.log(`Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(referenceTime * 1000).toISOString()}`);
    
    // 3. Try various query approaches to see what works
    // Skip timestamp comparison in the where clause to avoid type issues
    console.log('\nQuerying for all snapshots for the selected pair:');
    const allPairSnapshots = await prisma.priceSnapshot.findMany({
      where: {
        pairId: testPair.id
      },
      orderBy: { timestamp: 'asc' },
    });
    
    console.log(`Found ${allPairSnapshots.length} total snapshots for pair ${testPair.address}`);
    
    // 4. Filter snapshots manually after retrieval
    const filteredSnapshots = allPairSnapshots.filter(snapshot => {
      const timestamp = Number(snapshot.timestamp);
      return timestamp >= startTime;
    });
    
    console.log(`After filtering for timestamps >= ${startTime}: ${filteredSnapshots.length} snapshots`);
    
    // 5. Display timestamp range in the snapshots
    if (allPairSnapshots.length > 0) {
      const timestamps = allPairSnapshots.map(s => Number(s.timestamp));
      const minTimestamp = Math.min(...timestamps);
      const maxTimestamp = Math.max(...timestamps);
      
      console.log(`\nTimestamp range in snapshots:`);
      console.log(`- Min: ${minTimestamp} (${new Date(minTimestamp * 1000).toISOString()})`);
      console.log(`- Max: ${maxTimestamp} (${new Date(maxTimestamp * 1000).toISOString()})`);
      console.log(`- Reference start time: ${startTime} (${new Date(startTime * 1000).toISOString()})`);
    }
    
    // 6. Sample a few snapshots for each pair to verify data quality
    console.log('\nSampling snapshots for each pair:');
    for (const pair of pairs) {
      const pairSnapshots = await prisma.priceSnapshot.findMany({
        where: { pairId: pair.id },
        take: 3,
        orderBy: { timestamp: 'desc' }
      });
      
      console.log(`\nPair ${pair.address} (${pair.token0.symbol || '?'} / ${pair.token1.symbol || '?'}): ${pairSnapshots.length} snapshots`);
      
      for (const snapshot of pairSnapshots) {
        const timestampValue = snapshot.timestamp;
        const timestampNumber = typeof timestampValue === 'bigint' ? 
          Number(timestampValue) : 
          typeof timestampValue === 'string' ? 
            parseInt(timestampValue, 10) : 
            Number(timestampValue);
            
        console.log(`- Timestamp: ${timestampValue.toString()} (${new Date(timestampNumber * 1000).toISOString()})`);
        console.log(`  price0: ${snapshot.price0}, price1: ${snapshot.price1}`);
        console.log(`  blockNumber: ${snapshot.blockNumber.toString()}`);
      }
    }
    
    // 7. Check the database directly
    const db = prisma._getClient();
    
    // Find the most recent PriceSnapshot by checking the raw Mongo collection
    const priceSnapshotCollection = db.priceSnapshot.findRaw({
      filter: {}
    });
    
    console.log('\nChecking raw MongoDB data:');
    const mongoSnapshots = await priceSnapshotCollection;
    if (mongoSnapshots && mongoSnapshots.length > 0) {
      console.log(`Found ${mongoSnapshots.length} snapshots in MongoDB`);
      console.log('Sample document from MongoDB:');
      console.log(JSON.stringify(mongoSnapshots[0], null, 2));
    } else {
      console.log('No snapshots found in MongoDB');
    }
    
    // 8. Check if the timestamp field is indeed a BigInt in the database
    // This will help confirm if there's a type mismatch
    const randomSnapshot = await prisma.priceSnapshot.findFirst();
    if (randomSnapshot) {
      console.log('\nSample snapshot data types:');
      console.log(`- timestamp type: ${typeof randomSnapshot.timestamp}`);
      console.log(`- timestamp value: ${randomSnapshot.timestamp.toString()}`);
      console.log(`- blockNumber type: ${typeof randomSnapshot.blockNumber}`);
      console.log(`- blockNumber value: ${randomSnapshot.blockNumber.toString()}`);
      console.log(`- price0 type: ${typeof randomSnapshot.price0}`);
      console.log(`- price0 value: ${randomSnapshot.price0}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\nPrisma client disconnected');
  }
}

main().catch(console.error); 