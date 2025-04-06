// Script to properly restore prices based on historical reserves data
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
        console.log(`Found MONGO_URI in .env file`);
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

  // Connect to MongoDB and restore proper prices
  let client;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db = client.db();
    
    // Create a backup of the PriceSnapshot collection
    const backupCollectionName = `PriceSnapshot_Backup_${new Date().toISOString().replace(/:/g, '_').replace(/\./g, '_')}`;
    console.log(`Creating backup of PriceSnapshot collection to ${backupCollectionName}...`);
    
    try {
      // Create new collection for backup
      await db.createCollection(backupCollectionName);
      
      // Copy all documents
      const pipeline = [
        { $match: {} },
        { $out: backupCollectionName }
      ];
      
      await db.collection('PriceSnapshot').aggregate(pipeline).toArray();
      
      // Verify backup
      const count = await db.collection(backupCollectionName).countDocuments();
      console.log(`Backup created successfully with ${count} documents`);
    } catch (error) {
      console.error('Error creating backup:', error);
      console.log('Continuing without backup...');
    }
    
    // Check if we have PairReserveSnapshot collection for historical reserve data
    const hasReserveSnapshots = await db.listCollections({ name: 'PairReserveSnapshot' }).hasNext();
    
    if (hasReserveSnapshots) {
      console.log('Found PairReserveSnapshot collection for historical reserve data');
    } else {
      console.log('PairReserveSnapshot collection not found. Will use current pair reserves.');
    }
    
    // Get all pairs
    const pairs = await db.collection('Pair').find({}).toArray();
    console.log(`Found ${pairs.length} pairs in the database.`);
    
    // Process each pair
    let totalSnapshotsUpdated = 0;
    let totalSnapshotsUnchanged = 0;
    
    for (const pair of pairs) {
      console.log(`\nProcessing pair: ${pair.address} (ID: ${pair._id})`);
      
      // Get tokens for this pair
      const token0 = await db.collection('Token').findOne({ _id: new ObjectId(pair.token0Id) });
      const token1 = await db.collection('Token').findOne({ _id: new ObjectId(pair.token1Id) });
      
      if (!token0 || !token1) {
        console.log('Could not find tokens for this pair. Skipping.');
        continue;
      }
      
      console.log(`Pair: ${token0.symbol}/${token1.symbol}`);
      console.log(`Token0 decimals: ${token0.decimals}, Token1 decimals: ${token1.decimals}`);
      
      // Get all price snapshots for this pair
      const priceSnapshots = await db.collection('PriceSnapshot')
        .find({ pairId: pair._id.toString() })
        .sort({ timestamp: 1 })
        .toArray();
      
      console.log(`Found ${priceSnapshots.length} price snapshots for this pair.`);
      
      if (priceSnapshots.length === 0) {
        continue;
      }
      
      // If we have PairReserveSnapshot collection, use historical reserve data
      let reserveSnapshots = [];
      
      if (hasReserveSnapshots) {
        // Get all reserve snapshots for this pair
        reserveSnapshots = await db.collection('PairReserveSnapshot')
          .find({ pairAddress: pair.address.toLowerCase() })
          .sort({ timestamp: 1 })
          .toArray();
        
        console.log(`Found ${reserveSnapshots.length} reserve snapshots for this pair.`);
      }
      
      // Calculate prices correctly for each price snapshot
      const bulkOps = [];
      
      for (const priceSnapshot of priceSnapshots) {
        // Try to find reserve data for this timestamp
        let reserve0, reserve1;
        
        if (reserveSnapshots.length > 0) {
          // Find the closest reserve snapshot to this price snapshot's timestamp
          // This is a simplistic approach - in a real scenario you might want more sophisticated matching
          const timestamp = priceSnapshot.timestamp;
          let closestSnapshot = null;
          let closestDiff = Infinity;
          
          for (const reserveSnapshot of reserveSnapshots) {
            const diff = Math.abs(reserveSnapshot.timestamp - timestamp);
            if (diff < closestDiff) {
              closestDiff = diff;
              closestSnapshot = reserveSnapshot;
            }
          }
          
          if (closestSnapshot && closestDiff < 86400) { // Within 24 hours
            reserve0 = closestSnapshot.reserve0;
            reserve1 = closestSnapshot.reserve1;
            console.log(`Using reserve snapshot from ${new Date(closestSnapshot.timestamp * 1000).toISOString()} for price snapshot at ${new Date(timestamp * 1000).toISOString()}`);
          } else {
            // Fallback to pair's current reserves
            reserve0 = pair.reserve0;
            reserve1 = pair.reserve1;
            console.log(`No close reserve snapshot found. Using current pair reserves.`);
          }
        } else {
          // If no reserve snapshots, use pair's current reserves
          reserve0 = pair.reserve0;
          reserve1 = pair.reserve1;
        }
        
        if (!reserve0 || !reserve1 || reserve0 === '0' || reserve1 === '0') {
          console.log(`Reserves missing or zero for snapshot ${priceSnapshot._id}. Skipping.`);
          continue;
        }
        
        // Calculate prices exactly how the indexer would:
        // For token0: price0 = reserve1 / reserve0
        // For token1: price1 = reserve0 / reserve1
        
        const reserve0BN = BigInt(reserve0);
        const reserve1BN = BigInt(reserve1);
        
        // Calculate raw prices (this is the formula used in the indexer)
        const price0 = reserve1BN.toString();
        const price1 = reserve0BN.toString();
        
        // Only update if different from current values
        if (priceSnapshot.price0 !== price0 || priceSnapshot.price1 !== price1) {
          bulkOps.push({
            updateOne: {
              filter: { _id: priceSnapshot._id },
              update: { 
                $set: { price0, price1 },
                $unset: { token0Price: "", token1Price: "" } // Remove derived prices to force recalculation
              }
            }
          });
        } else {
          totalSnapshotsUnchanged++;
        }
        
        // Execute in batches to avoid overwhelming the database
        if (bulkOps.length >= 500) {
          if (bulkOps.length > 0) {
            try {
              const result = await db.collection('PriceSnapshot').bulkWrite(bulkOps);
              console.log(`Batch update result: ${result.modifiedCount} snapshots updated.`);
              totalSnapshotsUpdated += result.modifiedCount;
              bulkOps.length = 0; // Clear the array
            } catch (error) {
              console.error('Error updating batch:', error);
            }
          }
        }
      }
      
      // Update any remaining snapshots
      if (bulkOps.length > 0) {
        try {
          const result = await db.collection('PriceSnapshot').bulkWrite(bulkOps);
          console.log(`Final batch update result: ${result.modifiedCount} snapshots updated.`);
          totalSnapshotsUpdated += result.modifiedCount;
        } catch (error) {
          console.error('Error updating final batch:', error);
        }
      }
    }
    
    // Remove derived prices from all snapshots to force recalculation
    console.log('\nRemoving derived token prices from all snapshots to force recalculation...');
    try {
      const result = await db.collection('PriceSnapshot').updateMany(
        {},
        { $unset: { token0Price: "", token1Price: "" } }
      );
      console.log(`Removed derived prices from ${result.modifiedCount} snapshots.`);
    } catch (error) {
      console.error('Error removing derived prices:', error);
    }
    
    console.log(`\nPrice restoration completed.`);
    console.log(`Total snapshots updated: ${totalSnapshotsUpdated}`);
    console.log(`Total snapshots already correct: ${totalSnapshotsUnchanged}`);
    
    // Verify some snapshots to check the results
    console.log('\nVerifying a sample of updated snapshots:');
    const verificationSamples = await db.collection('PriceSnapshot')
      .find({})
      .limit(5)
      .toArray();
    
    verificationSamples.forEach((sample, index) => {
      console.log(`Sample ${index + 1}:`);
      console.log(`- Pair ID: ${sample.pairId}`);
      console.log(`- Timestamp: ${new Date(sample.timestamp * 1000).toISOString()}`);
      console.log(`- Price0: ${sample.price0}`);
      console.log(`- Price1: ${sample.price1}`);
    });
    
  } catch (error) {
    console.error('Error during price restoration:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 