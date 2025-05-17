# Redis Migration Plan

## Current Issues Identified

1. **Multiple Redis Connection Implementations**: Several files are creating Redis connections independently, leading to connection storms.
2. **Duplicate Redis Channel Definitions**: Redis channels are defined in multiple places.
3. **Inconsistent Error Handling**: ECONNRESET errors are not handled consistently.
4. **No Connection Backoff**: Rapid reconnection attempts during failures.
5. **Multiple Singleton Patterns**: Several attempts at singleton patterns are conflicting.

## Migration Steps

### 1. Centralize Redis Configuration

✅ **Completed**: `/src/config/redis.ts` is now the single source of truth for all Redis connections.

### 2. Deprecated Files to Remove

The following files should be deprecated and not used directly:

- `src/lib/redis/client.js` ✓ Moved to old_files
- `src/lib/redis/client.ts` ✓ Moved to old_files
- `src/lib/redis/exports.ts` ✓ Moved to old_files
- `src/lib/redis/subscriber.ts` → Import from `index.ts` instead
- `src/lib/redis/subscriberClient.ts` → Import from `index.ts` instead

### 3. Files to Keep with Clean Abstraction

- `src/lib/redis/index.ts` ✅ Fixed - Central import point
- `src/lib/redis/eventService.ts` - Keep for SSE events
- `src/lib/redis/strictOperations.ts` - Keep for operation helpers
- `src/lib/redis/connectionManager.ts` - Keep for connection management
- `src/lib/redis/cache.ts` - Keep for caching logic
- `src/lib/redis/circuitBreaker.ts` - Keep for circuit breaker pattern

### 4. Redis Channel Standardization

✅ **Completed**: All Redis channel definitions now use `/src/constants/redis-channels.ts`

### 5. Usage Guidelines

1. **For direct Redis operations**:
   ```typescript
   import { getKey, setKey, getMultipleKeys } from '@/src/lib/redis';
   ```

2. **For real-time updates**:
   ```typescript
   import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
   ```

3. **For subscription functionality**:
   ```typescript
   import { buildRedisChannelName } from '@/src/lib/redis';
   ```

### 6. Connection Improvements

1. **True Singleton Enforcement**:
   - Global variables in `src/config/redis.ts` ensure true singleton behavior
   - All components use the same Redis connection

2. **Improved Error Handling**:
   - ECONNRESET errors now trigger controlled reconnection
   - Debouncing of reconnection attempts implemented
   - Exponential backoff for retry logic

3. **Heartbeat Detection**:
   - Periodic heartbeats to detect stale connections
   - Automatic reconnection when heartbeats fail

4. **Circuit Breaker Pattern**:
   - Automatic suspension after multiple failures
   - Fallback to polling when Redis is unavailable

## Next Steps

1. Update any remaining imports to use the centralized Redis modules
2. Monitor logs to ensure ECONNRESET errors are properly handled
3. Consider adding Redis connection metrics to track connection health
