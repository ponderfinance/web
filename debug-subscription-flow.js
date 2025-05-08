/**
 * Comprehensive Diagnostic Tool for SSE/Subscription Flow
 * This script tests the complete flow from Redis to frontend SSE events
 */
const Redis = require('ioredis');

async function testSubscriptionFlow() {
  console.log('\n=== SUBSCRIPTION FLOW DIAGNOSTIC TOOL ===\n');
  
  // Setup Redis clients
  console.log('1. Setting up Redis clients...');
  const publisher = new Redis(process.env.REDIS_URL);
  const subscriber = new Redis(process.env.REDIS_URL);
  
  try {
    // Test basic Redis connectivity
    console.log('\n2. Testing Redis connectivity...');
    const pingReply = await publisher.ping();
    console.log(`   Redis ping reply: ${pingReply}`);
    
    // Subscribe to the metrics channel
    console.log('\n3. Subscribing to metrics:updated channel...');
    await subscriber.subscribe('metrics:updated');
    console.log('   Subscribed successfully');
    
    // Set up subscriber message listener
    subscriber.on('message', (channel, message) => {
      console.log(`\n✅ RECEIVED on channel ${channel}:`);
      try {
        const data = JSON.parse(message);
        console.log('   Message data:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('   Raw message:', message);
      }
    });
    
    // Update Redis values
    console.log('\n4. Setting test metrics values in Redis...');
    const timestamp = Math.floor(Date.now() / 1000);
    const randomVolume = (Math.random() * 20 + 10).toFixed(2);
    const randomTVL = (Math.random() * 5000 + 2000).toFixed(2);
    const randomChange = (Math.random() * 20 - 10).toFixed(2);
    
    await publisher.set('protocol:volume24h', randomVolume);
    await publisher.set('protocol:tvl', randomTVL);
    await publisher.set('protocol:volume24hChange', randomChange);
    await publisher.set('protocol:timestamp', timestamp);
    
    console.log('   Set values:');
    console.log(`   - volume24h: ${randomVolume}`);
    console.log(`   - tvl: ${randomTVL}`);
    console.log(`   - volume24hChange: ${randomChange}`);
    console.log(`   - timestamp: ${timestamp}`);
    
    // Verify values
    console.log('\n5. Verifying values were set correctly...');
    const storedVolume = await publisher.get('protocol:volume24h');
    const storedTVL = await publisher.get('protocol:tvl');
    const storedChange = await publisher.get('protocol:volume24hChange');
    
    console.log('   Retrieved values:');
    console.log(`   - volume24h: ${storedVolume}`);
    console.log(`   - tvl: ${storedTVL}`);
    console.log(`   - volume24hChange: ${storedChange}`);
    
    // Publish update notification
    console.log('\n6. Publishing update notification...');
    const message = JSON.stringify({
      entityType: 'protocol',
      entityId: 'protocol',
      metricType: 'metrics_update',
      timestamp: Date.now()
    });
    
    const result = await publisher.publish('metrics:updated', message);
    console.log(`   Published to ${result} subscribers`);
    
    if (result === 0) {
      console.error('   ❌ WARNING: No subscribers detected! This indicates a problem with the subscription system.');
      console.log('   Possible issues:');
      console.log('   - The SSE endpoint is not connected to Redis');
      console.log('   - The frontend is not establishing SSE connections');
      console.log('   - There are configuration issues with Redis URL');
    } else {
      console.log(`   ✅ ${result} subscribers received the message`);
    }
    
    // Wait a bit to see if messages are delivered
    console.log('\n7. Waiting for message delivery confirmation...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Testing SSE endpoint directly (this part is informational only)
    console.log('\n8. Instructions for testing SSE endpoint in browser:');
    console.log('   Open your browser console and run:');
    console.log('\n   const es = new EventSource("/api/graphql-subscription")');
    console.log('   es.onopen = () => console.log("SSE connected!")');
    console.log('   es.onmessage = (e) => console.log("Message:", e.data)');
    console.log('   es.onerror = (e) => console.error("Error:", e)');
    
    // Clean up
    console.log('\n9. Cleaning up...');
    await subscriber.unsubscribe('metrics:updated');
    await subscriber.quit();
    await publisher.quit();
    
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    console.log('\nIf you received the "No subscribers detected" warning, your SSE connection');
    console.log('is not properly subscribing to Redis. Check the following:');
    console.log('1. Verify the SSE endpoint (/api/graphql-subscription) is running');
    console.log('2. Check browser network tab for SSE connection');
    console.log('3. Verify Redis URL is the same between this script and the SSE endpoint');
    console.log('4. Check server logs for any connection errors');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    // Ensure connections are closed
    try {
      await subscriber.quit();
      await publisher.quit();
    } catch (e) {
      // Ignore errors during cleanup
    }
  }
}

// Run the diagnostic
testSubscriptionFlow(); 