import { useCallback, useEffect, useState, useRef } from 'react';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
import { getClientEnvironment } from '@/src/lib/relay/environment';
import { ConnectionState } from '@/src/lib/redis/eventService';

type EntityType = 'token' | 'pair' | 'transaction' | 'metrics';

// Define the subscriber context type
type RedisSubscriberContextType = {
  metricsLastUpdated: number | null;
  pairLastUpdated: Record<string, number>;
  tokenLastUpdated: Record<string, number>;
  transactionLastUpdated: Record<string, number>;
  refreshData: () => void;
  shouldEntityRefresh: (entityType: string, entityId: string, minInterval?: number) => boolean;
  connectionState: ConnectionState;
};

interface RefreshOnUpdateOptions {
  entityType: EntityType;
  entityId?: string;
  onUpdate?: () => void;
  minRefreshInterval?: number;
  shouldRefetch?: boolean;
  // Debug option is enabled by default for transaction entities
  debug?: boolean;
}

/**
 * Hook to handle refreshing data when real-time updates are received
 * 
 * This hook provides several strategies:
 * 1. Direct store updates (handled by the registry patterns)
 * 2. Callback-based updates (via onUpdate)
 * 3. Forced refetch via environment.retain
 * 
 * @param options Configuration options
 * @returns Object with refresh function and last update timestamp
 */
export function useRefreshOnUpdate({
  entityType,
  entityId = 'global',
  onUpdate,
  minRefreshInterval = 5000, // Default 5 seconds minimum between refreshes
  shouldRefetch = false, // Whether to force a refetch
  debug = entityType === 'transaction' // Default to true for transactions
}: RefreshOnUpdateOptions) {
  // Don't try to use Relay hooks directly - instead get the environment safely
  const environmentRef = useRef<any>(null);
  
  // Initialize the environment reference once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      environmentRef.current = getClientEnvironment();
      if (debug && environmentRef.current) {
        console.log('[useRefreshOnUpdate] Got Relay environment reference');
      }
    } catch (error) {
      if (debug) {
        console.warn('[useRefreshOnUpdate] Failed to get Relay environment', error);
      }
    }
  }, [debug]);
  
  // Use the Redis subscriber context to get updates and connection state
  const redisSubscriber = useRedisSubscriber();
  
  // Get connection state from subscriber
  const { connectionState } = redisSubscriber;
  
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const consecutiveUpdatesRef = useRef<number>(0);
  
  // Track when the entity was last updated
  useEffect(() => {
    // Skip if connection is suspended
    if (connectionState === ConnectionState.SUSPENDED) {
      if (debug) {
        console.log(`[useRefreshOnUpdate] Connection suspended - skipping updates for ${entityType}`);
      }
      return;
    }
    
    // Get the appropriate timestamp based on entity type
    let timestamp: number | null = null;
    let hasSignificantChange = false;
    
    switch (entityType) {
      case 'metrics':
        timestamp = redisSubscriber.metricsLastUpdated;
        break;
      case 'token':
        timestamp = redisSubscriber.tokenLastUpdated[entityId] || null;
        break;
      case 'pair':
        timestamp = redisSubscriber.pairLastUpdated[entityId] || null;
        break;
      case 'transaction':
        timestamp = redisSubscriber.transactionLastUpdated[entityId] || null;
        hasSignificantChange = true; // Transactions are always significant updates
        break;
    }
    
    // Log transaction updates for debugging
    if (debug && entityType === 'transaction' && timestamp && (!lastUpdated || timestamp > lastUpdated)) {
      console.log(`[useRefreshOnUpdate] Detected transaction update:`, {
        entityId,
        timestamp,
        lastUpdated,
        timeSinceLastUpdate: lastUpdated ? timestamp - lastUpdated : null,
        connectionState
      });
    }
    
    // Check if we have an update and it's newer than the last one we processed
    if (timestamp && (!lastUpdated || timestamp > lastUpdated)) {
      if (debug) {
        console.log(`[useRefreshOnUpdate] ${entityType} update detected at ${timestamp}`);
      }
      
      setLastUpdated(timestamp);
      
      // Check if enough time has passed since last refresh
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
      
      // For transactions, we use a different threshold
      const effectiveMinInterval = entityType === 'transaction' ? 1000 : minRefreshInterval;
      
      // Detect consecutive rapid updates (potential flurry of activity)
      if (timeSinceLastRefresh < 10000) { // 10 seconds threshold for consecutive updates
        consecutiveUpdatesRef.current++;
      } else {
        consecutiveUpdatesRef.current = 0;
      }
      
      // If we have rapid consecutive updates, be more aggressive with refreshing
      const shouldRefreshNow = 
        timeSinceLastRefresh > effectiveMinInterval || 
        hasSignificantChange || 
        consecutiveUpdatesRef.current >= 3;
      
      if (shouldRefreshNow) {
        if (debug) {
          console.log(`[useRefreshOnUpdate] Refreshing ${entityType} ${entityId}`, {
            timeSinceLastRefresh,
            effectiveMinInterval,
            hasSignificantChange,
            consecutiveUpdates: consecutiveUpdatesRef.current,
            connectionState
          });
        }
        
        lastRefreshTimeRef.current = now;
        
        // Execute callback if provided
        if (onUpdate) {
          onUpdate();
        }
        
        // Force a refetch if requested and environment is available
        if (shouldRefetch && environmentRef.current) {
          if (debug) {
            console.log(`[useRefreshOnUpdate] Forcing store invalidation for ${entityType} ${entityId}`);
          }
          
          // If it's a transaction or we've had multiple updates, do a more aggressive refresh
          if (entityType === 'transaction' || consecutiveUpdatesRef.current >= 3) {
            // For transactions, we need to be more aggressive with the store invalidation
            try {
              environmentRef.current.getStore().notify();
            } catch (err) {
              console.error('Error invalidating store:', err);
            }
          }
        }
      } else if (debug) {
        console.log(`[useRefreshOnUpdate] Skipping refresh for ${entityType} ${entityId} (too soon)`, {
          timeSinceLastRefresh,
          effectiveMinInterval,
          connectionState
        });
      }
    }
  }, [
    entityType, 
    entityId, 
    redisSubscriber.metricsLastUpdated, 
    redisSubscriber.tokenLastUpdated, 
    redisSubscriber.pairLastUpdated, 
    redisSubscriber.transactionLastUpdated,
    connectionState,
    onUpdate,
    lastUpdated,
    minRefreshInterval,
    shouldRefetch,
    debug,
    redisSubscriber
  ]);
  
  // Manual refresh function
  const refresh = useCallback(() => {
    // Skip if connection is suspended
    if (connectionState === ConnectionState.SUSPENDED) {
      console.log(`[useRefreshOnUpdate] Cannot refresh while connection is suspended`);
      return;
    }
    
    if (redisSubscriber.shouldEntityRefresh(entityType, entityId, minRefreshInterval)) {
      if (debug) {
        console.log(`[useRefreshOnUpdate] Manual refresh for ${entityType} ${entityId}`);
      }
      
      if (onUpdate) {
        onUpdate();
      }
      
      if (shouldRefetch && environmentRef.current) {
        try {
          environmentRef.current.getStore().notify();
        } catch (err) {
          console.error('Error invalidating store:', err);
        }
      }
      
      lastRefreshTimeRef.current = Date.now();
    }
  }, [
    entityType, 
    entityId, 
    shouldRefetch, 
    onUpdate, 
    redisSubscriber.shouldEntityRefresh, 
    minRefreshInterval, 
    debug, 
    connectionState
  ]);
  
  return {
    refresh,
    lastUpdated,
    connectionState
  };
} 