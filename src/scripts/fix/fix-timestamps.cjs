const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
  console.log('Starting to fix timestamps in price snapshots...');
  
  // Connect to MongoDB
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI environment variable not set');
    return;
  }
  
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db();
    const snapshotCollection = db.collection('PriceSnapshot');
    
    // Get total count of snapshots
    const totalSnapshots = await snapshotCollection.countDocuments();
    console.log(`Total snapshots found: ${totalSnapshots}`);
    
    // Process in batches of 1000
    const batchSize = 1000;
    let processedCount = 0;
    let updatedCount = 0;
    
    // Create cursor for batch processing
    const cursor = snapshotCollection.find({}).batchSize(batchSize);
    
    while (await cursor.hasNext()) {
      const snapshot = await cursor.next();
      processedCount++;
      
      let needsUpdate = false;
      let timestamp = snapshot.timestamp;
      
      try {
        // Check if timestamp is a Date object
        if (timestamp instanceof Date) {
          timestamp = Math.floor(timestamp.getTime() / 1000);
          needsUpdate = true;
        }
        // Check if timestamp is a string that can be parsed as a date
        else if (typeof timestamp === 'string' && !isNaN(Date.parse(timestamp))) {
          timestamp = Math.floor(Date.parse(timestamp) / 1000);
          needsUpdate = true;
        }
        // Check if timestamp is in milliseconds (13 digits)
        else if (typeof timestamp === 'number' && timestamp.toString().length === 13) {
          timestamp = Math.floor(timestamp / 1000);
          needsUpdate = true;
        }
        // Check if timestamp is a string number
        else if (typeof timestamp === 'string' && !isNaN(timestamp)) {
          timestamp = parseInt(timestamp, 10);
          // Check if it's in milliseconds
          if (timestamp.toString().length === 13) {
            timestamp = Math.floor(timestamp / 1000);
          }
          needsUpdate = true;
        }

        if (needsUpdate) {
          await snapshotCollection.updateOne(
            { _id: snapshot._id },
            { $set: { timestamp: timestamp } }
          );
          updatedCount++;
        }

        // Log progress every 1000 documents
        if (processedCount % 1000 === 0) {
          const progress = ((processedCount / totalSnapshots) * 100).toFixed(2);
          console.log(`Progress: ${progress}% (${processedCount}/${totalSnapshots})`);
          console.log(`Updated so far: ${updatedCount}`);
          
          // Log a sample of what we're processing
          console.log('Sample snapshot being processed:', {
            id: snapshot._id,
            originalTimestamp: snapshot.timestamp,
            newTimestamp: timestamp,
            needsUpdate
          });
        }
      } catch (error) {
        console.error(`Error processing snapshot ${snapshot._id}:`, error);
        // Continue with next snapshot
        continue;
      }
    }
    
    console.log(`\nTimestamp fix completed:`);
    console.log(`- Total snapshots processed: ${processedCount}`);
    console.log(`- Snapshots updated: ${updatedCount}`);
    
    // Verify the results
    const verificationSample = await snapshotCollection
      .find({})
      .limit(5)
      .sort({ timestamp: -1 })
      .toArray();
    
    console.log('\nVerification sample (5 most recent snapshots):');
    verificationSample.forEach(snapshot => {
      console.log({
        id: snapshot._id,
        timestamp: snapshot.timestamp,
        date: new Date(snapshot.timestamp * 1000).toISOString()
      });
    });
    
  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Execute the function
main(); 