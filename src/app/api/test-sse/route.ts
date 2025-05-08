import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

// Handler for triggering test SSE events
export async function GET(req: NextRequest) {
  try {
    // Get Redis URL from environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Create Redis client
    const redis = new Redis(redisUrl);
    
    // Generate random metrics values
    const randomVolume = (Math.random() * 20 + 10).toFixed(2);
    const randomTVL = (Math.random() * 5000 + 2000).toFixed(2);
    const randomChange = (Math.random() * 20 - 10).toFixed(2);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Set test values in Redis
    await redis.set('protocol:volume24h', randomVolume);
    await redis.set('protocol:tvl', randomTVL);
    await redis.set('protocol:volume24hChange', randomChange);
    await redis.set('protocol:timestamp', timestamp.toString());
    
    // Publish update event
    const message = JSON.stringify({
      entityType: 'protocol',
      entityId: 'protocol',
      metricType: 'metrics_update',
      timestamp: Date.now(),
      // Add test flag for tracing in logs
      isTest: true
    });
    
    const subscribers = await redis.publish('metrics:updated', message);
    
    // Clean up Redis connection
    await redis.quit();
    
    // Return success response
    return NextResponse.json({
      success: true,
      sentTo: subscribers,
      testValues: {
        volume24h: randomVolume,
        tvl: randomTVL,
        volume24hChange: randomChange,
        timestamp
      },
      message
    });
  } catch (error) {
    console.error('Error in test-sse endpoint:', error);
    
    // Return error response
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 