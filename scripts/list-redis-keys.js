const Redis = require('ioredis');
require('dotenv').config();

async function listRedisKeys() {
  console.log('Connecting to Redis and listing all keys...');
  
  // Connect to Redis using the URL from .env
  const redis = new Redis(process.env.REDIS_URL);
  
  try {
    // List all keys in Redis
    const allKeys = await redis.keys('*');
    
    if (allKeys.length > 0) {
      console.log(`Found ${allKeys.length} keys in Redis:`);
      
      for (const key of allKeys) {
        // Get the type of the key
        const type = await redis.type(key);
        let value;
        
        // Format output based on data type
        switch (type) {
          case 'string':
            value = await redis.get(key);
            console.log(`- ${key} (${type}): ${value.length > 100 ? value.substring(0, 100) + '...' : value}`);
            break;
          case 'list':
            const listLen = await redis.llen(key);
            console.log(`- ${key} (${type}): ${listLen} items`);
            break;
          case 'set':
            const setMembers = await redis.smembers(key);
            console.log(`- ${key} (${type}): ${setMembers.length} members`);
            break;
          case 'hash':
            const hashKeys = await redis.hkeys(key);
            console.log(`- ${key} (${type}): ${hashKeys.length} fields`);
            break;
          default:
            console.log(`- ${key} (${type})`);
        }
      }
    } else {
      console.log('No keys found in Redis.');
    }
    
    // Check specifically for token price related patterns
    console.log('\nChecking for specific token price patterns:');
    const patterns = [
      '*token*', '*price*', '*token*price*', 'token:*', 'price:*', 
      '*:price', '*cache*', '*USDT*', '*USDC*', '*KKUB*', '*kub*'
    ];
    
    for (const pattern of patterns) {
      const matchingKeys = await redis.keys(pattern);
      console.log(`Pattern "${pattern}": ${matchingKeys.length} keys`);
      if (matchingKeys.length > 0) {
        matchingKeys.forEach(key => console.log(`  - ${key}`));
      }
    }
    
  } catch (error) {
    console.error('Error listing Redis keys:', error);
  } finally {
    // Close the Redis connection
    redis.quit();
  }
}

// Run the script
listRedisKeys()
  .then(() => console.log('Redis key listing completed'))
  .catch(console.error); 