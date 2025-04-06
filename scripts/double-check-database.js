// Script to double-check what's happening with the database
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

    const db = client.db();

    // Get all collections
    console.log('\nListing all collections in the database:');
    const collections = await db.listCollections().toArray();
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    // Check for ObjectID vs String ID format in the collections
    console.log('\nChecking ID formats in each collection:');
    
    for (const collection of collections) {
      try {
        const sampleDoc = await db.collection(collection.name).findOne({});
        if (sampleDoc) {
          const idType = typeof sampleDoc._id;
          const idValue = sampleDoc._id.toString();
          console.log(`- ${collection.name}: ID type = ${idType}, value = ${idValue}`);
        } else {
          console.log(`- ${collection.name}: No documents found`);
        }
      } catch (error) {
        console.log(`- ${collection.name}: Error checking ID format - ${error.message}`);
      }
    }

    // Check actual document structure for Pair and PriceSnapshot
    console.log('\nExamining structures of key collections:');
    
    // First check Pair collection
    console.log('\nPair collection:');
    const pairs = await db.collection('Pair').find({}).limit(1).toArray();
    if (pairs.length > 0) {
      const pair = pairs[0];
      console.log('Sample pair document structure:');
      console.log(JSON.stringify(pair, null, 2));
      
      // Now find any token that should be in this pair
      if (pair.token0Id) {
        console.log('\nLooking up token0 referenced in pair:');
        const token0 = await db.collection('Token').findOne({ _id: pair.token0Id });
        if (token0) {
          console.log('Found token0:');
          console.log(`- ID: ${token0._id}`);
          console.log(`- Symbol: ${token0.symbol}`);
          console.log(`- Address: ${token0.address}`);
        } else {
          console.log(`Token0 with ID ${pair.token0Id} not found!`);
        }
      }
    } else {
      console.log('No pairs found in the database');
    }
    
    // Then check PriceSnapshot collection
    console.log('\nPriceSnapshot collection:');
    const snapshots = await db.collection('PriceSnapshot').find({}).limit(1).toArray();
    if (snapshots.length > 0) {
      const snapshot = snapshots[0];
      console.log('Sample price snapshot document structure:');
      console.log(JSON.stringify(snapshot, null, 2));
      
      // Now try to find the pair for this snapshot
      if (snapshot.pairId) {
        console.log('\nLooking up pair referenced in snapshot:');
        
        // Check different formats of the ID
        const pair = await db.collection('Pair').findOne({ 
          $or: [
            { _id: snapshot.pairId },
            { _id: new ObjectId(snapshot.pairId) },
            { _id: snapshot.pairId.toString() }
          ]
        });
        
        if (pair) {
          console.log('Found pair:');
          console.log(`- ID: ${pair._id}`);
          console.log(`- Address: ${pair.address}`);
          console.log(`- Token0ID: ${pair.token0Id}`);
          console.log(`- Token1ID: ${pair.token1Id}`);
        } else {
          console.log(`Pair with ID ${snapshot.pairId} not found!`);
          
          // Try a different approach - look up by using exact string match
          console.log('Trying exact string match...');
          const pairByString = await db.collection('Pair').findOne({ 
            _id: { $in: [snapshot.pairId.toString()] }
          });
          
          if (pairByString) {
            console.log('Found pair by string match:');
            console.log(`- ID: ${pairByString._id}`);
            console.log(`- Address: ${pairByString.address}`);
          } else {
            console.log('Still no match found');
          }
        }
      }
    } else {
      console.log('No price snapshots found in the database');
    }
    
    // Try to directly test update functionality with a single snapshot
    console.log('\nTesting update functionality on a single snapshot:');
    
    const testSnapshot = await db.collection('PriceSnapshot').findOne({});
    if (testSnapshot) {
      // Save original values
      const originalPrice0 = testSnapshot.price0;
      const originalPrice1 = testSnapshot.price1;
      
      console.log(`Original Price0: ${originalPrice0}`);
      console.log(`Original Price1: ${originalPrice1}`);
      
      // Try a simple update
      const newPrice0 = (BigInt(originalPrice0) * 1010n / 1000n).toString(); // 1% increase
      const newPrice1 = (BigInt(originalPrice1) * 1020n / 1000n).toString(); // 2% increase
      
      console.log(`New Price0: ${newPrice0}`);
      console.log(`New Price1: ${newPrice1}`);
      
      // Attempt update with different approaches
      console.log('\nAttempting update with different approaches:');
      
      // Try 1: Basic updateOne
      try {
        const updateResult1 = await db.collection('PriceSnapshot').updateOne(
          { _id: testSnapshot._id },
          { $set: { price0: newPrice0, price1: newPrice1 }}
        );
        
        console.log(`Basic updateOne result: matchedCount=${updateResult1.matchedCount}, modifiedCount=${updateResult1.modifiedCount}`);
      } catch (error) {
        console.error('Error with basic updateOne:', error);
      }
      
      // Check if update worked
      const updatedSnapshot = await db.collection('PriceSnapshot').findOne({ _id: testSnapshot._id });
      if (updatedSnapshot) {
        console.log(`After update - Price0: ${updatedSnapshot.price0}`);
        console.log(`After update - Price1: ${updatedSnapshot.price1}`);
        
        if (updatedSnapshot.price0 === newPrice0 && updatedSnapshot.price1 === newPrice1) {
          console.log('✅ Update succeeded! Database can be modified.');
        } else {
          console.log('❌ Update failed or changes not applied.');
          
          // Try 2: With manual string conversion
          console.log('\nTrying with manual string conversion...');
          try {
            const updateResult2 = await db.collection('PriceSnapshot').updateOne(
              { _id: testSnapshot._id.toString() },
              { $set: { price0: newPrice0.toString(), price1: newPrice1.toString() }}
            );
            
            console.log(`String conversion update result: matchedCount=${updateResult2.matchedCount}, modifiedCount=${updateResult2.modifiedCount}`);
            
            // Check again
            const doublyUpdatedSnapshot = await db.collection('PriceSnapshot').findOne({ _id: testSnapshot._id });
            console.log(`After second update - Price0: ${doublyUpdatedSnapshot.price0}`);
            console.log(`After second update - Price1: ${doublyUpdatedSnapshot.price1}`);
          } catch (error) {
            console.error('Error with string conversion update:', error);
          }
        }
      } else {
        console.log('Could not find the snapshot after attempted update!');
      }
      
      // Try one more unconventional approach - cast to ObjectId
      console.log('\nTrying with ObjectId conversion...');
      try {
        // Only do this if the ID looks like a valid ObjectId
        if (ObjectId.isValid(testSnapshot._id)) {
          const objId = new ObjectId(testSnapshot._id);
          const updateResult3 = await db.collection('PriceSnapshot').updateOne(
            { _id: objId },
            { $set: { 
              // Use completely different values to be sure
              price0: (BigInt(originalPrice0) * 1050n / 1000n).toString(), 
              price1: (BigInt(originalPrice1) * 1070n / 1000n).toString()
            }}
          );
          
          console.log(`ObjectId update result: matchedCount=${updateResult3.matchedCount}, modifiedCount=${updateResult3.modifiedCount}`);
        } else {
          console.log('ID is not a valid ObjectId format');
        }
      } catch (error) {
        console.error('Error with ObjectId update:', error);
      }
    } else {
      console.log('No snapshots found for test update');
    }
    
    // Check if read-only permissions might be the issue
    console.log('\nChecking if database might be read-only:');
    try {
      // Try to create a temporary collection
      const tempCollName = `temp_test_${Date.now()}`;
      await db.createCollection(tempCollName);
      console.log(`Successfully created a test collection: ${tempCollName}`);
      
      // Try to insert a document
      const insertResult = await db.collection(tempCollName).insertOne({ test: 'value' });
      console.log(`Insert result: ${insertResult.acknowledged ? 'Success' : 'Failed'}`);
      
      // Try to delete the collection
      await db.collection(tempCollName).drop();
      console.log(`Successfully dropped the test collection`);
      
      console.log('✅ Database appears to have write permissions');
    } catch (error) {
      console.error('❌ Error testing write permissions:', error);
      console.log('Database might be read-only');
    }
    
    console.log('\nDatabase check completed. See results above.');
    
  } catch (error) {
    console.error('Error during database check:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 