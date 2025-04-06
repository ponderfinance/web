// Script to check what pairs snapshots are associated with
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  // Try to load MONGO_URI directly from .env file
  let mongoUri;
  try {
    const envPath = path.resolve(__dirname, '../.env');
    console.log(`Attempting to read .env file from: ${envPath}`);
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      console.log('Found .env file, scanning for MONGO_URI...');
      
      // Extract MONGO_URI using regex
      const mongoUriMatch = envContent.match(/MONGO_URI=["']?(.*?)["']?(\r?\n|$)/);
      mongoUri = mongoUriMatch ? mongoUriMatch[1] : null;
      
      if (mongoUri) {
        console.log(`Found MONGO_URI in .env file (first 15 chars): ${mongoUri.substring(0, 15)}...`);
      } else {
        console.error('MONGO_URI not found in .env file');
        process.exit(1);
      }
    } else {
      console.error(`.env file not found at ${envPath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error reading .env file:', error);
    process.exit(1);
  }

  let client;
  try {
    // Connect to MongoDB
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Successfully connected to MongoDB');

    // Get database
    const db = client.db();

    // List all collections to check structure
    console.log('\nListing all collections in the database:');
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      console.log(`- ${collection.name}`);
    }

    // Check PriceSnapshot collection structure
    console.log('\nChecking PriceSnapshot collection structure:');
    const snapshotCount = await db.collection('PriceSnapshot').countDocuments();
    console.log(`Found ${snapshotCount} price snapshots`);

    // Look at a sample snapshot to understand its structure
    console.log('\nExamining a sample snapshot:');
    const sampleSnapshot = await db.collection('PriceSnapshot').findOne({});
    if (sampleSnapshot) {
      console.log(JSON.stringify(sampleSnapshot, null, 2));
    } else {
      console.log('No snapshots found');
    }

    // Get all unique pairIds from snapshots
    console.log('\nFinding all unique pair IDs referenced in snapshots:');
    const pairIds = await db.collection('PriceSnapshot').distinct('pairId');
    console.log(`Found ${pairIds.length} unique pair IDs in snapshots`);

    // List all pair IDs
    for (const pairId of pairIds) {
      console.log(`- Pair ID: ${pairId}`);
    }

    // Try to find these pair IDs in the Pair collection
    console.log('\nLooking for these pairs in the Pair collection:');
    for (const pairId of pairIds) {
      // Try different formats of the ID
      const pair = await db.collection('Pair').findOne({ 
        $or: [
          { _id: pairId },
          { _id: new ObjectId(pairId) },
          { _id: pairId.toString() }
        ]
      });

      if (pair) {
        console.log(`Found pair ${pairId}:`);
        console.log(`- Address: ${pair.address}`);
        console.log(`- Token0ID: ${pair.token0Id}`);
        console.log(`- Token1ID: ${pair.token1Id}`);
      } else {
        console.log(`Pair ${pairId} NOT FOUND in Pair collection`);

        // Get snapshots for this missing pair to understand the situation
        const snapshots = await db.collection('PriceSnapshot')
          .find({ pairId })
          .limit(3)
          .toArray();

        console.log(`  Sample snapshots for missing pair ${pairId}:`);
        for (const snapshot of snapshots) {
          console.log(`  - Timestamp: ${new Date(snapshot.timestamp * 1000).toISOString()}`);
          console.log(`    Price0: ${snapshot.price0}, Price1: ${snapshot.price1}`);
        }

        // Count snapshots for this pair
        const snapshotCount = await db.collection('PriceSnapshot').countDocuments({ pairId });
        console.log(`  Total snapshots for missing pair: ${snapshotCount}`);
      }
    }

    // Also check if any collections use a different ID format
    console.log('\nChecking for collections using different ID format:');

    // Check for a collection with ObjectId formatted _id fields
    const pairWithObjectId = await db.collection('Pair').findOne({
      _id: { $type: 'objectId' }
    });

    console.log(`Found pairs with ObjectId format: ${!!pairWithObjectId}`);

    // Check for a collection with string formatted _id fields
    const pairWithStringId = await db.collection('Pair').findOne({
      _id: { $type: 'string' }
    });

    console.log(`Found pairs with string ID format: ${!!pairWithStringId}`);

    // Check the Pair collection more thoroughly to understand its structure
    console.log('\nExamining Pair collection structure:');
    const allPairs = await db.collection('Pair').find({}).toArray();
    console.log(`Found ${allPairs.length} total pairs in the Pair collection`);

    if (allPairs.length > 0) {
      // Examine the first pair
      const firstPair = allPairs[0];
      console.log('Sample pair structure:');
      console.log(JSON.stringify(firstPair, null, 2));

      // Check all ids in both collections to see if there are any matches
      console.log('\nChecking for any matching IDs between collections:');
      
      const pairIds = new Set(allPairs.map(p => p._id.toString()));
      const snapshotPairIds = new Set(await db.collection('PriceSnapshot').distinct('pairId'));
      
      let matchCount = 0;
      for (const snapshotPairId of snapshotPairIds) {
        if (pairIds.has(snapshotPairId)) {
          matchCount++;
          console.log(`Match found: ${snapshotPairId}`);
        }
      }
      
      console.log(`Found ${matchCount} matching IDs between collections`);
    }

    // Detailed analysis of each snapshot pairId against Pair collection
    console.log('\nDetailed analysis of snapshot pairIds:');
    
    // Get a few snapshots for each pairId
    const uniquePairIds = await db.collection('PriceSnapshot').distinct('pairId');
    for (const pairId of uniquePairIds) {
      const snapshots = await db.collection('PriceSnapshot')
        .find({ pairId })
        .sort({ timestamp: 1 })
        .limit(3)
        .toArray();
      
      // Count total snapshots
      const total = await db.collection('PriceSnapshot').countDocuments({ pairId });
      
      // Analyze if prices are identical
      if (snapshots.length > 1) {
        const price0Values = new Set(snapshots.map(s => s.price0));
        const price1Values = new Set(snapshots.map(s => s.price1));
        
        console.log(`Pair ${pairId}:`);
        console.log(`- Total snapshots: ${total}`);
        console.log(`- Unique price0 values: ${price0Values.size}`);
        console.log(`- Unique price1 values: ${price1Values.size}`);
        console.log(`- Timestamps: ${snapshots.map(s => new Date(s.timestamp * 1000).toISOString()).join(', ')}`);
        console.log(`- Sample price0: ${snapshots[0].price0}`);
        console.log(`- Sample price1: ${snapshots[0].price1}`);
      }
    }
    
  } catch (error) {
    console.error('Error during database analysis:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 