require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  console.log('Starting direct MongoDB check for price snapshots...');
  
  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is not defined');
  }
  
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db();
    console.log('Using database:', db.databaseName);
    
    // Get collections
    const snapshotsCollection = db.collection('PriceSnapshot');
    const pairCollection = db.collection('Pair');
    
    // 1. Count total snapshots
    const totalSnapshots = await snapshotsCollection.countDocuments();
    console.log(`Found ${totalSnapshots} total price snapshots`);
    
    // 2. Check a sample snapshot
    const sampleSnapshot = await snapshotsCollection.findOne();
    if (sampleSnapshot) {
      console.log('\nSample snapshot:');
      console.log(JSON.stringify(sampleSnapshot, null, 2));
      
      if (sampleSnapshot.pairId) {
        const pair = await pairCollection.findOne({ _id: sampleSnapshot.pairId });
        if (pair) {
          console.log(`\nPair found: ${pair.address}`);
        } else {
          console.log(`\nWARNING: Pair with ID ${sampleSnapshot.pairId} not found`);
        }
      }
    }
    
    // 3. Check for snapshot problems
    console.log('\nAnalyzing potential snapshot problems:');
    
    // Check for null price0 or price1 fields
    const nullPriceCount = await snapshotsCollection.countDocuments({
      $or: [
        { price0: null },
        { price1: null }
      ]
    });
    console.log(`- Snapshots with null price fields: ${nullPriceCount}`);
    
    // Check for missing timestamp or blockNumber
    const missingTimestampCount = await snapshotsCollection.countDocuments({
      $or: [
        { timestamp: { $exists: false } },
        { blockNumber: { $exists: false } }
      ]
    });
    console.log(`- Snapshots with missing timestamp or blockNumber: ${missingTimestampCount}`);
    
    // Check for string vs number storage of prices
    const stringPriceCount = await snapshotsCollection.countDocuments({
      $or: [
        { price0: { $type: 'string' } },
        { price1: { $type: 'string' } }
      ]
    });
    console.log(`- Snapshots with string prices: ${stringPriceCount}`);
    
    const numberPriceCount = await snapshotsCollection.countDocuments({
      $and: [
        { price0: { $type: 'double' } },
        { price1: { $type: 'double' } }
      ]
    });
    console.log(`- Snapshots with number prices: ${numberPriceCount}`);
    
    // 4. Check pairs with valid snapshots
    const pairsWithSnapshots = await snapshotsCollection.aggregate([
      {
        $match: {
          price0: { $ne: null },
          price1: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$pairId',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log(`\nPairs with valid snapshots: ${pairsWithSnapshots.length}`);
    
    if (pairsWithSnapshots.length > 0) {
      // Get details for the first few pairs with valid snapshots
      for (let i = 0; i < Math.min(pairsWithSnapshots.length, 5); i++) {
        const pairInfo = pairsWithSnapshots[i];
        const pair = await pairCollection.findOne({ _id: pairInfo._id });
        if (pair) {
          console.log(`- Pair ${pair.address}: ${pairInfo.count} snapshots`);
          
          // Get a sample of valid snapshots for this pair
          const validSnapshots = await snapshotsCollection.find({
            pairId: pairInfo._id,
            price0: { $ne: null },
            price1: { $ne: null }
          }).limit(3).toArray();
          
          if (validSnapshots.length > 0) {
            console.log('  Sample valid snapshot:');
            const sample = validSnapshots[0];
            const timestamp = typeof sample.timestamp === 'number' ? 
              sample.timestamp : 
              parseInt(sample.timestamp, 10);
              
            console.log(`  - Timestamp: ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
            console.log(`  - Price0: ${sample.price0}, Price1: ${sample.price1}`);
          }
        }
      }
    }
    
    // 5. Check timestamp range
    const earliestSnapshot = await snapshotsCollection.find({
      price0: { $ne: null },
      price1: { $ne: null }
    }).sort({ timestamp: 1 }).limit(1).toArray();
    
    const latestSnapshot = await snapshotsCollection.find({
      price0: { $ne: null },
      price1: { $ne: null }
    }).sort({ timestamp: -1 }).limit(1).toArray();
    
    if (earliestSnapshot.length > 0 && latestSnapshot.length > 0) {
      const earliestTime = Number(earliestSnapshot[0].timestamp);
      const latestTime = Number(latestSnapshot[0].timestamp);
      
      console.log('\nTimestamp range for valid snapshots:');
      console.log(`- Earliest: ${earliestTime} (${new Date(earliestTime * 1000).toISOString()})`);
      console.log(`- Latest: ${latestTime} (${new Date(latestTime * 1000).toISOString()})`);
      console.log(`- Span: ${(latestTime - earliestTime) / (24 * 60 * 60)} days`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

main().catch(console.error); 