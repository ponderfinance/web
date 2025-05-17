import { useCallback, useEffect, useState, useRef } from 'react';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
import { useRelayEnvironment } from 'react-relay';

type EntityType = 'token' | 'pair' | 'transaction' | 'metrics';

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
  const environment = useRelayEnvironment();
  const { 
    metricsLastUpdated, 
    tokenLastUpdated, 
    pairLastUpdated, 
    transactionLastUpdated,
    shouldEntityRefresh
  } = useRedisSubscriber();
  
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const consecutiveUpdatesRef = useRef<number>(0);
  
  // Track when the entity was last updated
  useEffect(() => {
    let timestamp: number | null = null;
    let hasSignificantChange = false;
    
    // Get the appropriate timestamp based on entity type
    switch (entityType) {
      case 'metrics':
        timestamp = metricsLastUpdated;
        break;
      case 'token':
        timestamp = tokenLastUpdated[entityId] || null;
        break;
      case 'pair':
        timestamp = pairLastUpdated[entityId] || null;
        break;
      case 'transaction':
        timestamp = transactionLastUpdated[entityId] || null;
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
        allTransactionUpdates: transactionLastUpdated
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
      
      // If we have rapid consecutive updates, be more aggressive
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
            consecutiveUpdates: consecutiveUpdatesRef.current
          });
        }
        
        lastRefreshTimeRef.current = now;
        
        // Execute callback if provided
        if (onUpdate) {
          onUpdate();
        }
        
        // Force a refetch if requested
        if (shouldRefetch && environment) {
          if (debug) {
            console.log(`[useRefreshOnUpdate] Forcing store invalidation for ${entityType} ${entityId}`);
          }
          
          // If it's a transaction or we've had multiple updates, do a more aggressive refresh
          if (entityType === 'transaction' || consecutiveUpdatesRef.current >= 3) {
            // For transactions, we need to be more aggressive with the store invalidation
            try {
              environment.getStore().notify();
            } catch (err) {
              console.error('Error invalidating store:', err);
            }
          }
        }
      } else if (debug) {
        console.log(`[useRefreshOnUpdate] Skipping refresh for ${entityType} ${entityId} (too soon)`, {
          timeSinceLastRefresh,
          effectiveMinInterval
        });
      }
    }
  }, [
    entityType, 
    entityId, 
    metricsLastUpdated, 
    tokenLastUpdated, 
    pairLastUpdated, 
    transactionLastUpdated,
    onUpdate,
    environment,
    lastUpdated,
    minRefreshInterval,
    shouldRefetch,
    debug
  ]);
  
  // Manual refresh function
  const refresh = useCallback(() => {
    if (shouldEntityRefresh(entityType, entityId, minRefreshInterval)) {
      if (debug) {
        console.log(`[useRefreshOnUpdate] Manual refresh for ${entityType} ${entityId}`);
      }
      
      if (onUpdate) {
        onUpdate();
      }
      
      if (shouldRefetch && environment) {
        environment.getStore().notify();
      }
      
      lastRefreshTimeRef.current = Date.now();
    }
  }, [entityType, entityId, environment, shouldRefetch, onUpdate, shouldEntityRefresh, minRefreshInterval, debug]);
  
  return {
    refresh,
    lastUpdated
  };
} 