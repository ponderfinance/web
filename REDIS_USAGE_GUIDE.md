# Redis Usage Guide for Ponder DEX

This guide explains how to use Redis for real-time updates in the Ponder DEX application.

## Overview

Ponder DEX uses Redis for real-time updates to provide a responsive user experience. The implementation:

1. Uses a singleton pattern for reliable connection management
2. Provides graceful fallback to GraphQL polling when Redis is unavailable
3. Handles connection errors with automatic recovery
4. Uses Server-Sent Events (SSE) for client-side real-time updates

## Architecture

The Redis implementation follows a robust design:

- **Server-side**: Direct Redis connection with pub/sub for updates
- **Client-side**: Server-Sent Events (SSE) for real-time updates
- **Relay Integration**: Updates are applied directly to the Relay store when possible

## Key Components

### Redis Channels

Redis channels are defined in a central location:

```typescript
// src/constants/redis-channels.ts
export const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated',
  TRANSACTION_UPDATED: 'transaction:updated'
};
```

### EventService

The `eventService.ts` module provides a singleton for managing Redis connections:

```typescript
// src/lib/redis/eventService.ts
import { REDIS_CHANNELS } from '@/src/constants/redis-channels';

// Get the singleton event service
const eventService = getSubscriberClient();

// Register a component that uses real-time updates
registerSubscriber();

// Listen for updates
eventService.on(REDIS_CHANNELS.TOKEN_UPDATED, handleTokenUpdate);

// Unregister when component unmounts
unregisterSubscriber();
```

### RedisSubscriberProvider

The `RedisSubscriberProvider` component manages real-time updates for the entire application:

```jsx
// In _app.tsx or layout.tsx
import { RedisSubscriberProvider } from '@/src/providers/RedisSubscriberProvider';

function App({ Component, pageProps }) {
  return (
    <RedisSubscriberProvider>
      <Component {...pageProps} />
    </RedisSubscriberProvider>
  );
}
```

### useRefreshOnUpdate Hook

Use this hook in components that need real-time updates:

```jsx
function TokenDetail({ tokenId }) {
  const { refresh, connectionState } = useRefreshOnUpdate({
    entityType: 'token',
    entityId: tokenId,
    onUpdate: () => loadQuery({ tokenId })
  });
  
  // Show a message if connection is suspended
  if (connectionState === ConnectionState.SUSPENDED) {
    return <div>Using cached data - real-time updates unavailable</div>;
  }
  
  // Rest of component...
}
```

## Error Handling & Recovery

The Redis implementation includes robust error handling:

### Connection Error Recovery

- **Exponential Backoff**: Retry intervals increase with each failed attempt
- **Connection Storm Prevention**: Debouncing of connection attempts
- **Circuit Breaking**: After multiple failures, suspends reconnection attempts
- **Heartbeat Detection**: Identifies stale connections and reconnects

### Fallback Mechanism

When Redis is unavailable:

1. Components automatically fall back to GraphQL polling
2. UI provides feedback about the connection state
3. When connection is restored, real-time updates resume

## Testing Redis Locally

To test Redis locally:

1. Install Redis: `brew install redis` (macOS) or use Docker
2. Start Redis: `redis-server` or `docker run -p 6379:6379 redis`
3. Set the `REDIS_URL` environment variable in `.env.local`:
   ```
   REDIS_URL=redis://localhost:6379
   ```

## Troubleshooting

### ECONNRESET Errors

ECONNRESET errors are handled with a controlled reconnection strategy:

1. The connection is not immediately reconnected
2. A delay is introduced before attempting reconnection
3. The delay increases with each failed attempt
4. After multiple failures, reconnection is suspended for a longer period

### Connection Suspended

If the connection enters the `SUSPENDED` state:

1. Polling fallback automatically activates
2. User interface shows appropriate messages
3. After the suspension period, connection attempts resume
4. Data will remain available, but updates may be delayed

## Best Practices

1. Always use the `useRefreshOnUpdate` hook for components needing real-time updates
2. Import Redis channels from the central constants file
3. Handle connection state changes in the UI
4. Provide fallback options when real-time updates are unavailable
5. Clean up listeners when components unmount

By following these guidelines, your components will gracefully handle Redis connection issues while maintaining a good user experience. 