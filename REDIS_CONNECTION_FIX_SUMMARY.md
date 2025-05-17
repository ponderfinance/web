# Redis Connection Fix Summary

## Overview

This document summarizes the changes made to resolve persistent Redis connection issues in the Ponder DEX application. The primary problems included ECONNRESET errors, connection storms, and inconsistent Redis channel declarations.

## Issues Addressed

1. **Connection Storms** - Multiple Redis instances were being created simultaneously, causing connection floods and ECONNRESET errors
2. **Duplicate Channel Definitions** - Redis channels were defined in multiple places
3. **Missing Error Handling** - ECONNRESET errors were not properly handled
4. **No Circuit Breaker** - The system would continuously try to reconnect even during outages
5. **Multiple Conflicting Implementations** - Several files attempted to implement Redis connections independently

## Solution Architecture

### 1. Universal Connection Manager

Created a universal connection manager in `src/config/redis.ts` that:
- Enforces a true singleton pattern with global references
- Provides proper error handling for ECONNRESET errors
- Implements connection debouncing to prevent connection storms
- Adds heartbeat detection to identify stale connections
- Provides proper cleanup on application shutdown

### 2. Centralized API

Unified the Redis API in `src/lib/redis/index.ts` to:
- Provide a single entry point for all Redis operations
- Bridge between different implementations for backward compatibility
- Export utility functions for building channel names consistently

### 3. Standardized Channel Definitions

Moved all channel definitions to `src/constants/redis-channels.ts` and:
- Ensured all files import from this central location
- Removed duplicate channel definitions
- Made channel naming consistent throughout the application

### 4. Error Handling Improvements

Added sophisticated error handling:
- Exponential backoff for reconnection attempts
- Circuit breaker pattern to prevent continuous reconnection during outages
- Local caching for fault tolerance
- UI feedback during connection issues

### 5. Optimized File Structure

Cleaned up the Redis-related files:
- Moved deprecated files to `old_files` directory
- Kept essential files with clean abstractions
- Added comprehensive documentation

## Implementation Details

### Connection Management

```typescript
// Global references ensure true singleton behavior
let __GLOBAL_REDIS_CLIENT: Redis | null = null;
let __GLOBAL_REDIS_SUBSCRIBER: Redis | null = null;

// Connection state tracking
let lastConnectionAttempt = 0;
let connectionRetryCount = 0;
```

### Error Handling

```typescript
// Special handling for ECONNRESET to avoid connection storms
if (err.message.includes('ECONNRESET')) {
  console.warn('[REDIS] ECONNRESET detected, controlled reconnect');
  
  // Add a delay to prevent connection storms
  setTimeout(() => {
    lastConnectionAttempt = 0; // Allow immediate retry after delay
  }, 2000 * (connectionRetryCount + 1));
  
  return false; // Don't immediately reconnect, use retry strategy
}
```

### Heartbeat Detection

```typescript
// Heartbeat to keep connection alive and detect issues early
const heartbeatInterval = setInterval(() => {
  if (redis.status === 'ready') {
    redis.ping()
      .then(() => {
        if (REDIS_CONFIG.debugMode) {
          console.log('[REDIS] Heartbeat ping successful');
        }
      })
      .catch(err => {
        console.error('[REDIS] Heartbeat ping failed:', err);
        
        // If connection fails heartbeat, force reconnection
        if (forSubscriber && __GLOBAL_REDIS_SUBSCRIBER === redis) {
          __GLOBAL_REDIS_SUBSCRIBER = null;
        } else if (!forSubscriber && __GLOBAL_REDIS_CLIENT === redis) {
          __GLOBAL_REDIS_CLIENT = null;
        }
      });
  }
}, REDIS_CONFIG.heartbeatIntervalMs);
```

## Results

The implementation addresses all identified issues:

1. ✅ Eliminated connection storms by enforcing a true singleton pattern
2. ✅ Standardized Redis channel definitions
3. ✅ Added proper handling of ECONNRESET errors
4. ✅ Implemented circuit breaker pattern for outages
5. ✅ Provided UI feedback during connection issues
6. ✅ Created a clean, well-documented API for Redis operations

## Usage Patterns

### Basic Operations

```typescript
import { getKey, setKey } from '@/src/lib/redis';

// Simple key-value operations
const value = await getKey('mykey');
await setKey('mykey', 'value', 3600); // With 1-hour TTL
```

### Real-Time Updates

```typescript
import { useRefreshOnUpdate } from '@/src/hooks/useRefreshOnUpdate';

// In React components
const { refresh, connectionState } = useRefreshOnUpdate({
  entityType: 'pair',
  entityId: pairId,
  onUpdate: () => refetchData()
});

// UI feedback for connection state
if (connectionState === 'suspended') {
  return <ConnectionIssueMessage />;
}
```

## Lessons Learned

1. **Singleton Pattern**: Maintain a single Redis connection instance to prevent connection storms
2. **Error Recovery**: Implement proper exponential backoff for failed connections
3. **Fallback Mechanisms**: Always provide alternative data fetching methods when real-time systems fail
4. **Status Feedback**: Keep users informed about the connection state
5. **Consistency**: Use a single source of truth for configuration and constants

These improvements have transformed the Redis integration from a point of instability to a robust system with proper error handling and recovery mechanisms.

## Build Fixes

In addition to the Redis connection improvements previously documented, we identified and fixed several issues that were preventing the application from building correctly:

### Null Safety for toLowerCase Operations

Several parts of the codebase were using the `toLowerCase()` string method on potentially undefined values, which caused build errors. We fixed these issues by:

1. Adding null checks to all toLowerCase() calls using optional chaining (`?.`) and providing fallbacks when values might be undefined
2. Particularly focusing on array map operations, which were the main source of the errors
3. Updating the dataloader implementation in both locations (`src/lib/dataloader.ts` and `src/lib/dataloader/index.ts`)

### Updated Helpers in dataloader.ts:

```typescript
// Before
const lowerCaseAddresses = addresses.map((a) => a.toLowerCase())

// After - Safe version
const lowerCaseAddresses = addresses.map((a) => a?.toLowerCase?.() || '')
```

### Updated resolvers.ts:

In resolvers.ts we fixed unsafe toLowerCase operations and array mapping functions. We also added a helper function to safely handle these operations:

```typescript
// Helper to safely handle toLowerCase operations on potentially undefined values
function safeToLowerCase(value: string | null | undefined): string {
  if (!value) return '';
  return value.toLowerCase();
}
```

### Added Proper NUll Check to Redis-related functions:

We also fixed Redis functions calls in the resolvers to properly match our new safer API, converting:

```typescript
// Before - unsafe version
await safeRedisGet(redis, cacheKey);

// After - safe version without passing redis directly
await safeRedisGet(cacheKey);
```

### Fixed Cache Manager Issues:

Previously, the CacheManager had several places where undefined variables like `keys` were being referenced, causing TypeScript errors. We fixed these by properly initializing keys in functions like `setBulk()`, `invalidateBulk()`, and `invalidateByPrefix()`.

These changes have successfully resolved the build issues while preserving the benefits of our new Redis connection architecture. 