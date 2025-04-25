require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  console.log('Starting price snapshot repair...');
  
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
    
    // 1. Get all pairs for validation
    const pairs = await pairCollection.find({}).toArray();
    const pairIds = new Set(pairs.map(pair => pair._id.toString()));
    console.log(`Found ${pairs.length} pairs in the database`);
    
    // 2. Process snapshots with string prices
    console.log('\nConverting string prices to numbers...');
    const stringPriceSnapshots = await snapshotsCollection.find({
      $or: [
        { price0: { $type: 'string' } },
        { price1: { $type: 'string' } }
      ]
    }).toArray();
    
    console.log(`Found ${stringPriceSnapshots.length} snapshots with string prices`);
    
    let convertedCount = 0;
    let deletedCount = 0;
    
    for (const snapshot of stringPriceSnapshots) {
      // Skip if pair doesn't exist (will be handled later)
      if (!pairIds.has(snapshot.pairId.toString())) {
        continue;
      }
      
      // Convert string prices to numbers
      let price0 = snapshot.price0;
      let price1 = snapshot.price1;
      
      if (typeof price0 === 'string') {
        price0 = parseFloat(price0);
      }
      
      if (typeof price1 === 'string') {
        price1 = parseFloat(price1);
      }
      
      // Check if conversion resulted in valid numbers
      if (isNaN(price0) || isNaN(price1) || price0 === 0 || price1 === 0) {
        // Delete invalid snapshots
        await snapshotsCollection.deleteOne({ _id: snapshot._id });
        deletedCount++;
      } else {
        // Update with the converted values
        await snapshotsCollection.updateOne(
          { _id: snapshot._id },
          { $set: { price0, price1 } }
        );
        convertedCount++;
      }
    }
    
    console.log(`Converted ${convertedCount} snapshots with string prices to numbers`);
    console.log(`Deleted ${deletedCount} snapshots with invalid prices`);
    
    // 3. Delete snapshots with null prices
    console.log('\nDeleting snapshots with null prices...');
    const nullPriceResult = await snapshotsCollection.deleteMany({
      $or: [
        { price0: null },
        { price1: null }
      ]
    });
    
    console.log(`Deleted ${nullPriceResult.deletedCount} snapshots with null prices`);
    
    // 4. Delete snapshots with invalid pair IDs
    console.log('\nDeleting snapshots with invalid pair IDs...');
    const invalidPairIds = [];
    const allSnapshots = await snapshotsCollection.find({}).toArray();
    
    for (const snapshot of allSnapshots) {
      if (!pairIds.has(snapshot.pairId.toString())) {
        invalidPairIds.push(snapshot._id);
      }
    }
    
    if (invalidPairIds.length > 0) {
      const deleteResult = await snapshotsCollection.deleteMany({
        _id: { $in: invalidPairIds }
      });
      
      console.log(`Deleted ${deleteResult.deletedCount} snapshots with invalid pair IDs`);
    } else {
      console.log('No snapshots with invalid pair IDs found');
    }
    
    // 5. Convert string blockNumbers to BigInt
    console.log('\nConverting string blockNumbers to BigInt...');
    const stringBlockSnapshots = await snapshotsCollection.find({
      blockNumber: { $type: 'string' }
    }).toArray();
    
    console.log(`Found ${stringBlockSnapshots.length} snapshots with string blockNumbers`);
    
    let blockNumberConvertedCount = 0;
    
    for (const snapshot of stringBlockSnapshots) {
      const blockNumber = BigInt(snapshot.blockNumber);
      
      await snapshotsCollection.updateOne(
        { _id: snapshot._id },
        { $set: { blockNumber } }
      );
      
      blockNumberConvertedCount++;
    }
    
    console.log(`Converted ${blockNumberConvertedCount} string blockNumbers to BigInt`);
    
    // 6. Verify the results
    console.log('\nVerifying results...');
    
    const remainingInvalidPrices = await snapshotsCollection.countDocuments({
      $or: [
        { price0: { $type: 'string' } },
        { price1: { $type: 'string' } },
        { price0: null },
        { price1: null }
      ]
    });
    
    const remainingStringBlockNumbers = await snapshotsCollection.countDocuments({
      blockNumber: { $type: 'string' }
    });
    
    console.log(`Remaining snapshots with invalid prices: ${remainingInvalidPrices}`);
    console.log(`Remaining snapshots with string blockNumbers: ${remainingStringBlockNumbers}`);
    
    const finalCount = await snapshotsCollection.countDocuments();
    console.log(`\nFinal snapshot count: ${finalCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

main().catch(console.error); 