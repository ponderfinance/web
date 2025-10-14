import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://default:IzxFyWdRWrdmsOLRftxJvBiEgrkcZxFV@maglev.proxy.rlwy.net:19583';

const client = createClient({ url: REDIS_URL });

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

// Flush all token caches
const keys = await client.keys('token:*');
console.log(`Found ${keys.length} token cache keys`);

if (keys.length > 0) {
  await client.del(keys);
  console.log(`✅ Deleted ${keys.length} token cache keys`);
}

await client.disconnect();
console.log('✅ Redis cache cleared!');
