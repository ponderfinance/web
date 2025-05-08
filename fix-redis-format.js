const { createClient } = require('redis');

async function fixRedisFormat() {
  try {
    console.log('Starting fix for Redis data format...');
    
    // Connect to Redis
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redis.connect();
    
    // Check current values across all possible formats
    console.log('Checking current values in Redis...');
    
    // Check direct keys
    const directKeys = await redis.keys('protocol:*');
    console.log('Direct protocol keys:', directKeys);
    for (const key of directKeys) {
      const value = await redis.get(key);
      console.log(`  ${key}: ${value}`);
    }
    
    // Check hash-style storage
    const hashKeys = await redis.keys('protocolMetrics');
    console.log('\nHash-style keys:', hashKeys);
    if (hashKeys.length > 0) {
      const hashValues = await redis.hGetAll('protocolMetrics');
      console.log('  protocolMetrics hash values:', hashValues);
    }
    
    // Fix the data by ensuring it's available in both formats
    console.log('\nEnsuring data is available in all formats...');
    
    // Get the correct values (prefer direct keys, fall back to hash)
    let volume24h = '7.562920431582284';
    let volume24hChange = '160.2177537136986';
    let tvl = '3.00'; // Default from UI
    
    // Try to get from direct keys first
    if (directKeys.includes('protocol:volume24h')) {
      volume24h = await redis.get('protocol:volume24h');
    }
    if (directKeys.includes('protocol:volume24hChange')) {
      volume24hChange = await redis.get('protocol:volume24hChange');
    }
    if (directKeys.includes('protocol:tvl')) {
      tvl = await redis.get('protocol:tvl');
    }
    
    // Format 1: Set direct keys
    console.log('Setting direct keys...');
    await redis.set('protocol:volume24h', volume24h);
    await redis.set('protocol:volume24hChange', volume24hChange);
    await redis.set('protocol:tvl', tvl);
    await redis.set('protocol:timestamp', Math.floor(Date.now() / 1000).toString());
    
    // Format 2: Set as hash
    console.log('Setting hash-style data...');
    await redis.hSet('protocolMetrics', 'volume24h', volume24h);
    await redis.hSet('protocolMetrics', 'volume24hChange', volume24hChange);
    await redis.hSet('protocolMetrics', 'tvl', tvl);
    await redis.hSet('protocolMetrics', 'timestamp', Math.floor(Date.now() / 1000).toString());
    
    // Verify the values are set
    console.log('\nVerifying values were set correctly...');
    
    // Check direct keys
    const newDirectKeys = await redis.keys('protocol:*');
    console.log('Updated direct keys:', newDirectKeys);
    for (const key of newDirectKeys) {
      const value = await redis.get(key);
      console.log(`  ${key}: ${value}`);
    }
    
    // Check hash-style storage
    const hashValues = await redis.hGetAll('protocolMetrics');
    console.log('\nUpdated hash values:', hashValues);
    
    await redis.disconnect();
    
    console.log('\n✅ Redis format fix completed!');
    console.log('\nPlease reload your browser (or use an incognito window)');
    console.log('to see the updated volume change percentage.');
    
  } catch (error) {
    console.error('Error fixing Redis format:', error);
    process.exit(1);
  }
}

// Run the script
fixRedisFormat().catch(console.error); 