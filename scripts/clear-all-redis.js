const Redis = require('ioredis');
require('dotenv').config();

async function clearAllRedisCaches() {
  console.log('Starting to clear all Redis caches (local and remote)...');
  
  // Get Redis URLs from env or use defaults
  const remoteRedisUrl = process.env.REDIS_URL || '';
  const localRedisUrl = 'redis://localhost:6379';
  
  // Create Redis clients for both environments
  const clients = [];
  
  if (remoteRedisUrl) {
    console.log(`Connecting to remote Redis at ${remoteRedisUrl.split('@').pop()}`);
    clients.push({
      name: 'Remote Redis',
      client: new Redis(remoteRedisUrl)
    });
  }
  
  console.log('Connecting to local Redis at localhost:6379');
  clients.push({
    name: 'Local Redis',
    client: new Redis(localRedisUrl)
  });
  
  try {
    // Clear caches for each Redis instance
    for (const { name, client } of clients) {
      console.log(`\n=== Clearing ${name} cache ===`);
      
      // Clear token price keys
      const tokenPriceKeys = await client.keys('token:*:priceUSD');
      if (tokenPriceKeys.length > 0) {
        console.log(`Found ${tokenPriceKeys.length} token price keys`);
        // Show some sample keys
        tokenPriceKeys.slice(0, 5).forEach(key => console.log(`- ${key}`));
        if (tokenPriceKeys.length > 5) console.log(`- ... and ${tokenPriceKeys.length - 5} more`);
        
        const deleted = await client.del(...tokenPriceKeys);
        console.log(`Deleted ${deleted} token price keys`);
      } else {
        console.log('No token price keys found');
      }
      
      // Clear pair reserve USD keys
      const reserveKeys = await client.keys('pair:*:reserveUSD');
      if (reserveKeys.length > 0) {
        console.log(`Found ${reserveKeys.length} pair reserve USD keys`);
        // Show some sample keys
        reserveKeys.slice(0, 5).forEach(key => console.log(`- ${key}`));
        if (reserveKeys.length > 5) console.log(`- ... and ${reserveKeys.length - 5} more`);
        
        const deleted = await client.del(...reserveKeys);
        console.log(`Deleted ${deleted} pair reserve USD keys`);
      } else {
        console.log('No pair reserve USD keys found');
      }
      
      // Clear token list keys
      const tokenListKeys = await client.keys('tokens:*');
      if (tokenListKeys.length > 0) {
        console.log(`Found ${tokenListKeys.length} token list keys`);
        tokenListKeys.forEach(key => console.log(`- ${key}`));
        
        const deleted = await client.del(...tokenListKeys);
        console.log(`Deleted ${deleted} token list keys`);
      } else {
        console.log('No token list keys found');
      }
      
      // Check for any other potential cache keys
      const chartKeys = await client.keys('*chart*');
      if (chartKeys.length > 0) {
        console.log(`Found ${chartKeys.length} chart-related keys`);
        chartKeys.forEach(key => console.log(`- ${key}`));
        
        const deleted = await client.del(...chartKeys);
        console.log(`Deleted ${deleted} chart-related keys`);
      }
      
      // Check for price-related keys
      const priceKeys = await client.keys('*price*');
      if (priceKeys.length > 0) {
        console.log(`Found ${priceKeys.length} remaining price-related keys`);
        priceKeys.forEach(key => console.log(`- ${key}`));
        
        const deleted = await client.del(...priceKeys);
        console.log(`Deleted ${deleted} remaining price-related keys`);
      }
      
      console.log(`${name} cache clearing completed`);
    }
    
    console.log('\nAll Redis caches cleared successfully');
    
  } catch (error) {
    console.error('Error clearing Redis caches:', error);
  } finally {
    // Close all Redis connections
    for (const { client } of clients) {
      client.quit();
    }
  }
}

// Run the script
clearAllRedisCaches()
  .then(() => console.log('Cache clearing completed'))
  .catch(console.error); 