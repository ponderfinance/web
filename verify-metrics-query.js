#!/usr/bin/env node

const { createClient } = require('redis');
const fetch = require('node-fetch');

async function verifyMetricsQuery() {
  console.log('Verifying protocol metrics query...');
  
  // First, check what's in Redis directly
  const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  await redis.connect();
  console.log('Connected to Redis');
  
  // Get Redis protocol metrics
  const volume24h = await redis.get('protocol:volume24h');
  const tvl = await redis.get('protocol:tvl');
  const volume24hChange = await redis.get('protocol:volume24hChange');
  
  console.log('\nRedis Protocol Metrics:');
  console.log(`- volume24h: ${volume24h}`);
  console.log(`- tvl: ${tvl}`);
  console.log(`- volume24hChange: ${volume24hChange}`);
  
  // Now query the GraphQL API
  const query = `
    query {
      protocolMetrics {
        id
        timestamp
        totalValueLockedUSD
        dailyVolumeUSD
        volume24hChange
      }
    }
  `;
  
  try {
    console.log('\nQuerying GraphQL API...');
    const response = await fetch('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    const result = await response.json();
    
    console.log('\nGraphQL Response:');
    console.log(JSON.stringify(result.data, null, 2));
    
    // Compare the results
    const graphqlMetrics = result.data?.protocolMetrics;
    if (graphqlMetrics) {
      console.log('\nComparing Results:');
      console.log(`- Redis volume24h: ${volume24h}`);
      console.log(`- GraphQL dailyVolumeUSD: ${graphqlMetrics.dailyVolumeUSD}`);
      console.log(`- Redis tvl: ${tvl}`);
      console.log(`- GraphQL totalValueLockedUSD: ${graphqlMetrics.totalValueLockedUSD}`);
      console.log(`- Redis volume24hChange: ${volume24hChange}`);
      console.log(`- GraphQL volume24hChange: ${graphqlMetrics.volume24hChange}`);
      
      if (volume24h !== graphqlMetrics.dailyVolumeUSD) {
        console.log('\n❌ WARNING: Mismatch in volume24h values!');
        console.log('The GraphQL API is not returning the latest values from Redis.');
      } else {
        console.log('\n✅ Success: GraphQL API is correctly returning Redis values.');
      }
    }
  } catch (error) {
    console.error('Error querying GraphQL API:', error);
  }
  
  await redis.quit();
  console.log('\nVerification complete');
}

verifyMetricsQuery().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 