const { createClient } = require('redis');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function forceRefreshMetrics() {
  try {
    console.log('Starting complete protocol metrics refresh...');
    
    // Step 1: Clear Redis cache
    console.log('1. Clearing Redis cache...');
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redis.connect();
    
    // Clear protocol metrics
    const protocolKeys = await redis.keys('protocol:*');
    if (protocolKeys.length > 0) {
      await redis.del(protocolKeys);
      console.log(`   ✅ Cleared ${protocolKeys.length} protocol metric keys`);
    } else {
      console.log('   ⚠️ No protocol metric keys found in Redis');
    }
    
    // Clear any environment caches
    const cacheKeys = await redis.keys('*cache*');
    if (cacheKeys.length > 0) {
      await redis.del(cacheKeys);
      console.log(`   ✅ Cleared ${cacheKeys.length} cache keys`);
    }
    
    await redis.disconnect();
    
    // Step 2: Force metrics recalculation in the indexer
    console.log('\n2. Running metrics recalculation in indexer...');
    try {
      await execAsync('cd ../ponder-indexer && node verify-volume-change.js');
      console.log('   ✅ Metrics recalculation completed');
    } catch (error) {
      console.error('   ❌ Error running metrics recalculation:', error.message);
    }
    
    // Step 3: Invalidate browser cache for the frontend
    console.log('\n3. Invalidating frontend cache...');
    console.log('   Please clear your browser cache or use an incognito window');
    console.log('   to see the latest metrics.');
    
    console.log('\n✅ Protocol metrics refresh completed!');
    console.log('\nYou should now see the correct volume change percentage on the frontend.');
    console.log('If you still see old values, please try:');
    console.log('  - Opening the app in an incognito/private window');
    console.log('  - Hard refreshing your browser (Ctrl+F5 or Cmd+Shift+R)');
    console.log('  - Temporarily disabling your browser cache in dev tools');
    
  } catch (error) {
    console.error('Error during metrics refresh:', error);
    process.exit(1);
  }
}

// Run the script
forceRefreshMetrics().catch(console.error); 