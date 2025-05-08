#!/usr/bin/env node

const { createClient } = require('redis');
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

// Create Redis client and Prisma instance
const prisma = new PrismaClient();

// CACHE_PREFIXES matching both frontend and indexer
const CACHE_PREFIXES = {
  PAIR: 'pair:',
  TOKEN: 'token:',
  PROTOCOL: 'protocol:'
};

async function fixMetricsDisplay() {
  console.log('===== Metrics Display Fix Tool =====');
  console.log('This script will diagnose and fix issues with metrics display');
  
  try {
    // Step 1: Connect to Redis
    console.log('\n📊 Step 1: Connecting to Redis...');
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    await redis.connect();
    console.log('✅ Connected to Redis successfully');
    
    // Step 2: Check current Redis values
    console.log('\n📊 Step 2: Checking current Redis values...');
    const [
      volume24h,
      tvl,
      volume24hChange,
      timestamp
    ] = await redis.mget([
      `${CACHE_PREFIXES.PROTOCOL}volume24h`,
      `${CACHE_PREFIXES.PROTOCOL}tvl`,
      `${CACHE_PREFIXES.PROTOCOL}volume24hChange`,
      `${CACHE_PREFIXES.PROTOCOL}timestamp`
    ]);
    
    console.log(`- Volume 24h: ${volume24h}`);
    console.log(`- TVL: ${tvl}`);
    console.log(`- Volume 24h Change: ${volume24hChange}`);
    console.log(`- Timestamp: ${timestamp ? new Date(timestamp * 1000).toISOString() : 'Not set'}`);
    
    // Step 3: Check database values
    console.log('\n📊 Step 3: Checking database values...');
    
    // Check EntityMetrics
    const entityMetrics = await prisma.entityMetrics.findFirst({
      where: {
        entity: 'protocol',
        entityId: 'protocol'
      }
    });
    
    if (entityMetrics) {
      console.log('EntityMetrics found:');
      console.log(`- Volume 24h: ${entityMetrics.volume24h}`);
      console.log(`- TVL: ${entityMetrics.tvl}`);
      console.log(`- Volume Change 24h: ${entityMetrics.volumeChange24h}`);
      console.log(`- Last updated: ${new Date(entityMetrics.lastUpdated * 1000).toISOString()}`);
    } else {
      console.log('No EntityMetrics record found for protocol');
    }
    
    // Check ProtocolMetric
    const protocolMetric = await prisma.protocolMetric.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    if (protocolMetric) {
      console.log('\nLatest ProtocolMetric:');
      console.log(`- Daily Volume USD: ${protocolMetric.dailyVolumeUSD}`);
      console.log(`- TVL: ${protocolMetric.totalValueLockedUSD}`);
      console.log(`- Volume 24h Change: ${protocolMetric.volume24hChange}`);
      console.log(`- Timestamp: ${new Date(Number(protocolMetric.timestamp) * 1000).toISOString()}`);
    } else {
      console.log('No ProtocolMetric record found');
    }
    
    // Step 4: Verify GraphQL results
    console.log('\n📊 Step 4: Checking GraphQL API results...');
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
      const response = await fetch('http://localhost:3000/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      const result = await response.json();
      
      if (result.data && result.data.protocolMetrics) {
        const graphqlMetrics = result.data.protocolMetrics;
        console.log('GraphQL API returned:');
        console.log(`- Source: ${graphqlMetrics.id}`);
        console.log(`- Daily Volume USD: ${graphqlMetrics.dailyVolumeUSD}`);
        console.log(`- TVL: ${graphqlMetrics.totalValueLockedUSD}`);
        console.log(`- Volume 24h Change: ${graphqlMetrics.volume24hChange}`);
        console.log(`- Timestamp: ${new Date(graphqlMetrics.timestamp * 1000).toISOString()}`);
      } else {
        console.log('Error or no data from GraphQL API:', result);
      }
    } catch (error) {
      console.log('Error querying GraphQL API:', error.message);
      console.log('(This is expected if the frontend server is not running)');
    }
    
    // Step 5: Update Redis with the most accurate data
    console.log('\n📊 Step 5: Synchronizing Redis with the most accurate data...');
    
    // Use the most reliable source (manual calculation from debug-volume-change.js)
    const fixedMetrics = {
      volume24h: protocolMetric?.dailyVolumeUSD || '0',
      tvl: protocolMetric?.totalValueLockedUSD || '0',
      volume24hChange: (protocolMetric?.volume24hChange || 0).toString(),
      timestamp: Math.floor(Date.now() / 1000).toString()
    };
    
    console.log('Updating Redis with the following values:');
    console.log(`- Volume 24h: ${fixedMetrics.volume24h}`);
    console.log(`- TVL: ${fixedMetrics.tvl}`);
    console.log(`- Volume 24h Change: ${fixedMetrics.volume24hChange}`);
    
    const pipeline = redis.pipeline();
    for (const [key, value] of Object.entries(fixedMetrics)) {
      pipeline.set(`${CACHE_PREFIXES.PROTOCOL}${key}`, value, 'EX', 300); // 5 minutes TTL
    }
    
    await pipeline.exec();
    console.log('✅ Redis updated successfully');
    
    // Step 6: Verify Redis update
    console.log('\n📊 Step 6: Verifying Redis update...');
    const updatedVolume24h = await redis.get(`${CACHE_PREFIXES.PROTOCOL}volume24h`);
    console.log(`Updated Redis volume24h: ${updatedVolume24h}`);
    
    // Cleanup
    await redis.quit();
    await prisma.$disconnect();
    
    console.log('\n✅ Fix process completed! Next steps:');
    console.log('1. Restart your frontend server if it\'s running');
    console.log('2. Clear your browser cache completely');
    console.log('3. Reload the frontend page to see the updated metrics');
    console.log('\nIf metrics are still not showing correctly:');
    console.log('- Check browser network requests for GraphQL errors');
    console.log('- Make sure the frontend server is accessing the correct Redis instance');
    console.log('- Verify the Redis cache prefixes match between frontend and indexer');
    
  } catch (error) {
    console.error('Error during fix process:', error);
  }
}

fixMetricsDisplay().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 