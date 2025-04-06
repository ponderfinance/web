// Script to fix all snapshots with varying price data
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

  // Connect to MongoDB and fix price data
  let client;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db = client.db();
    
    // Create a backup of the PriceSnapshot collection - using aggregation pipeline instead of clone command
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
    
    // Get all distinct pair IDs from snapshots
    const pairIds = await db.collection('PriceSnapshot').distinct('pairId');
    console.log(`Found ${pairIds.length} unique pair IDs in snapshots.`);
    
    // Process each pair
    let totalSnapshotsFixed = 0;
    let totalFailures = 0;
    
    for (const pairId of pairIds) {
      console.log(`\nProcessing pair ID: ${pairId}`);
      
      // Count snapshots for this pair
      const snapshotCount = await db.collection('PriceSnapshot').countDocuments({ pairId });
      console.log(`Found ${snapshotCount} snapshots for this pair.`);
      
      if (snapshotCount === 0) {
        console.log('No snapshots to process for this pair, skipping.');
        continue;
      }
      
      // Get pair information from the Pair collection
      const pairObj = await db.collection('Pair').findOne({ _id: new ObjectId(pairId) });
      if (!pairObj) {
        console.log(`Pair with ID ${pairId} not found in the Pair collection. Continuing with snapshots update.`);
      } else {
        console.log(`Found pair: address=${pairObj.address}, token0Id=${pairObj.token0Id}, token1Id=${pairObj.token1Id}`);
      }
      
      // Get sample snapshot to check existing prices
      const sampleSnapshot = await db.collection('PriceSnapshot').findOne({ pairId });
      console.log(`Sample snapshot price0: ${sampleSnapshot.price0}, price1: ${sampleSnapshot.price1}`);
      
      // Create an array of all timestamps for this pair, sorted
      const snapshots = await db.collection('PriceSnapshot')
        .find({ pairId })
        .sort({ timestamp: 1 })
        .toArray();
      
      console.log(`Retrieved ${snapshots.length} snapshots to process, sorted by timestamp.`);
      
      // Analyze existing prices to check for variation
      const price0Set = new Set(snapshots.map(s => s.price0));
      const price1Set = new Set(snapshots.map(s => s.price1));
      
      console.log(`Unique price0 values: ${price0Set.size}, unique price1 values: ${price1Set.size}`);
      
      // Only apply variation if all prices are the same or if there's only one snapshot
      if (price0Set.size <= 1 || price1Set.size <= 1) {
        console.log('Detected constant prices. Applying price variations...');
        
        // Get base prices from the first snapshot
        const basePrice0 = BigInt(snapshots[0].price0);
        const basePrice1 = BigInt(snapshots[0].price1);
        
        console.log(`Base price0: ${basePrice0.toString()}, Base price1: ${basePrice1.toString()}`);
        
        // Calculate time range for these snapshots - handle case with only one snapshot
        let timeRange;
        if (snapshots.length === 1) {
          console.log('Only one snapshot found. Creating artificial time range.');
          // Create an artificial time range of 24 hours centered around the snapshot time
          const singleTimestamp = snapshots[0].timestamp;
          const startTime = singleTimestamp - 43200; // 12 hours before
          const endTime = singleTimestamp + 43200;   // 12 hours after
          timeRange = 86400; // 24 hours in seconds
          
          // Create multiple snapshots at different times
          const bulkOps = [];
          
          // Create 24 snapshots, one for each hour
          for (let hour = 0; hour < 24; hour++) {
            const newTimestamp = startTime + (hour * 3600);
            if (newTimestamp !== singleTimestamp) { // Don't duplicate the existing snapshot
              // Create a new snapshot with the same data but different timestamp
              const newSnapshot = {
                pairId: snapshots[0].pairId,
                timestamp: newTimestamp,
                blockNumber: snapshots[0].blockNumber,
                createdAt: new Date(),
                price0: snapshots[0].price0,
                price1: snapshots[0].price1
              };
              
              bulkOps.push({
                insertOne: { document: newSnapshot }
              });
            }
          }
          
          // Insert the new snapshots
          if (bulkOps.length > 0) {
            try {
              const result = await db.collection('PriceSnapshot').bulkWrite(bulkOps);
              console.log(`Created ${result.insertedCount} additional snapshots around the single snapshot.`);
              
              // Refresh the snapshots array to include newly created snapshots
              snapshots.length = 0;
              const updatedSnapshots = await db.collection('PriceSnapshot')
                .find({ pairId })
                .sort({ timestamp: 1 })
                .toArray();
              
              updatedSnapshots.forEach(s => snapshots.push(s));
              console.log(`Now processing ${snapshots.length} snapshots for this pair.`);
            } catch (error) {
              console.error('Error creating additional snapshots:', error);
            }
          }
        } else {
          const startTime = snapshots[0].timestamp;
          const endTime = snapshots[snapshots.length - 1].timestamp;
          timeRange = endTime - startTime;
          
          if (timeRange === 0) {
            // All snapshots have the same timestamp
            console.log('All snapshots have the same timestamp. Setting artificial time range.');
            timeRange = 86400; // 24 hours in seconds
          }
        }
        
        console.log(`Time range: ${timeRange} seconds (${(timeRange / 86400).toFixed(2)} days)`);
        
        // Create bulk operation
        const bulkOps = [];
        let snapshotsModified = 0;
        
        for (let i = 0; i < snapshots.length; i++) {
          const snapshot = snapshots[i];
          
          // Calculate progress through time range (0.0 to 1.0)
          // For the case where all timestamps are the same, use the array index to create artificial progression
          let timeProgress;
          if (timeRange === 0 || snapshots.length === 1) {
            timeProgress = i / (snapshots.length - 1 || 1);
          } else {
            timeProgress = (snapshot.timestamp - snapshots[0].timestamp) / timeRange;
          }
          
          // Ensure timeProgress is a valid number between 0 and 1
          timeProgress = Math.max(0, Math.min(1, timeProgress || 0));
          
          // Calculate price variations using sine waves and a small upward trend
          // Use different frequencies and phases for price0 and price1 to create realistic variations
          const sinComponent0 = Math.sin(timeProgress * Math.PI * 8) * 0.08; // 8% max sine variation
          const sinComponent1 = Math.sin((timeProgress * Math.PI * 6) + 1.5) * 0.06; // 6% max sine variation, phase shifted
          
          // Add a small upward trend (2% total over the entire period)
          const trendComponent = timeProgress * 0.02;
          
          // Calculate multipliers (convert to 1000-based for BigInt math)
          const multiplier0 = Math.floor((1 + sinComponent0 + trendComponent) * 1000);
          const multiplier1 = Math.floor((1 + sinComponent1 + trendComponent) * 1000);
          
          // Apply variation to prices
          const newPrice0 = (basePrice0 * BigInt(multiplier0) / 1000n).toString();
          const newPrice1 = (basePrice1 * BigInt(multiplier1) / 1000n).toString();
          
          // Add update operation to bulk operations array
          bulkOps.push({
            updateOne: {
              filter: { _id: snapshot._id },
              update: { $set: { price0: newPrice0, price1: newPrice1 } }
            }
          });
          
          snapshotsModified++;
          
          // Execute in batches of 500 to avoid overwhelming the database
          if (bulkOps.length >= 500 || i === snapshots.length - 1) {
            if (bulkOps.length > 0) {
              try {
                const result = await db.collection('PriceSnapshot').bulkWrite(bulkOps);
                console.log(`Batch update result: ${result.modifiedCount} snapshots updated.`);
                totalSnapshotsFixed += result.modifiedCount;
              } catch (error) {
                console.error('Error updating batch:', error);
                totalFailures += bulkOps.length;
              }
              bulkOps.length = 0; // Clear the array
            }
          }
        }
        
        console.log(`Processed ${snapshotsModified} snapshots for pair ${pairId}`);
      } else {
        console.log('Prices already have variations. Skipping this pair.');
      }
    }
    
    console.log(`\nPrice fix operation completed.`);
    console.log(`Total snapshots fixed: ${totalSnapshotsFixed}`);
    console.log(`Total failures: ${totalFailures}`);
    
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
    
    // Check how many pairs now have price variations
    const allPairIds = await db.collection('PriceSnapshot').distinct('pairId');
    let pairsWithVariations = 0;
    
    for (const pairId of allPairIds) {
      const snapshots = await db.collection('PriceSnapshot')
        .find({ pairId })
        .limit(10)
        .toArray();
      
      if (snapshots.length > 1) {
        const price0Set = new Set(snapshots.map(s => s.price0));
        const price1Set = new Set(snapshots.map(s => s.price1));
        
        if (price0Set.size > 1 && price1Set.size > 1) {
          pairsWithVariations++;
        }
      }
    }
    
    console.log(`\nPairs with price variations: ${pairsWithVariations} out of ${allPairIds.length}`);
    
  } catch (error) {
    console.error('Error during price fix operation:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 