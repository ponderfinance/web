# Redis Usage Guidelines

## Overview

This application uses a singleton Redis connection pattern to ensure reliable connections and prevent connection storms. 
All Redis operations should go through our centralized Redis API to ensure proper connection management.

## Key Principles

1. **Never create direct Redis connections**:
   ```typescript
   // ❌ BAD: Creating direct connections
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   
   // ✅ GOOD: Using the shared singleton
   import { getKey, setKey } from '@/src/lib/redis';
   const value = await getKey('my-key');
   ```

2. **Use the Redis helper functions** for common operations:
   ```typescript
   import { getKey, setKey, getMultipleKeys, deleteKey } from '@/src/lib/redis';
   
   // Get a value
   const value = await getKey('user:123');
   
   // Set a value with optional TTL
   await setKey('user:123', JSON.stringify(userData), 3600); // 1 hour TTL
   
   // Get multiple values
   const values = await getMultipleKeys(['user:123', 'user:456']);
   
   // Delete a key
   await deleteKey('user:123');
   ```

3. **For real-time updates**, use the RedisSubscriberProvider:
   ```tsx
   import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
   
   function MyComponent() {
     const { tokenLastUpdated, connectionState } = useRedisSubscriber();
     
     // Check if token was updated
     useEffect(() => {
       if (tokenLastUpdated['token-id']) {
         // Refresh data
       }
     }, [tokenLastUpdated]);
     
     // Check connection state
     if (connectionState === 'suspended') {
       return <div>Connection temporarily unavailable</div>;
     }
     
     return <div>Your component</div>;
   }
   ```

## Connection Management

The Redis connection is managed by a singleton in `src/lib/redis/singleton.ts` which handles:

- Connection pooling and reuse
- Automatic reconnection with exponential backoff
- Connection state tracking (connected, connecting, disconnected, suspended)
- ECONNRESET error handling
- Connection storm prevention

## Troubleshooting

### Connection Issues

If you're experiencing connection issues:

1. **Check the connection state**:
   ```typescript
   import { ConnectionState } from '@/src/lib/redis';
   const { connectionState } = useRedisSubscriber();
   
   if (connectionState === ConnectionState.SUSPENDED) {
     // Connection is in a cooldown period after multiple failures
   }
   ```

2. **Ensure proper error handling**:
   ```typescript
   try {
     const value = await getKey('my-key');
     // Use value if available
     if (value) {
       // Do something
     } else {
       // Handle missing value
     }
   } catch (error) {
     // Handle unexpected errors
     console.error('Redis operation failed:', error);
   }
   ```

3. **Never implement custom reconnection logic**:
   The singleton handles reconnection automatically. Adding custom logic can create connection storms.

## Best Practices

1. **Cache sensibly**:
   - Use appropriate TTLs for different types of data
   - Consider using the predefined TTL constants:
     ```typescript
     import { CACHE_TTLS } from '@/src/lib/redis';
     
     // Short-lived cache (1 minute)
     await setKey('temp-data', data, CACHE_TTLS.SHORT);
     
     // Medium-lived cache (5 minutes)
     await setKey('user-preferences', prefs, CACHE_TTLS.MEDIUM);
     
     // Long-lived cache (30 minutes)
     await setKey('static-data', data, CACHE_TTLS.LONG);
     ```

2. **Use consistent key prefixes**:
   - Use the predefined prefixes for common entity types:
     ```typescript
     import { CACHE_PREFIXES } from '@/src/lib/redis';
     
     // Token data
     const tokenKey = `${CACHE_PREFIXES.TOKEN}${tokenId}`;
     
     // Pair data
     const pairKey = `${CACHE_PREFIXES.PAIR}${pairId}`;
     ```

3. **Handle missing data gracefully**:
   ```typescript
   const value = await getKey('my-key');
   if (!value) {
     // Fallback to database or API
     const freshData = await fetchFromDatabase();
     // Update cache for next time
     await setKey('my-key', JSON.stringify(freshData), CACHE_TTLS.MEDIUM);
     return freshData;
   }
   return JSON.parse(value);
   ```

## Architecture Overview

Our Redis implementation follows a layered approach:

1. **Singleton Layer** (`singleton.ts`): 
   - Core connection management
   - Handles reconnection, errors, and state tracking
   - Never import this directly unless needed for advanced use cases

2. **API Layer** (`index.ts`):
   - Public API with helper functions for common operations
   - Error handling and logging
   - This is the primary interface developers should use

3. **Provider Layer** (`RedisSubscriberProvider.tsx`):
   - Handles real-time updates through SSE
   - Manages subscription to Redis PubSub channels
   - Provides React context for connection state and update timestamps

By following these guidelines, we ensure reliable Redis connections and prevent the connection issues that previously affected the application. 