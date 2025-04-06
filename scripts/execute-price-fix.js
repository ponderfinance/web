// Script to directly fix price data in MongoDB
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

async function main() {
  // Try to load MONGO_URI directly from .env file
  try {
    const envPath = path.resolve(__dirname, '../.env');
    console.log(`Attempting to read .env file from: ${envPath}`);
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      console.log('Found .env file, scanning for MONGO_URI...');
      
      // Extract MONGO_URI using regex
      const mongoUriMatch = envContent.match(/MONGO_URI=["']?(.*?)["']?(\r?\n|$)/);
      const mongoUri = mongoUriMatch ? mongoUriMatch[1] : null;
      
      if (mongoUri) {
        console.log(`Found MONGO_URI in .env file (first 15 chars): ${mongoUri.substring(0, 15)}...`);
        
        await runFix(mongoUri);
        return;
      } else {
        console.error('MONGO_URI not found in .env file');
      }
    } else {
      console.error(`.env file not found at ${envPath}`);
    }
  } catch (error) {
    console.error('Error reading .env file:', error);
  }
  
  // Fallback to environment variable
  const envMongoUri = process.env.MONGO_URI;
  if (envMongoUri) {
    console.log('Using MONGO_URI from environment variables');
    await runFix(envMongoUri);
    return;
  }
  
  console.error('Error: MONGO_URI not found in .env file or environment variables');
  process.exit(1);
}

async function runFix(mongoUri) {
  console.log('Starting price data restoration...');

  let client;
  try {
    // Connect to MongoDB
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Successfully connected to MongoDB');

    // Get database
    const db = client.db();
    
    // 1. Create a backup of current snapshots
    console.log('Creating backup of current price snapshots...');
    const snapshots = await db.collection('PriceSnapshot').find({}).toArray();
    console.log(`Found ${snapshots.length} price snapshots to back up`);
    
    // Save backup to a new collection
    const backupCollectionName = 'PriceSnapshot_Backup_' + new Date().toISOString().replace(/[:.]/g, '_');
    await db.collection(backupCollectionName).insertMany(snapshots);
    console.log(`Created backup in collection: ${backupCollectionName}`);

    // 2. Get all pairs with their reserves
    console.log('Fetching pairs and their current reserves...');
    const pairs = await db.collection('Pair').find({}).toArray();
    console.log(`Found ${pairs.length} pairs`);

    // 3. Process each pair and update its snapshots
    let updatedSnapshots = 0;
    let skippedPairs = 0;
    let errorPairs = 0;

    for (const pair of pairs) {
      // Skip pairs with zero reserves
      if (!pair.reserve0 || !pair.reserve1 || 
          pair.reserve0 === '0' || pair.reserve1 === '0') {
        console.log(`Skipping pair ${pair._id} with zero reserves`);
        skippedPairs++;
        continue;
      }

      try {
        // Calculate prices based on reserves (same as indexer would)
        const reserve0 = BigInt(pair.reserve0);
        const reserve1 = BigInt(pair.reserve1);
        
        // Calculate prices with proper scaling (10^18)
        // price0 = reserve1 / reserve0 (price of token0 in terms of token1)
        // price1 = reserve0 / reserve1 (price of token1 in terms of token0)
        const price0 = (reserve1 * BigInt(10**18) / reserve0).toString();
        const price1 = (reserve0 * BigInt(10**18) / reserve1).toString();

        console.log(`Updating snapshots for pair ${pair._id}:`);
        console.log(`- reserve0: ${pair.reserve0}, reserve1: ${pair.reserve1}`);
        console.log(`- price0: ${price0}, price1: ${price1}`);

        // Update all snapshots for this pair
        const updateResult = await db.collection('PriceSnapshot').updateMany(
          { pairId: pair._id.toString() },
          { 
            $set: { price0, price1 },
            $unset: { token0Price: "", token1Price: "" } 
          }
        );

        console.log(`Updated ${updateResult.modifiedCount} snapshots for pair ${pair._id}`);
        updatedSnapshots += updateResult.modifiedCount;
      } catch (error) {
        console.error(`Error processing pair ${pair._id}:`, error);
        errorPairs++;
      }
    }

    // 4. Ensure all token0Price/token1Price fields are removed to force resolver recalculation
    const finalUnsetResult = await db.collection('PriceSnapshot').updateMany(
      {}, 
      { $unset: { token0Price: "", token1Price: "" } }
    );

    console.log('\nSummary of price restoration:');
    console.log(`- Total pairs processed: ${pairs.length}`);
    console.log(`- Pairs skipped (zero reserves): ${skippedPairs}`);
    console.log(`- Pairs with errors: ${errorPairs}`);
    console.log(`- Total snapshots updated: ${updatedSnapshots}`);
    console.log(`- Final unset operation affected ${finalUnsetResult.modifiedCount} snapshots`);
    
    // 5. Verify results by sampling a few snapshots
    console.log('\nVerifying results with sample snapshots:');
    
    // Sample 5 snapshots 
    const sampleSnapshots = await db.collection('PriceSnapshot')
      .aggregate([
        { $sample: { size: 5 } },
        {
          $lookup: {
            from: "Pair",
            localField: "pairId",
            foreignField: "_id", 
            as: "pair"
          }
        },
        { $unwind: "$pair" },
        {
          $project: {
            _id: 1,
            pairId: 1,
            price0: 1,
            price1: 1,
            pairAddress: "$pair.address",
            reserve0: "$pair.reserve0",
            reserve1: "$pair.reserve1"
          }
        }
      ]).toArray();
    
    // Display sample snapshots
    sampleSnapshots.forEach((snapshot, index) => {
      console.log(`\nSample ${index + 1}:`);
      console.log(`- Pair: ${snapshot.pairAddress}`);
      console.log(`- Reserves: ${snapshot.reserve0} / ${snapshot.reserve1}`);
      console.log(`- Price0: ${snapshot.price0}`);
      console.log(`- Price1: ${snapshot.price1}`);
      
      // Verify calculation
      try {
        const calculatedPrice0 = (BigInt(snapshot.reserve1) * BigInt(10**18) / BigInt(snapshot.reserve0)).toString();
        const calculatedPrice1 = (BigInt(snapshot.reserve0) * BigInt(10**18) / BigInt(snapshot.reserve1)).toString();
        
        const price0Matches = calculatedPrice0 === snapshot.price0;
        const price1Matches = calculatedPrice1 === snapshot.price1;
        
        console.log(`- Verification: price0 ${price0Matches ? 'CORRECT' : 'INCORRECT'}, price1 ${price1Matches ? 'CORRECT' : 'INCORRECT'}`);
      } catch (error) {
        console.log(`- Verification error: ${error.message}`);
      }
    });

    console.log('\nPrice restoration completed successfully.');
    console.log('Please restart your application to see the corrected prices.');
    
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