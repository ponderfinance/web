// Script to check KOI token prices after the fix
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { formatUnits } = require('viem');

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

    // 1. Find KOI token with case-insensitive search
    console.log('\nLooking for KOI token (case-insensitive)...');
    const koiToken = await db.collection('Token').findOne({ 
      symbol: { $regex: '^koi$', $options: 'i' }
    });
    
    if (!koiToken) {
      console.log('KOI token not found with exact match, searching for similar tokens...');
      
      // Try partial match
      const similarTokens = await db.collection('Token').find({
        symbol: { $regex: 'koi', $options: 'i' }
      }).toArray();
      
      if (similarTokens.length > 0) {
        console.log(`Found ${similarTokens.length} tokens with 'koi' in the symbol:`);
        for (const token of similarTokens) {
          console.log(`- ID: ${token._id}, Symbol: ${token.symbol}, Address: ${token.address}`);
        }
        
        // Use the first one that matches
        const useToken = similarTokens[0];
        console.log(`\nUsing token with symbol ${useToken.symbol} for analysis`);
        await analyzeToken(db, useToken);
      } else {
        console.log('No tokens found with "koi" in the symbol.');
        console.log('\nListing all available tokens in the database:');
        
        const allTokens = await db.collection('Token').find({}, { 
          projection: { _id: 1, symbol: 1, address: 1 } 
        }).limit(20).toArray();
        
        console.log(`Found ${allTokens.length} tokens (showing first 20):`);
        for (const token of allTokens) {
          console.log(`- ID: ${token._id}, Symbol: ${token.symbol || 'NULL'}, Address: ${token.address}`);
        }
      }
    } else {
      console.log('Found KOI token:');
      console.log(`- ID: ${koiToken._id}`);
      console.log(`- Address: ${koiToken.address}`);
      console.log(`- Decimals: ${koiToken.decimals}`);
      
      await analyzeToken(db, koiToken);
    }
    
    console.log('\nPrice check completed.');
    
  } catch (error) {
    console.error('Error during price check:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

async function analyzeToken(db, token) {
  // 2. Find pairs with token
  console.log(`\nFinding pairs with ${token.symbol} token...`);
  const pairs = await db.collection('Pair').find({
    $or: [
      { token0Id: token._id.toString() },
      { token1Id: token._id.toString() }
    ]
  }).toArray();
  
  console.log(`Found ${pairs.length} pairs with ${token.symbol} token`);
  
  if (pairs.length === 0) {
    // Check for any pairs mentioning this token's address
    console.log('\nChecking Pair collection for token address mentions...');
    
    // Convert address to lowercase for case-insensitive matching
    const tokenAddress = token.address.toLowerCase();
    
    // Search in various fields that might contain the address
    const mentioningPairs = await db.collection('Pair').find({
      $or: [
        { token0Address: tokenAddress },
        { token1Address: tokenAddress }
      ]
    }).toArray();
    
    if (mentioningPairs.length > 0) {
      console.log(`Found ${mentioningPairs.length} pairs mentioning this token's address:`);
      for (const pair of mentioningPairs) {
        console.log(`- ID: ${pair._id}, Address: ${pair.address}`);
        console.log(`  Token0: ${pair.token0Address}, Token1: ${pair.token1Address}`);
      }
    } else {
      console.log('No pairs found mentioning this token address.');
      
      // List all price snapshots to see what's available
      console.log('\nSampling PriceSnapshot collection...');
      const sampleSnapshots = await db.collection('PriceSnapshot')
        .aggregate([{ $sample: { size: 5 } }])
        .toArray();
      
      if (sampleSnapshots.length > 0) {
        console.log(`Found ${sampleSnapshots.length} sample snapshots:`);
        for (const snapshot of sampleSnapshots) {
          console.log(`- ID: ${snapshot._id}, PairId: ${snapshot.pairId}`);
          console.log(`  Price0: ${snapshot.price0}, Price1: ${snapshot.price1}`);
          
          // Try to find the corresponding pair
          const pair = await db.collection('Pair').findOne({ _id: snapshot.pairId });
          if (pair) {
            console.log(`  Pair address: ${pair.address}`);
            console.log(`  Token0ID: ${pair.token0Id}, Token1ID: ${pair.token1Id}`);
          }
        }
      }
    }
    
    return;
  }
  
  // 3. Analyze each pair
  for (const pair of pairs) {
    const isToken0 = pair.token0Id === token._id.toString();
    const counterpartTokenId = isToken0 ? pair.token1Id : pair.token0Id;
    
    console.log(`\nPair: ${pair.address}`);
    console.log(`- ${token.symbol} is token${isToken0 ? '0' : '1'}`);
    
    // Get counterpart token
    const counterpartToken = await db.collection('Token').findOne({ _id: counterpartTokenId });
    console.log(`- Counterpart: ${counterpartToken?.symbol || 'Unknown'}, decimals: ${counterpartToken?.decimals || 'Unknown'}`);
    
    // Check if counterpart is a stablecoin
    const isStablecoin = counterpartToken?.symbol && 
                         ['USDT', 'USDC', 'DAI', 'BUSD'].includes(counterpartToken.symbol);
    console.log(`- Paired with stablecoin: ${isStablecoin || false}`);
    
    // Get reserves and prices
    console.log(`- Reserve0: ${pair.reserve0}`);
    console.log(`- Reserve1: ${pair.reserve1}`);
    
    // Get snapshots for this pair
    const snapshots = await db.collection('PriceSnapshot')
      .find({ pairId: pair._id.toString() })
      .sort({ timestamp: 1 })
      .toArray();
      
    console.log(`- Found ${snapshots.length} price snapshots`);
    
    if (snapshots.length > 0) {
      // Check for price diversity
      const uniquePrices = new Set();
      snapshots.forEach(snapshot => {
        uniquePrices.add(isToken0 ? snapshot.price0 : snapshot.price1);
      });
      
      console.log(`- Unique prices: ${uniquePrices.size} (out of ${snapshots.length} snapshots)`);
      
      // Sample some snapshots
      console.log('\nSample snapshots:');
      
      const sampleCount = Math.min(5, snapshots.length);
      const step = Math.floor(snapshots.length / sampleCount) || 1;
      
      for (let i = 0; i < snapshots.length; i += step) {
        if (i >= snapshots.length) break;
        
        const snapshot = snapshots[i];
        const rawPrice = isToken0 ? snapshot.price0 : snapshot.price1;
        
        console.log(`\nSnapshot at timestamp ${new Date(snapshot.timestamp * 1000).toISOString()}:`);
        console.log(`- Raw price: ${rawPrice}`);
        
        // Calculate display price based on resolver logic
        try {
          let displayPrice;
          
          if (isStablecoin) {
            const tokenDecimals = token.decimals || 18;
            const counterpartDecimals = counterpartToken.decimals || 18;
            
            if (isToken0) {
              // Token is token0, counterpart is stablecoin (token1)
              const decimalAdjustment = Math.pow(10, counterpartDecimals - tokenDecimals);
              displayPrice = parseFloat(rawPrice) * decimalAdjustment;
            } else {
              // Token is token1, counterpart is stablecoin (token0)
              const decimalAdjustment = Math.pow(10, tokenDecimals - counterpartDecimals);
              displayPrice = parseFloat(rawPrice) * decimalAdjustment;
            }
            
            console.log(`- Display price (USD): $${displayPrice}`);
          } else {
            console.log('- Not paired with stablecoin, would need additional price info for USD value');
          }
        } catch (error) {
          console.log(`- Error calculating display price: ${error.message}`);
        }
      }
      
      // Simulate chart data for this pair
      if (isStablecoin) {
        console.log('\nSimulating chart data points:');
        
        const chartData = snapshots.map(snapshot => {
          const rawPrice = isToken0 ? snapshot.price0 : snapshot.price1;
          const tokenDecimals = token.decimals || 18;
          const counterpartDecimals = counterpartToken.decimals || 18;
          
          let price;
          if (isToken0) {
            // Token is token0, counterpart is stablecoin (token1)
            const decimalAdjustment = Math.pow(10, counterpartDecimals - tokenDecimals);
            price = parseFloat(rawPrice) * decimalAdjustment;
          } else {
            // Token is token1, counterpart is stablecoin (token0)
            const decimalAdjustment = Math.pow(10, tokenDecimals - counterpartDecimals);
            price = parseFloat(rawPrice) * decimalAdjustment;
          }
          
          return {
            time: snapshot.timestamp,
            value: price
          };
        });
        
        // Check price variation
        if (chartData.length > 0) {
          const values = chartData.map(point => point.value);
          const minPrice = Math.min(...values);
          const maxPrice = Math.max(...values);
          const avgPrice = values.reduce((sum, val) => sum + val, 0) / values.length;
          
          console.log(`- Min price: $${minPrice}`);
          console.log(`- Max price: $${maxPrice}`);
          console.log(`- Avg price: $${avgPrice}`);
          console.log(`- Price range: ${((maxPrice - minPrice) / avgPrice * 100).toFixed(2)}% of average`);
          
          if (minPrice === maxPrice) {
            console.log('WARNING: All prices are identical! Chart will be flat.');
          } else {
            console.log(`Chart will show price variations from $${minPrice} to $${maxPrice}`);
          }
        }
      }
    }
  }
}

main().catch(console.error); 