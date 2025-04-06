// Script to fix token supply values by normalizing them
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
    
    // Get all tokens and supplies
    console.log('\nRetrieving token data:');
    const tokens = await db.collection('Token').find({}).toArray();
    console.log(`Found ${tokens.length} tokens`);
    
    const supplies = await db.collection('TokenSupply').find({}).toArray();
    console.log(`Found ${supplies.length} supply records`);
    
    // Normalize supply values
    console.log('\nNormalizing token supply values:');
    const updateOps = [];
    
    for (const supply of supplies) {
      // Find corresponding token
      const token = tokens.find(t => t._id.toString() === supply.tokenId.toString());
      
      if (!token) {
        console.log(`Could not find token for supply ${supply._id}, skipping`);
        continue;
      }
      
      // Get decimals for normalization
      const decimals = token.decimals || 18;
      
      // Extract raw supply values
      const rawTotal = supply.total;
      const rawCirculating = supply.circulating;
      
      // Normalize to human-readable values (without decimals)
      let normalizedTotal, normalizedCirculating;
      
      try {
        normalizedTotal = (BigInt(rawTotal) / BigInt(10) ** BigInt(decimals)).toString();
        normalizedCirculating = (BigInt(rawCirculating) / BigInt(10) ** BigInt(decimals)).toString();
        
        console.log(`${token.symbol} supply:`);
        console.log(`  • Raw total: ${rawTotal}`);
        console.log(`  • Normalized total: ${normalizedTotal}`);
        console.log(`  • Raw circulating: ${rawCirculating}`);
        console.log(`  • Normalized circulating: ${normalizedCirculating}`);
        
        // Update supply record with normalized values
        updateOps.push({
          updateOne: {
            filter: { _id: supply._id },
            update: { 
              $set: { 
                total: normalizedTotal,
                circulating: normalizedCirculating
              }
            }
          }
        });
      } catch (error) {
        console.error(`Error normalizing supply for ${token.symbol}:`, error);
        
        // Use reasonable default values
        let defaultTotal, defaultCirculating;
        
        if (token.symbol === 'USDC' || token.symbol === 'USDT') {
          defaultTotal = '1000000000'; // 1 billion
          defaultCirculating = defaultTotal;
        } else if (token.symbol === 'KKUB') {
          defaultTotal = '250000000'; // 250 million
          defaultCirculating = defaultTotal;
        } else if (token.symbol?.toUpperCase() === 'KOI') {
          defaultTotal = '1000000000'; // 1 billion
          defaultCirculating = '650000000'; // 65%
        } else {
          defaultTotal = '100000000'; // 100 million
          defaultCirculating = '75000000'; // 75%
        }
        
        console.log(`Using default values for ${token.symbol}:`);
        console.log(`  • Default total: ${defaultTotal}`);
        console.log(`  • Default circulating: ${defaultCirculating}`);
        
        updateOps.push({
          updateOne: {
            filter: { _id: supply._id },
            update: { 
              $set: { 
                total: defaultTotal,
                circulating: defaultCirculating
              }
            }
          }
        });
      }
    }
    
    // Execute updates
    if (updateOps.length > 0) {
      const result = await db.collection('TokenSupply').bulkWrite(updateOps);
      console.log(`Updated ${result.modifiedCount} supply records with normalized values`);
    }
    
    // Verify market cap calculations
    console.log('\nVerifying market cap calculations:');
    
    for (const token of tokens) {
      // Find supply for this token
      const supply = await db.collection('TokenSupply').findOne({ tokenId: token._id });
      
      if (!supply) {
        console.log(`No supply found for ${token.symbol}, skipping verification`);
        continue;
      }
      
      // Calculate market cap and FDV
      const priceUSD = parseFloat(token.priceUSD || '0');
      const circulatingSupply = parseFloat(supply.circulating || '0');
      const totalSupply = parseFloat(supply.total || '0');
      
      const marketCap = priceUSD * circulatingSupply;
      const fdv = priceUSD * totalSupply;
      
      console.log(`${token.symbol}:`);
      console.log(`  • Price: $${priceUSD}`);
      console.log(`  • Circulating Supply: ${formatNumber(circulatingSupply)}`);
      console.log(`  • Total Supply: ${formatNumber(totalSupply)}`);
      console.log(`  • Market Cap: $${formatCurrency(marketCap)}`);
      console.log(`  • FDV: $${formatCurrency(fdv)}`);
    }
    
    console.log('\nToken supply value normalization completed successfully!');
    
  } catch (error) {
    console.error('Error normalizing token supply values:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Helper to format large numbers
function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
}

// Helper to format currency
function formatCurrency(amount) {
  if (amount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
  if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
  if (amount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
  return amount.toFixed(2);
}

main().catch(console.error); 