/**
 * This script adds a middleware to the Next.js server to clear browser cache
 * for GraphQL requests. This ensures the frontend always gets the latest data.
 */
const fs = require('fs');
const path = require('path');

// Path to the Next.js middleware file
const middlewarePath = path.join(__dirname, 'src', 'middleware.ts');

// Create or update the middleware file with cache-busting headers
const middlewareContent = `
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only add headers for GraphQL API requests
  if (request.nextUrl.pathname.includes('/api/graphql')) {
    console.log('Adding cache-control headers to GraphQL request');
    
    // Create a new response with the cache-busting headers
    const response = NextResponse.next();
    
    // Set cache-busting headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  }
  
  return NextResponse.next();
}

// Configure which paths this middleware will run on
export const config = {
  matcher: ['/api/graphql'],
};
`;

// Write the middleware file
fs.writeFileSync(middlewarePath, middlewareContent);

console.log(`
✅ Created/updated middleware file at ${middlewarePath}

Cache-busting is now enabled for GraphQL requests.
This will ensure you always see the latest data from the server.

Next steps:
1. Restart your Next.js server
2. Clear your browser cache manually once
3. Reload the page to see the latest data
`);

// Now create a script to manually clear Redis cache for testing
const redisClearScript = `
/**
 * This script clears the Redis cache for metrics to force a refresh
 */
const Redis = require('ioredis');

async function clearCache() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  try {
    console.log('Connecting to Redis...');
    
    // Clear protocol metrics cache
    await redis.del('protocol:volume24h');
    await redis.del('protocol:volume7d');
    await redis.del('protocol:tvl');
    await redis.del('protocol:volume24hChange');
    await redis.del('protocol:volume1hChange');
    
    console.log('Cleared protocol metrics cache in Redis');
  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    redis.quit();
  }
}

clearCache();
`;

// Write the Redis clear script
fs.writeFileSync(path.join(__dirname, 'clear-redis-cache.js'), redisClearScript);

console.log(`
✅ Created Redis cache clear script at ${path.join(__dirname, 'clear-redis-cache.js')}

You can run it with:
  node clear-redis-cache.js
`); 