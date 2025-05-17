# Redis Architecture & Usage Guide

## Architecture Overview

This Redis implementation follows a strict singleton pattern to prevent connection storms and ensure reliable real-time updates.

### Core Components

1. **Connection Manager** (`/src/config/redis.ts`)
   - Single source of truth for Redis connections
   - Enforces true singleton pattern with global references
   - Handles connection lifecycle and error recovery

2. **High-Level API** (`/src/lib/redis/index.ts`)
   - Provides simplified Redis operations with error handling
   - Re-exports connection state and event types
   - Bridges multiple implementations for backward compatibility

3. **Event Service** (`/src/lib/redis/eventService.ts`)
   - SSE-based event delivery for browser clients
   - Connection state management
   - Heartbeat detection

4. **Operations Layer** (`/src/lib/redis/strictOperations.ts`)
   - Implements common Redis operations with error handling
   - Local caching for performance
   - Circuit breaker pattern for failure protection

5. **Constants** (`/src/constants/redis-channels.ts`)
   - Centralized definition of all Redis channels
   - Shared between server and client code

## Usage Guidelines

### Basic Redis Operations

```typescript
import { getKey, setKey, getMultipleKeys, deleteKey } from '@/src/lib/redis';

// Get a value
const value = await getKey('cache:key');

// Set a value with optional TTL
await setKey('cache:key', 'value', 3600); // 1 hour TTL

// Get multiple values
const values = await getMultipleKeys(['key1', 'key2']);

// Delete a key
await deleteKey('cache:key');
```

### Real-Time Updates

```typescript
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate';

// In a React component:
function MyComponent() {
  // For global refresh on updates
  const { connectionState } = useRedisSubscriber();
  
  // For entity-specific updates with refresh callback
  const { refresh, lastUpdated } = useRefreshOnUpdate({
    entityType: 'pair',
    entityId: '0x123...',
    onUpdate: () => {
      // Refresh data when entity is updated
      refetchData();
    }
  });
  
  // Connection state can be used for UI feedback
  if (connectionState === 'suspended') {
    return <div>Real-time updates unavailable</div>;
  }
  
  // ...
}
```

### Advanced: Direct Client Access

In rare cases where you need direct access to the Redis client:

```typescript
import { getRedisClient, getRedisSubscriber } from '@/src/lib/redis';

// Get the Redis client instance
const client = getRedisClient();

// Get the subscriber instance for PubSub
const subscriber = getRedisSubscriber();

// Register and unregister connections
import { registerRedisConnection, unregisterRedisConnection } from '@/src/lib/redis';

// In component mount
useEffect(() => {
  registerRedisConnection();
  
  return () => {
    unregisterRedisConnection();
  };
}, []);
```

## Error Handling & Connection States

The Redis implementation handles various error conditions:

1. **ECONNRESET Errors**: Controlled reconnection with exponential backoff
2. **Connection Storms**: Throttling and debouncing of reconnection attempts
3. **Circuit Breaker**: Automatic suspension after multiple failures
4. **Fallback Strategy**: Polling fallback when Redis is unavailable

Connection states are exposed for UI feedback:
- `CONNECTED`: Updates are flowing normally
- `CONNECTING`: Actively trying to establish a connection  
- `DISCONNECTED`: Temporarily disconnected, will auto-reconnect
- `SUSPENDED`: Multiple failures detected, updates paused

## Best Practices

1. **Always use the high-level API** instead of direct Redis access
2. **Never create new Redis connections** outside the connection manager
3. **Provide fallback mechanisms** for when Redis is unavailable
4. **Handle connection state changes** in UI components
5. **Use the caching layer** for performance-critical operations 