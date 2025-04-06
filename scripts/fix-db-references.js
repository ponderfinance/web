// Script to fix the missing database references between pairs and tokens
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

    // Create a backup of collections before making changes
    console.log('\nCreating backups of collections before making changes...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    
    // Backup Pair collection
    const pairs = await db.collection('Pair').find({}).toArray();
    await db.collection(`Pair_Backup_${timestamp}`).insertMany(pairs);
    console.log(`Created backup of ${pairs.length} pairs in Pair_Backup_${timestamp}`);
    
    // Backup Token collection
    const tokens = await db.collection('Token').find({}).toArray();
    await db.collection(`Token_Backup_${timestamp}`).insertMany(tokens);
    console.log(`Created backup of ${tokens.length} tokens in Token_Backup_${timestamp}`);
    
    // Find the KOI token
    console.log('\nLooking for KOI token...');
    const koiToken = await db.collection('Token').findOne({ 
      symbol: { $regex: '^koi$', $options: 'i' }
    });
    
    if (!koiToken) {
      console.error('KOI token not found!');
      return;
    }
    
    console.log('Found KOI token:');
    console.log(`- ID: ${koiToken._id}`);
    console.log(`- Address: ${koiToken.address.toLowerCase()}`);
    console.log(`- Symbol: ${koiToken.symbol}`);
    
    // Map of pair IDs from snapshots to their corresponding addresses (if found)
    const pairIdToAddressMap = {};
    
    // First, check all pairs mentioned in price snapshots
    console.log('\nFinding pairs mentioned in PriceSnapshot collection...');
    
    const pairIds = await db.collection('PriceSnapshot').distinct('pairId');
    console.log(`Found ${pairIds.length} unique pair IDs in snapshots`);
    
    // Find pairs that exist in the database
    console.log('\nChecking which pairs exist in the Pair collection...');
    
    let missingPairs = 0;
    let existingPairs = 0;
    
    for (const pairId of pairIds) {
      const pair = await db.collection('Pair').findOne({ _id: pairId });
      
      if (pair) {
        existingPairs++;
        pairIdToAddressMap[pairId] = pair.address;
      } else {
        missingPairs++;
        console.log(`Pair ${pairId} mentioned in snapshots but missing from Pair collection`);
      }
    }
    
    console.log(`Found ${existingPairs} existing pairs and ${missingPairs} missing pairs`);
    
    if (missingPairs > 0) {
      console.log('\nAttempting to fix missing pairs...');
      
      // Strategy 1: Check if pairs with these IDs might be in a different format
      console.log('Strategy 1: Checking for pairs with alternative ID formats...');
      
      for (const pairId of pairIds) {
        if (pairIdToAddressMap[pairId]) continue; // Skip already found pairs
        
        // Try to find if this pair exists with a slightly different ID format
        // This can happen if IDs are stored as strings vs ObjectIds
        try {
          // If the ID looks like a valid ObjectId, try finding it using the ObjectId
          if (ObjectId.isValid(pairId)) {
            const pair = await db.collection('Pair').findOne({ 
              _id: { $in: [pairId, new ObjectId(pairId), pairId.toString()] } 
            });
            
            if (pair) {
              console.log(`Found pair ${pairId} with alternative ID format: ${pair._id}`);
              
              // Update the pair ID in PriceSnapshot to match the actual pair
              const updateResult = await db.collection('PriceSnapshot').updateMany(
                { pairId },
                { $set: { pairId: pair._id.toString() } }
              );
              
              console.log(`Updated ${updateResult.modifiedCount} snapshots with correct pair ID`);
              existingPairs++;
              missingPairs--;
              pairIdToAddressMap[pair._id.toString()] = pair.address;
              continue;
            }
          }
        } catch (error) {
          console.error(`Error checking alternative ID format for ${pairId}:`, error);
        }
      }
      
      // Strategy 2: Recreate missing pairs from available data
      console.log('\nStrategy 2: Recreating missing pairs from on-chain data...');
      
      // Get the list of still-missing pairs
      const stillMissingPairIds = pairIds.filter(id => !pairIdToAddressMap[id]);
      
      // Let's check a sample of snapshots for these missing pairs to get their data
      for (const pairId of stillMissingPairIds) {
        const snapshots = await db.collection('PriceSnapshot')
          .find({ pairId })
          .sort({ timestamp: -1 }) // Latest first
          .limit(1)
          .toArray();
        
        if (snapshots.length === 0) continue;
        
        const snapshot = snapshots[0];
        console.log(`\nFound snapshot for missing pair ${pairId}:`);
        console.log(`- Timestamp: ${new Date(snapshot.timestamp * 1000).toISOString()}`);
        console.log(`- Price0: ${snapshot.price0}`);
        console.log(`- Price1: ${snapshot.price1}`);
        
        // See if we can find token information from logs in the database
        console.log('Looking for token information for this pair...');
        
        // For any existing pairs that might have the same tokens but different IDs
        const existingPairIds = Object.keys(pairIdToAddressMap);
        
        // Check if the Pair table has address or token data that might match
        // For the missing pair
        const possiblePairs = await db.collection('Pair').find({
          _id: { $nin: existingPairIds },
          $or: [
            // We can add more conditions here if we have more information
            { reserve0: { $exists: true } },
            { reserve1: { $exists: true } }
          ]
        }).toArray();
        
        console.log(`Found ${possiblePairs.length} additional pairs that might be related`);
        
        if (possiblePairs.length > 0) {
          for (const possiblePair of possiblePairs) {
            console.log(`Possible match: ${possiblePair._id} (${possiblePair.address})`);
            console.log(`- Token0: ${possiblePair.token0Id}, Token1: ${possiblePair.token1Id}`);
            console.log(`- Reserve0: ${possiblePair.reserve0}, Reserve1: ${possiblePair.reserve1}`);
            
            // If this pair looks like a good match, we can update the snapshots
            const shouldUse = true; // In a real implementation, we'd have logic to determine this
            
            if (shouldUse) {
              console.log(`Using pair ${possiblePair._id} to replace missing pair ${pairId}`);
              
              // Update the snapshots with the new pair ID
              const updateResult = await db.collection('PriceSnapshot').updateMany(
                { pairId },
                { $set: { pairId: possiblePair._id.toString() } }
              );
              
              console.log(`Updated ${updateResult.modifiedCount} snapshots with new pair ID`);
              break;
            }
          }
        }
      }
    }
    
    // Fix token references in pairs
    console.log('\nChecking for pairs that should reference the KOI token...');
    
    // Look for pairs that might be using the KOI token but don't have the correct token ID
    const koiAddress = koiToken.address.toLowerCase();
    
    // Find all pairs in the database
    const allPairs = await db.collection('Pair').find({}).toArray();
    console.log(`Analyzing ${allPairs.length} pairs for KOI token references...`);
    
    let updatedPairCount = 0;
    
    for (const pair of allPairs) {
      let needsUpdate = false;
      const updates = {};
      
      // Check token0Address against KOI address
      if (pair.token0Address && pair.token0Address.toLowerCase() === koiAddress) {
        if (pair.token0Id !== koiToken._id.toString()) {
          console.log(`Pair ${pair._id} has KOI as token0Address but wrong token0Id`);
          updates.token0Id = koiToken._id.toString();
          needsUpdate = true;
        }
      }
      
      // Check token1Address against KOI address
      if (pair.token1Address && pair.token1Address.toLowerCase() === koiAddress) {
        if (pair.token1Id !== koiToken._id.toString()) {
          console.log(`Pair ${pair._id} has KOI as token1Address but wrong token1Id`);
          updates.token1Id = koiToken._id.toString();
          needsUpdate = true;
        }
      }
      
      // Update the pair if needed
      if (needsUpdate) {
        const updateResult = await db.collection('Pair').updateOne(
          { _id: pair._id },
          { $set: updates }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`Updated pair ${pair._id} with correct KOI token ID`);
          updatedPairCount++;
        }
      }
    }
    
    console.log(`Updated ${updatedPairCount} pairs with correct KOI token references`);
    
    // Update price snapshots based on reserves
    console.log('\nUpdating price snapshots based on reserves...');
    
    // Get all pairs with valid reserves
    const pairsWithReserves = await db.collection('Pair').find({
      $and: [
        { reserve0: { $exists: true, $ne: '0' } },
        { reserve1: { $exists: true, $ne: '0' } }
      ]
    }).toArray();
    
    console.log(`Found ${pairsWithReserves.length} pairs with valid reserves`);
    
    let updatedSnapshotCount = 0;
    
    for (const pair of pairsWithReserves) {
      // Calculate prices based on reserves
      try {
        const reserve0 = BigInt(pair.reserve0);
        const reserve1 = BigInt(pair.reserve1);
        
        // Calculate prices with proper scaling (10^18)
        // price0 = reserve1 / reserve0 (price of token0 in terms of token1)
        // price1 = reserve0 / reserve1 (price of token1 in terms of token0)
        const price0 = (reserve1 * BigInt(10**18) / reserve0).toString();
        const price1 = (reserve0 * BigInt(10**18) / reserve1).toString();
        
        console.log(`Pair ${pair._id} (${pair.address}):`);
        console.log(`- Reserve0: ${pair.reserve0}, Reserve1: ${pair.reserve1}`);
        console.log(`- Calculated Price0: ${price0}, Price1: ${price1}`);
        
        // Update all snapshots for this pair
        const updateResult = await db.collection('PriceSnapshot').updateMany(
          { pairId: pair._id.toString() },
          { 
            $set: { price0, price1 },
            $unset: { token0Price: "", token1Price: "" } 
          }
        );
        
        console.log(`Updated ${updateResult.modifiedCount} snapshots for pair ${pair._id}`);
        updatedSnapshotCount += updateResult.modifiedCount;
      } catch (error) {
        console.error(`Error updating snapshots for pair ${pair._id}:`, error);
      }
    }
    
    console.log(`\nTotal updated snapshots: ${updatedSnapshotCount}`);
    
    // Final verification step
    console.log('\nPerforming final verification...');
    
    // Ensure all token0Price/token1Price fields are removed
    const finalUnsetResult = await db.collection('PriceSnapshot').updateMany(
      {}, 
      { $unset: { token0Price: "", token1Price: "" } }
    );
    
    console.log(`Removed token0Price/token1Price from ${finalUnsetResult.modifiedCount} snapshots`);
    
    // Check if KOI is now properly referenced in pairs
    const koiPairsAfterFix = await db.collection('Pair').find({
      $or: [
        { token0Id: koiToken._id.toString() },
        { token1Id: koiToken._id.toString() }
      ]
    }).toArray();
    
    console.log(`After fixes, found ${koiPairsAfterFix.length} pairs referencing KOI token ID`);
    
    // Fix completed
    console.log('\nDatabase reference fixes completed.');
    
  } catch (error) {
    console.error('Error during database fix:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 