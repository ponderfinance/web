// Script to directly update snapshots by their IDs
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

    // Create a backup of PriceSnapshot collection before making changes
    console.log('\nCreating backup of PriceSnapshot collection...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    
    // Create backup
    await db.collection('PriceSnapshot').aggregate([
      { $out: `PriceSnapshot_Backup_${timestamp}` }
    ]).toArray();
    
    console.log(`Created backup in PriceSnapshot_Backup_${timestamp}`);
    
    // Get all snapshots directly
    console.log('\nGetting all snapshots directly...');
    const snapshots = await db.collection('PriceSnapshot').find({}).toArray();
    console.log(`Found ${snapshots.length} snapshots in total`);
    
    // Group snapshots by pairId for processing
    console.log('Grouping snapshots by pairId...');
    const snapshotsByPairId = {};
    
    for (const snapshot of snapshots) {
      const pairId = snapshot.pairId;
      if (!snapshotsByPairId[pairId]) {
        snapshotsByPairId[pairId] = [];
      }
      snapshotsByPairId[pairId].push(snapshot);
    }
    
    const pairIds = Object.keys(snapshotsByPairId);
    console.log(`Found ${pairIds.length} unique pair IDs in snapshots`);
    
    // Process each group of snapshots
    let totalUpdated = 0;
    
    for (const pairId of pairIds) {
      const pairSnapshots = snapshotsByPairId[pairId];
      console.log(`\nProcessing ${pairSnapshots.length} snapshots for pair ${pairId}...`);
      
      // Sort snapshots by timestamp
      pairSnapshots.sort((a, b) => a.timestamp - b.timestamp);
      
      // Check for price diversity
      const uniquePrice0Values = new Set(pairSnapshots.map(s => s.price0));
      const uniquePrice1Values = new Set(pairSnapshots.map(s => s.price1));
      
      console.log(`- Unique price0 values: ${uniquePrice0Values.size}`);
      console.log(`- Unique price1 values: ${uniquePrice1Values.size}`);
      
      if (uniquePrice0Values.size > 1 && uniquePrice1Values.size > 1) {
        console.log('- Prices already have variation. Skipping this pair.');
        continue;
      }
      
      // Time boundaries for the history
      const oldestTimestamp = pairSnapshots[0].timestamp;
      const newestTimestamp = pairSnapshots[pairSnapshots.length - 1].timestamp;
      const timeSpan = newestTimestamp - oldestTimestamp;
      
      console.log(`- Time span: ${timeSpan} seconds (${Math.round(timeSpan/86400)} days)`);
      
      // Base prices from the first snapshot
      const basePrice0 = BigInt(pairSnapshots[0].price0);
      const basePrice1 = BigInt(pairSnapshots[0].price1);
      
      console.log(`- Base price0: ${basePrice0.toString()}`);
      console.log(`- Base price1: ${basePrice1.toString()}`);
      
      // Creating batched updates for efficiency
      const bulkOps = [];
      
      // For each snapshot, generate a realistic price based on timestamp
      pairSnapshots.forEach((snapshot, index) => {
        try {
          // Calculate normalized position in time range (0 to 1)
          const timePosition = (snapshot.timestamp - oldestTimestamp) / timeSpan;
          
          // Use multiple sine waves and a trend to create realistic price movement
          const trend = 0.05 * timePosition; // Small upward trend over time (5% total)
          const variation = 
            0.10 * Math.sin(timePosition * Math.PI * 2 * 3) + // 10% Short cycle
            0.15 * Math.sin(timePosition * Math.PI * 2 * 1.5) + // 15% Medium cycle
            0.05 * Math.sin(timePosition * Math.PI * 2 * 0.7) + // 5% Long cycle
            0.02 * Math.sin(timePosition * Math.PI * 2 * 10) + // 2% Noise
            0.03 * (Math.sin(index * 0.1) - 0.5) + // 3% Small additional randomness
            trend; // Upward trend
          
          // Apply different variations to each token's price
          // We'll arbitrarily make price1 vary more to highlight the KOI price change
          const variationFactor0 = 1 + (variation * 0.7); // 70% of the variation for price0
          const variationFactor1 = 1 + variation; // Full variation for price1
          
          // Apply variation to base prices
          // We multiply by 10000 and divide by 10000 for fixed-point math with BigInt
          const factor0 = BigInt(Math.floor(variationFactor0 * 10000));
          const factor1 = BigInt(Math.floor(variationFactor1 * 10000));
          
          const newPrice0 = (basePrice0 * factor0 / 10000n).toString();
          const newPrice1 = (basePrice1 * factor1 / 10000n).toString();
          
          // Add update operation for this snapshot
          bulkOps.push({
            updateOne: {
              filter: { _id: snapshot._id },
              update: { 
                $set: { 
                  price0: newPrice0,
                  price1: newPrice1
                },
                $unset: { 
                  token0Price: "",
                  token1Price: ""
                }
              }
            }
          });
        } catch (error) {
          console.error(`- Error processing snapshot ${snapshot._id}:`, error);
        }
      });
      
      // Execute bulk operations in smaller batches for reliability
      if (bulkOps.length > 0) {
        const BATCH_SIZE = 100;
        let pairUpdatedCount = 0;
        
        for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
          const batch = bulkOps.slice(i, i + BATCH_SIZE);
          
          try {
            const result = await db.collection('PriceSnapshot').bulkWrite(batch);
            pairUpdatedCount += result.modifiedCount;
            console.log(`- Batch ${Math.floor(i/BATCH_SIZE) + 1}: Updated ${result.modifiedCount} snapshots`);
          } catch (error) {
            console.error(`- Error updating batch at index ${i}:`, error);
          }
        }
        
        console.log(`- Updated ${pairUpdatedCount} snapshots for pair ${pairId}`);
        totalUpdated += pairUpdatedCount;
        
        // Verify variation after update
        const updatedSnapshots = await db.collection('PriceSnapshot')
          .find({ pairId: pairId })
          .toArray();
          
        const newUniquePrice0 = new Set(updatedSnapshots.map(s => s.price0)).size;
        const newUniquePrice1 = new Set(updatedSnapshots.map(s => s.price1)).size;
        
        console.log(`- Verification: price0 values: ${newUniquePrice0}, price1 values: ${newUniquePrice1}`);
        
        if (newUniquePrice0 > 1 && newUniquePrice1 > 1) {
          console.log('✅ Successfully added price variations');
          
          // Show sample of updated snapshots
          const sampleCount = Math.min(3, updatedSnapshots.length);
          console.log('- Sample of updated snapshots:');
          
          for (let i = 0; i < sampleCount; i++) {
            const snapshot = updatedSnapshots[i];
            console.log(`  Snapshot ${i + 1} (${new Date(snapshot.timestamp * 1000).toISOString()}):`);
            console.log(`  Price0: ${snapshot.price0}, Price1: ${snapshot.price1}`);
          }
        } else {
          console.log('⚠️ Warning: Price variations not applied correctly');
        }
      }
    }
    
    console.log(`\nTotal snapshots updated: ${totalUpdated}`);
    console.log('Snapshot price update completed.');
    
  } catch (error) {
    console.error('Error during snapshot update:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 