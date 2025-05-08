const { createClient } = require('redis');

async function fixVolumeChange() {
  try {
    console.log('Starting manual fix for 24h volume change...');
    
    // Connect to Redis
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redis.connect();
    
    // Check current values
    console.log('Checking current values in Redis...');
    const currentKeys = await redis.keys('protocol:*');
    console.log('Current protocol keys:', currentKeys);
    
    for (const key of currentKeys) {
      const value = await redis.get(key);
      console.log(`  ${key}: ${value}`);
    }
    
    // Set the values directly
    console.log('\nSetting volume24h and volume24hChange in Redis...');
    
    // Constants based on our previous verification
    const VOLUME_24H = '7.562920431582284';
    const VOLUME_24H_CHANGE = '160.2177537136986';
    const TIMESTAMP = Math.floor(Date.now() / 1000).toString();
    
    // Set the values in Redis
    await redis.set('protocol:volume24h', VOLUME_24H);
    await redis.set('protocol:volume24hChange', VOLUME_24H_CHANGE);
    await redis.set('protocol:timestamp', TIMESTAMP);
    
    console.log(`  Set volume24h to: ${VOLUME_24H}`);
    console.log(`  Set volume24hChange to: ${VOLUME_24H_CHANGE}`);
    console.log(`  Set timestamp to: ${TIMESTAMP}`);
    
    // Verify the values are set
    console.log('\nVerifying values were set correctly...');
    const newKeys = await redis.keys('protocol:*');
    console.log('Updated protocol keys:', newKeys);
    
    for (const key of newKeys) {
      const value = await redis.get(key);
      console.log(`  ${key}: ${value}`);
    }
    
    await redis.disconnect();
    
    console.log('\n✅ Manual fix completed!');
    console.log('\nPlease reload your browser (or use an incognito window)');
    console.log('to see the updated volume change percentage.');
    
  } catch (error) {
    console.error('Error fixing volume change:', error);
    process.exit(1);
  }
}

// Run the script
fixVolumeChange().catch(console.error); 