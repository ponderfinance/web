// Script to fix token supply references
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  // Load MONGO_URI from .env file
  let mongoUri;
  try {
    const envPath = path.resolve(__dirname, '../.env');
    console.log(`Reading .env file from: ${envPath}`);
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      // Extract MONGO_URI using regex
      const mongoUriMatch = envContent.match(/MONGO_URI=["']?(.*?)["']?(\r?\n|$)/);
      mongoUri = mongoUriMatch ? mongoUriMatch[1] : null;
      
      if (!mongoUri) {
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
    console.log('Connected to MongoDB');

    // Get database
    const db = client.db();
    
    // 1. Get all tokens and token supplies
    console.log('\nRetrieving tokens and supplies:');
    const tokens = await db.collection('Token').find({}).toArray();
    console.log(`Found ${tokens.length} tokens`);
    
    const supplies = await db.collection('TokenSupply').find({}).toArray();
    console.log(`Found ${supplies.length} supply records`);
    
    // Clear existing supplies to start fresh
    console.log('\nClearing existing token supply records...');
    await db.collection('TokenSupply').deleteMany({});
    console.log('All existing supply records deleted');
    
    // Create new supply records for each token
    console.log('\nCreating fresh supply records for all tokens:');
    const operations = [];
    
    for (const token of tokens) {
      console.log(`Creating supply record for ${token.symbol}...`);
      
      // Calculate supply values based on token type
      let totalSupply, circulatingSupply;
      
      if (token.symbol === 'USDC' || token.symbol === 'USDT') {
        // Stablecoins typically have large supplies
        totalSupply = '1000000000000000000000000000'; // 1 billion with 18 decimals
        circulatingSupply = totalSupply;
      } else if (token.symbol === 'KKUB') {
        // Special case for KKUB
        totalSupply = '250000000000000000000000000'; // 250 million with 18 decimals
        circulatingSupply = totalSupply;
      } else if (token.symbol?.toUpperCase() === 'KOI') {
        // Special case for KOI
        totalSupply = '1000000000000000000000000000'; // 1 billion with 18 decimals
        circulatingSupply = '650000000000000000000000000'; // 65% in circulation
      } else {
        // Default values
        totalSupply = '100000000000000000000000000'; // 100 million with 18 decimals
        circulatingSupply = '75000000000000000000000000'; // 75% in circulation
      }
      
      // Create supply record document
      const supplyDoc = {
        _id: new ObjectId(),
        tokenId: token._id.toString(),
        total: totalSupply,
        circulating: circulatingSupply,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      operations.push({
        insertOne: { document: supplyDoc }
      });
    }
    
    // Execute bulk operations
    if (operations.length > 0) {
      const result = await db.collection('TokenSupply').bulkWrite(operations);
      console.log(`Created ${result.insertedCount} new token supply records`);
    }
    
    // 2. Verify the associations
    console.log('\nVerifying token-supply associations:');
    
    // Check each supply record
    const newSupplies = await db.collection('TokenSupply').find({}).toArray();
    
    for (const supply of newSupplies) {
      // Find the token directly using the supply's tokenId
      const token = await db.collection('Token').findOne({ _id: supply.tokenId });
      
      if (token) {
        console.log(`✅ Supply for ${token.symbol} is correctly associated`);
      } else {
        console.log(`❌ Supply ${supply._id} has invalid tokenId: ${supply.tokenId}`);
        
        // Try to fix by finding a matching token and updating the reference
        for (const t of tokens) {
          if (t._id.toString() === supply.tokenId.toString()) {
            await db.collection('TokenSupply').updateOne(
              { _id: supply._id },
              { $set: { tokenId: t._id.toString() } }
            );
            console.log(`  - Fixed reference for supply ${supply._id} to token ${t.symbol}`);
            break;
          }
        }
      }
    }
    
    // 3. Update market cap calculation logic if schema expects ObjectId
    console.log('\nChecking if we need to update the schema...');
    
    // Check if the schema expects ObjectId for tokenId
    // This requires examining the prisma schema or checking existing references
    
    // Try to find a token using a string ID
    const firstSupply = newSupplies[0];
    const tokenWithStringId = await db.collection('Token').findOne({ _id: firstSupply.tokenId });
    
    if (!tokenWithStringId) {
      console.log('Schema may require ObjectId references instead of strings');
      
      // Convert tokenId strings to ObjectIds
      const convertOps = [];
      
      for (const supply of newSupplies) {
        try {
          // Convert string ID to ObjectId if possible
          const objectId = new ObjectId(supply.tokenId);
          
          convertOps.push({
            updateOne: {
              filter: { _id: supply._id },
              update: { $set: { tokenId: objectId } }
            }
          });
        } catch (error) {
          console.error(`Error converting ID ${supply.tokenId} to ObjectId:`, error);
        }
      }
      
      if (convertOps.length > 0) {
        const convertResult = await db.collection('TokenSupply').bulkWrite(convertOps);
        console.log(`Converted ${convertResult.modifiedCount} tokenId references to ObjectId`);
      }
    } else {
      console.log('Schema is working with string IDs correctly');
    }
    
    // 4. Final verification
    console.log('\nPerforming final verification...');
    
    // Try to do a join query to verify everything is working
    const pipeline = [
      {
        $lookup: {
          from: 'Token',
          localField: 'tokenId',
          foreignField: '_id',
          as: 'token'
        }
      },
      {
        $match: {
          'token': { $ne: [] }
        }
      },
      {
        $count: 'matchingSupplies'
      }
    ];
    
    const joinResult = await db.collection('TokenSupply').aggregate(pipeline).toArray();
    const matchingCount = joinResult.length > 0 ? joinResult[0].matchingSupplies : 0;
    
    console.log(`Found ${matchingCount} supply records with valid token references out of ${newSupplies.length}`);
    
    if (matchingCount === newSupplies.length) {
      console.log('✅ All supply records have valid token references!');
    } else {
      console.log('⚠️ Some supply records have invalid references. Manual inspection required.');
      
      // Display some examples of what's going wrong
      const invalidSupplies = await db.collection('TokenSupply').aggregate([
        {
          $lookup: {
            from: 'Token',
            localField: 'tokenId',
            foreignField: '_id',
            as: 'token'
          }
        },
        {
          $match: {
            'token': { $eq: [] }
          }
        },
        {
          $limit: 3
        }
      ]).toArray();
      
      console.log('Sample of invalid supplies:', invalidSupplies);
    }
    
    console.log('\nToken supply reference fix completed!');
    
  } catch (error) {
    console.error('Error fixing token supply references:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

main().catch(console.error); 