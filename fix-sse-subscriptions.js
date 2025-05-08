/**
 * SSE Subscription Diagnostic and Fix Tool
 * This script diagnoses common issues with SSE subscriptions and applies fixes
 */
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function diagnoseSseSubscriptions() {
  console.log('\n===== SSE SUBSCRIPTION DIAGNOSTICS =====\n');
  
  // Step 1: Check Redis configuration
  console.log('1. Checking Redis configuration...');
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.error('❌ REDIS_URL environment variable is not set!');
    console.log('   This must be set for SSE subscriptions to work');
    console.log('   Fix: Add REDIS_URL to your environment or .env file');
    return;
  }
  
  console.log(`   Found Redis URL: ${redisUrl.includes('@') ? 
    redisUrl.split('@')[0] + '@********' : 'redis://********'}`);
  
  // Step 2: Check Redis connectivity
  console.log('\n2. Testing Redis connectivity...');
  const redis = new Redis(redisUrl);
  
  try {
    await redis.ping();
    console.log('✅ Redis connection successful');
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('   Fix: Verify Redis is running and the URL is correct');
    await redis.quit();
    return;
  }
  
  // Step 3: Check for Redis subscribers
  console.log('\n3. Checking for Redis subscribers...');
  
  try {
    // Publish a test message
    const message = JSON.stringify({
      entityType: 'protocol',
      entityId: 'protocol',
      metricType: 'diagnostic_test',
      timestamp: Date.now()
    });
    
    const numSubscribers = await redis.publish('metrics:updated', message);
    console.log(`   Found ${numSubscribers} subscribers to metrics:updated channel`);
    
    if (numSubscribers === 0) {
      console.log('❌ No subscribers detected on the metrics:updated channel');
      console.log('   This indicates that the SSE endpoint is not properly connected');
    } else {
      console.log('✅ SSE endpoint appears to be subscribed to Redis');
    }
  } catch (error) {
    console.error('   Error publishing test message:', error.message);
  }
  
  // Step 4: Check for SSE API route
  console.log('\n4. Checking for SSE API route implementation...');
  const sseRoutePath = path.join(process.cwd(), 'src/app/api/graphql-subscription/route.ts');
  
  try {
    await fs.access(sseRoutePath);
    console.log('✅ SSE API route exists at:', sseRoutePath);
  } catch (error) {
    console.log('❌ SSE API route file not found at:', sseRoutePath);
    console.log('   Fix: Create the SSE API route file');
  }
  
  // Step 5: Check GraphQL subscription schema
  console.log('\n5. Checking GraphQL subscription schema...');
  try {
    const schemaPath = path.join(process.cwd(), 'schema.graphql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    if (schema.includes('type Subscription {')) {
      console.log('✅ GraphQL schema includes Subscription type');
    } else {
      console.log('❌ GraphQL schema is missing Subscription type definition');
      console.log('   Fix: Add Subscription type to your schema.graphql file');
    }
  } catch (error) {
    console.error('   Error checking schema file:', error.message);
  }
  
  // Step 6: Check Relay subscription configuration
  console.log('\n6. Checking Relay subscription configuration...');
  const relayEnvPath = path.join(process.cwd(), 'src/relay/createRelayEnvironment.ts');
  
  try {
    const relayEnv = await fs.readFile(relayEnvPath, 'utf8');
    if (relayEnv.includes('createSubscription')) {
      console.log('✅ Relay environment includes subscription handler');
    } else {
      console.log('❌ Relay environment is missing subscription handler');
      console.log('   Fix: Add subscription handler to createRelayEnvironment.ts');
    }
  } catch (error) {
    console.log('   Could not read Relay environment file:', error.message);
  }
  
  // Step 7: Check for Redis subscriber initialization
  console.log('\n7. Checking Redis subscriber initialization...');
  try {
    // Look for subscriber initialization in common locations
    const locations = [
      'src/lib/redis/subscriber.ts',
      'src/lib/subscriptions/subscription-server.ts',
      'src/api/graphql/subscription-handler.ts'
    ];
    
    let subscriberFound = false;
    
    for (const loc of locations) {
      try {
        const filePath = path.join(process.cwd(), loc);
        const content = await fs.readFile(filePath, 'utf8');
        
        if (content.includes('subscribe(') && 
            (content.includes('metrics:updated') || content.includes('REDIS_CHANNELS'))) {
          console.log(`✅ Found Redis subscription code in ${loc}`);
          subscriberFound = true;
        }
      } catch (error) {
        // File not found, continue to next
      }
    }
    
    if (!subscriberFound) {
      console.log('❌ Could not find Redis subscription code in expected locations');
      console.log('   Fix: Implement Redis subscription handling');
    }
  } catch (error) {
    console.error('   Error checking for subscriber code:', error.message);
  }
  
  // Step 8: Test Redis metrics
  console.log('\n8. Testing Redis metrics values...');
  
  try {
    const volume = await redis.get('protocol:volume24h');
    const tvl = await redis.get('protocol:tvl');
    const change = await redis.get('protocol:volume24hChange');
    
    if (volume && tvl && change) {
      console.log('✅ Redis metrics values are present:');
      console.log(`   - volume24h: ${volume}`);
      console.log(`   - tvl: ${tvl}`);
      console.log(`   - volume24hChange: ${change}`);
    } else {
      console.log('❌ Redis metrics values are missing:');
      console.log(`   - volume24h: ${volume || 'missing'}`);
      console.log(`   - tvl: ${tvl || 'missing'}`);
      console.log(`   - volume24hChange: ${change || 'missing'}`);
      
      console.log('   Fix: Update Redis with metrics values');
      
      // Test with sample values
      console.log('   Setting sample metrics values for testing...');
      await redis.set('protocol:volume24h', '18.75');
      await redis.set('protocol:tvl', '3420.50');
      await redis.set('protocol:volume24hChange', '5.25');
      
      console.log('   Sample metrics set successfully');
    }
  } catch (error) {
    console.error('   Error testing Redis metrics:', error.message);
  }
  
  // Step 9: Attempt to fix common problems
  console.log('\n9. Attempting to fix common problems...');
  
  try {
    // Publish an update to trigger subscriptions
    console.log('   Publishing metrics update to trigger subscriptions...');
    const message = JSON.stringify({
      entityType: 'protocol',
      entityId: 'protocol',
      metricType: 'metrics_update',
      timestamp: Date.now()
    });
    
    const subscribers = await redis.publish('metrics:updated', message);
    console.log(`   Published update to ${subscribers} subscribers`);
    
    // Restart SSE if needed by touching the file to trigger a refresh
    console.log('   Touching the SSE route file to trigger a refresh...');
    try {
      if (await fs.access(sseRoutePath).then(() => true).catch(() => false)) {
        const content = await fs.readFile(sseRoutePath, 'utf8');
        await fs.writeFile(sseRoutePath, content);
        console.log('   SSE route file refreshed');
      }
    } catch (error) {
      console.log('   Could not refresh SSE route file');
    }
  } catch (error) {
    console.error('   Error during fix attempt:', error.message);
  }
  
  // Final recommendations
  console.log('\n===== DIAGNOSTICS SUMMARY =====');
  console.log('\nBased on the diagnostics, here are the potential issues and fixes:');
  console.log('\n1. Browser-side issues to check:');
  console.log('   - Open browser dev tools Network tab and look for an SSE connection to /api/graphql-subscription');
  console.log('   - Check the browser console for any errors related to EventSource or SSE');
  console.log('   - Try the browser-sse-test.js script to test SSE connectivity directly');
  
  console.log('\n2. Next steps:');
  console.log('   - Run "npm run dev" or "npm run build && npm start" to ensure all code is up to date');
  console.log('   - Visit your application and check browser Network tab for SSE connection');
  console.log('   - Run debug-subscription-flow.js to test the complete flow');
  console.log('   - Copy/paste browser-sse-test.js into browser console to check client-side');
  
  console.log('\n===== END OF DIAGNOSTICS =====\n');
  
  // Clean up
  await redis.quit();
}

// Run the diagnostic function
diagnoseSseSubscriptions(); 