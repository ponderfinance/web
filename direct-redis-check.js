const Redis = require('ioredis');

async function checkRedisDirectly() {
  console.log('Checking Redis connection directly...');
  
  let redis = null;
  
  try {
    // Connect directly to Redis
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`Connecting to Redis at ${redisUrl.split('@').pop()}`);
    
    redis = new Redis(redisUrl);
    
    // Test basic connectivity
    const pingResult = await redis.ping();
    console.log(`Redis PING result: ${pingResult}`);
    
    // Check for all protocol-related keys
    console.log('\nAll protocol metrics keys:');
    const protocolKeys = await redis.keys('protocol:*');
    console.log('Protocol keys:', protocolKeys);
    
    if (protocolKeys.length > 0) {
      console.log('\nProtocol metrics values:');
      for (const key of protocolKeys) {
        const value = await redis.get(key);
        console.log(`${key}: ${value}`);
      }
    }
    
    // Check for volume metrics specifically
    console.log('\nChecking volume metrics:');
    const volumeKeys = protocolKeys.filter(key => key.includes('volume'));
    console.log('Volume-related keys:', volumeKeys);
    
    if (volumeKeys.length > 0) {
      console.log('\nVolume metrics values:');
      for (const key of volumeKeys) {
        const value = await redis.get(key);
        console.log(`${key}: ${value}`);
      }
    }
    
    // Check for entity metrics
    console.log('\nChecking entity metrics:');
    const entityKeys = await redis.keys('entity:*');
    console.log('Entity metrics keys:', entityKeys);
    
    // Check for token prices
    console.log('\nChecking token prices:');
    const tokenPriceKeys = await redis.keys('token:*:priceUSD');
    console.log(`Found ${tokenPriceKeys.length} token price keys`);
    
    if (tokenPriceKeys.length > 0) {
      console.log('\nSample token prices:');
      // Show up to 5 token prices
      for (const key of tokenPriceKeys.slice(0, 5)) {
        const value = await redis.get(key);
        const tokenId = key.split(':')[1];
        console.log(`Token ${tokenId} price: ${value}`);
      }
    }
    
    // Check token prices hash if it exists
    const tokenPricesHash = await redis.hgetall('token:prices');
    if (Object.keys(tokenPricesHash).length > 0) {
      console.log('\nToken prices from hash:');
      console.log(tokenPricesHash);
    } else {
      console.log('\nNo token prices hash found');
    }
    
    // Check for pair reserves
    console.log('\nChecking pair reserves:');
    const pairReserveKeys = await redis.keys('pair:*:reserveUSD');
    console.log(`Found ${pairReserveKeys.length} pair reserve keys`);
    
    if (pairReserveKeys.length > 0) {
      // Show a sample pair reserve
      const sampleKey = pairReserveKeys[0];
      const pairId = sampleKey.split(':')[1];
      console.log(`Sample pair ID: ${pairId}`);
      const reserveUSD = await redis.get(sampleKey);
      console.log(`Pair ${pairId} reserveUSD: ${reserveUSD}`);
    }
    
    console.log('Redis check completed.');
  } catch (error) {
    console.error('Error connecting to Redis:', error);
  } finally {
    if (redis) {
      redis.quit();
    }
  }
}

checkRedisDirectly(); 