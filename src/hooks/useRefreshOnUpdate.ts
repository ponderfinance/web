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
  shouldRefetch = false // Whether to force a refetch
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
  
  // Track when the entity was last updated
  useEffect(() => {
    let timestamp: number | null = null;
    
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
        break;
    }
    
    // Update the timestamp if it changed
    if (timestamp && (!lastUpdated || timestamp > lastUpdated)) {
      setLastUpdated(timestamp);
      
      const now = Date.now();
      // Only refresh if we haven't refreshed recently
      if (now - lastRefreshTimeRef.current > minRefreshInterval) {
        lastRefreshTimeRef.current = now;
        
        // Execute callback if provided
        if (onUpdate) {
          onUpdate();
        }
        
        // Force a refetch if requested
        if (shouldRefetch && environment) {
          // This is a simple way to trigger a refresh without a specific query
          // For more targeted refreshes, you might want to use environment.commitUpdate
          console.log(`Forcing refetch for ${entityType} ${entityId}`);
          environment.getStore().notify();
        }
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
    shouldRefetch
  ]);
  
  // Manual refresh function
  const refresh = useCallback(() => {
    if (shouldEntityRefresh(entityType, entityId, minRefreshInterval)) {
      if (onUpdate) {
        onUpdate();
      }
      
      if (shouldRefetch && environment) {
        environment.getStore().notify();
      }
      
      lastRefreshTimeRef.current = Date.now();
    }
  }, [entityType, entityId, environment, shouldRefetch, onUpdate, shouldEntityRefresh, minRefreshInterval]);
  
  return {
    refresh,
    lastUpdated
  };
} 