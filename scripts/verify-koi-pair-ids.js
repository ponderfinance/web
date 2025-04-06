// Script to verify KOI pair IDs and their snapshots
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

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

    // Look for the KOI token
    console.log('\nLooking for KOI token (case-insensitive)...');
    const koiToken = await db.collection('Token').findOne({ 
      symbol: { $regex: '^koi$', $options: 'i' }
    });
    
    if (!koiToken) {
      console.error('KOI token not found!');
      return;
    }
    
    console.log('Found KOI token:');
    console.log(`- ID: ${koiToken._id}`);
    console.log(`- Address: ${koiToken.address}`);
    console.log(`- Symbol: ${koiToken.symbol}`);
    console.log(`- Decimals: ${koiToken.decimals}`);
    
    // Comprehensive check for pairs involving KOI
    console.log('\nPerforming comprehensive check for pairs involving KOI...');
    
    // First, find all pairs that explicitly list KOI as token0 or token1
    const koiPairs = await db.collection('Pair').find({
      $or: [
        { token0Id: koiToken._id.toString() },
        { token1Id: koiToken._id.toString() }
      ]
    }).toArray();
    
    console.log(`Found ${koiPairs.length} pairs explicitly referencing KOI token ID`);
    
    // Second, look for pairs that might have the KOI address but not the ID reference
    const koiAddressPairs = await db.collection('Pair').find({
      $or: [
        { token0Address: koiToken.address.toLowerCase() },
        { token1Address: koiToken.address.toLowerCase() }
      ]
    }).toArray();
    
    console.log(`Found ${koiAddressPairs.length} pairs referencing KOI token address`);
    
    // Check all snapshots to see which ones are associated with KOI pairs
    // Let's examine a sample of snapshots
    console.log('\nExamining PriceSnapshot collection to find KOI-related snapshots...');
    
    // Look at all snapshots
    const allSnapshots = await db.collection('PriceSnapshot').find({}).limit(50).toArray();
    console.log(`Sampling ${allSnapshots.length} snapshots out of the total collection`);
    
    // Group snapshots by pairId to see if any patterns emerge
    const pairCounts = {};
    allSnapshots.forEach(snapshot => {
      pairCounts[snapshot.pairId] = (pairCounts[snapshot.pairId] || 0) + 1;
    });
    
    const pairIds = Object.keys(pairCounts);
    console.log(`Found ${pairIds.length} unique pair IDs in the snapshot sample`);
    
    // For each pairId, fetch the actual pair and see if it's related to KOI
    console.log('\nInvestigating pairs found in snapshots...');
    
    for (const pairId of pairIds) {
      const pair = await db.collection('Pair').findOne({ _id: pairId });
      if (!pair) {
        console.log(`Pair ${pairId} referenced in snapshots but not found in Pair collection!`);
        continue;
      }
      
      const isKoiPair = pair.token0Id === koiToken._id.toString() || 
                         pair.token1Id === koiToken._id.toString() ||
                         pair.token0Address?.toLowerCase() === koiToken.address.toLowerCase() ||
                         pair.token1Address?.toLowerCase() === koiToken.address.toLowerCase();
      
      console.log(`Pair ${pairId} (address: ${pair.address}):`);
      console.log(`- Contains KOI: ${isKoiPair}`);
      console.log(`- Token0: ${pair.token0Id}, Address: ${pair.token0Address}`);
      console.log(`- Token1: ${pair.token1Id}, Address: ${pair.token1Address}`);
      
      // If this is a KOI pair, get snapshots associated with it
      if (isKoiPair) {
        // Get a sample of snapshots for this pair
        const pairSnapshots = await db.collection('PriceSnapshot')
          .find({ pairId })
          .sort({ timestamp: 1 })
          .limit(3)
          .toArray();
        
        if (pairSnapshots.length > 0) {
          console.log(`- Sample snapshots for this pair:`);
          pairSnapshots.forEach((snapshot, index) => {
            console.log(`  Snapshot ${index + 1}: Timestamp ${new Date(snapshot.timestamp * 1000).toISOString()}`);
            console.log(`    Price0: ${snapshot.price0}, Price1: ${snapshot.price1}`);
            if (snapshot.token0Price) console.log(`    Token0Price: ${snapshot.token0Price}`);
            if (snapshot.token1Price) console.log(`    Token1Price: ${snapshot.token1Price}`);
          });
          
          // Check for price diversity
          const allPairSnapshots = await db.collection('PriceSnapshot')
            .find({ pairId })
            .toArray();
          
          const uniquePrice0 = new Set(allPairSnapshots.map(s => s.price0)).size;
          const uniquePrice1 = new Set(allPairSnapshots.map(s => s.price1)).size;
          
          console.log(`- Stats: ${allPairSnapshots.length} total snapshots`);
          console.log(`  Unique price0 values: ${uniquePrice0}`);
          console.log(`  Unique price1 values: ${uniquePrice1}`);
          
          if (uniquePrice0 === 1 && uniquePrice1 === 1) {
            console.log('⚠️ WARNING: All prices are identical! Chart will be flat.');
          }
        } else {
          console.log(`- No snapshots found for this pair.`);
        }
      }
    }
    
    // Check if the token IDs associated with KOI in pairs match
    console.log('\nVerifying token IDs associated with KOI in pairs...');
    
    // Aggregate all token IDs that are paired with KOI
    const pairedTokenIds = [];
    koiPairs.forEach(pair => {
      if (pair.token0Id === koiToken._id.toString()) {
        pairedTokenIds.push(pair.token1Id);
      } else if (pair.token1Id === koiToken._id.toString()) {
        pairedTokenIds.push(pair.token0Id);
      }
    });
    
    console.log(`Found ${pairedTokenIds.length} token IDs paired with KOI`);
    
    // Look up the paired tokens
    if (pairedTokenIds.length > 0) {
      const pairedTokens = await db.collection('Token')
        .find({ _id: { $in: pairedTokenIds } })
        .toArray();
      
      console.log('Tokens paired with KOI:');
      pairedTokens.forEach(token => {
        console.log(`- ID: ${token._id}, Symbol: ${token.symbol}, Address: ${token.address}`);
      });
    }
    
    // Look up any PriceSnapshot issues
    console.log('\nVerifying if snapshots need to be updated...');
    
    // Check if any KOI pairs have snapshots where token0Price or token1Price is set
    const snapshotsWithDerivedPrices = [];
    for (const pair of koiPairs) {
      const snapshots = await db.collection('PriceSnapshot').find({
        pairId: pair._id.toString(),
        $or: [
          { token0Price: { $exists: true } },
          { token1Price: { $exists: true } }
        ]
      }).limit(10).toArray();
      
      snapshotsWithDerivedPrices.push(...snapshots);
    }
    
    console.log(`Found ${snapshotsWithDerivedPrices.length} snapshots with token0Price or token1Price set`);
    
    if (snapshotsWithDerivedPrices.length > 0) {
      console.log('Example of a snapshot with derived prices:');
      console.log(snapshotsWithDerivedPrices[0]);
    } else {
      console.log('No snapshots with derived prices found. The unsetting operation was successful!');
    }
    
    console.log('\nVerification complete.');
    
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 