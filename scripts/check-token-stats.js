// Script to check token statistics in the database (price, market cap, FDV)
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

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
    
    // Check token supply data
    const totalSupplies = await db.collection('TokenSupply').countDocuments();
    console.log(`TokenSupply collection has ${totalSupplies} records`);
    
    if (totalSupplies === 0) {
      console.log('WARNING: No token supply records found. Market cap and FDV calculations will return $0');
    } else {
      // Display sample of token supply data
      const supplySample = await db.collection('TokenSupply').find().limit(3).toArray();
      console.log('\nSample TokenSupply records:');
      for (const supply of supplySample) {
        const token = await db.collection('Token').findOne({ _id: supply.tokenId });
        console.log(`- ${token?.symbol || 'Unknown'}: Total: ${supply.total}, Circulating: ${supply.circulating}`);
      }
    }
    
    // Get all tokens with their price data
    console.log('\nChecking token price data:');
    const tokens = await db.collection('Token').find({}, {
      projection: { symbol: 1, name: 1, priceUSD: 1, decimals: 1 }
    }).toArray();
    
    console.log(`Found ${tokens.length} tokens with the following price data:`);
    
    let hasZeroPrices = false;
    
    for (const token of tokens) {
      const priceUSD = token.priceUSD ? parseFloat(token.priceUSD) : 0;
      console.log(`- ${token.symbol}: $${priceUSD} (${formatPriceWithDecimals(priceUSD, 6)})`);
      
      if (priceUSD === 0) {
        hasZeroPrices = true;
      }
    }
    
    if (hasZeroPrices) {
      console.log('\nWARNING: Some tokens have $0 prices, which will affect market cap and FDV calculations');
    }
    
    // Simulate market cap and FDV calculations for each token
    console.log('\nSimulating market cap and FDV calculations:');
    
    for (const token of tokens) {
      // Get the supply data
      const supply = await db.collection('TokenSupply').findOne({ tokenId: token._id });
      
      if (!supply) {
        console.log(`- ${token.symbol}: No supply data found, market cap and FDV will be $0`);
        continue;
      }
      
      const priceUSD = token.priceUSD ? parseFloat(token.priceUSD) : 0;
      
      if (priceUSD === 0) {
        console.log(`- ${token.symbol}: Price is $0, market cap and FDV will be $0`);
        continue;
      }
      
      // Calculate market cap
      const circulatingSupply = parseFloat(supply.circulating);
      const marketCap = circulatingSupply * priceUSD;
      
      // Calculate FDV
      const totalSupply = parseFloat(supply.total);
      const fdv = totalSupply * priceUSD;
      
      console.log(`- ${token.symbol}:`);
      console.log(`  • Price: $${formatPriceWithDecimals(priceUSD, 8)}`);
      console.log(`  • Market Cap: $${formatLargeNumber(marketCap)}`);
      console.log(`  • FDV: $${formatLargeNumber(fdv)}`);
    }
    
    // Check pairs for TVL calculation
    console.log('\nChecking pairs for TVL calculation:');
    const pairs = await db.collection('Pair').countDocuments();
    console.log(`Found ${pairs} pairs in the database`);
    
    const pairsWithReserves = await db.collection('Pair').countDocuments({
      $and: [
        { reserve0: { $exists: true, $ne: '0' } },
        { reserve1: { $exists: true, $ne: '0' } }
      ]
    });
    
    console.log(`Pairs with non-zero reserves: ${pairsWithReserves}`);
    
    if (pairsWithReserves < pairs) {
      console.log('WARNING: Some pairs have zero reserves, which will affect TVL calculations');
    }
    
    // Check the price snapshots to ensure variation
    console.log('\nChecking price snapshots for variation:');
    
    const snapshots = await db.collection('PriceSnapshot').countDocuments();
    console.log(`Found ${snapshots} price snapshots in total`);
    
    // Get a sample of snapshots for the KOI token
    const koiToken = await db.collection('Token').findOne({ 
      symbol: { $regex: '^koi$', $options: 'i' }
    });
    
    if (koiToken) {
      console.log(`Found KOI token: ${koiToken.symbol} (${koiToken._id})`);
      
      // Find pairs with KOI
      const koiPairs = [
        ...await db.collection('Pair').find({ token0Id: koiToken._id.toString() }).toArray(),
        ...await db.collection('Pair').find({ token1Id: koiToken._id.toString() }).toArray()
      ];
      
      console.log(`Found ${koiPairs.length} pairs involving KOI token`);
      
      if (koiPairs.length > 0) {
        // Check snapshots for first KOI pair
        const pairId = koiPairs[0]._id.toString();
        const koiSnapshots = await db.collection('PriceSnapshot')
          .find({ pairId })
          .sort({ timestamp: 1 })
          .limit(10)
          .toArray();
        
        console.log(`\nSample of price snapshots for KOI pair ${pairId}:`);
        
        // Check for price variation
        const uniquePrice0 = new Set();
        const uniquePrice1 = new Set();
        
        for (const snapshot of koiSnapshots) {
          uniquePrice0.add(snapshot.price0);
          uniquePrice1.add(snapshot.price1);
          console.log(`- Timestamp: ${snapshot.timestamp}, Price0: ${snapshot.price0}, Price1: ${snapshot.price1}`);
        }
        
        console.log(`\nUnique price0 values: ${uniquePrice0.size}, Unique price1 values: ${uniquePrice1.size}`);
        
        if (uniquePrice0.size <= 1 || uniquePrice1.size <= 1) {
          console.log('WARNING: Price snapshots show no variation, charts will appear flat');
        } else {
          console.log('✅ Price snapshots show variation, charts should display properly');
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking token stats:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Helper function to format large numbers with appropriate suffixes
function formatLargeNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// Helper function to format price with appropriate decimals
function formatPriceWithDecimals(price, maxDecimals = 2) {
  if (price === 0) return '0.00';
  
  if (price < 0.0001) {
    return price.toExponential(4);
  } else if (price < 0.01) {
    return price.toFixed(6);
  } else if (price < 1) {
    return price.toFixed(4);
  } else {
    return price.toFixed(2);
  }
}

main().catch(console.error); 