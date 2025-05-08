const path = require('path');
require('dotenv').config();

// Use a dynamic import for ESM modules in a CommonJS script
async function main() {
  console.log('Checking Redis connection...');
  
  try {
    // Dynamic import the ESM module
    const { getRedisClient } = await import('./src/lib/redis/client.ts');
    const redis = getRedisClient();
    
    // Test basic connectivity
    const pingResult = await redis.ping();
    console.log(`Redis PING result: ${pingResult}`);
    
    // Check for protocol metrics
    console.log('\nChecking protocol metrics:');
    const protocolTVL = await redis.get('protocol:tvl');
    console.log(`Protocol TVL in Redis: ${protocolTVL}`);
    
    // Check for token prices
    console.log('\nChecking token prices:');
    const tokenPrices = await redis.hgetall('token:prices');
    console.log('Token prices in Redis:', tokenPrices);
    
    // Check for pair reserves
    console.log('\nChecking pair reserves:');
    const pairKeys = await redis.keys('pair:*:reserveUSD');
    console.log(`Found ${pairKeys.length} pair reserve keys`);
    
    if (pairKeys.length > 0) {
      // Get a sample pair
      const samplePairKey = pairKeys[0];
      const pairId = samplePairKey.split(':')[1];
      console.log(`Sample pair ID: ${pairId}`);
      
      const reserveUSD = await redis.get(samplePairKey);
      console.log(`Pair ${pairId} reserveUSD: ${reserveUSD}`);
    }
    
    // Close the connection
    redis.disconnect();
    console.log('Redis check completed.');
  } catch (error) {
    console.error('Error checking Redis:', error);
  }
}

// Run the check
main(); 