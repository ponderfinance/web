/**
 * Utility for intelligent throttling of data refresh operations.
 * Helps prevent excessive refreshes while maintaining data freshness.
 */

// Map to track last refresh times by entity type
const lastRefreshTimes: Record<string, number> = {};

// Higher priority entities get refreshed more aggressively
type EntityPriority = 'high' | 'medium' | 'low';

// Default throttle times based on priority (in milliseconds)
const DEFAULT_THROTTLE_TIMES: Record<EntityPriority, number> = {
  high: 500,    // High priority (e.g., active token detail) refreshes most frequently
  medium: 1000,  // Medium priority (e.g., list views) refreshes moderately
  low: 3000     // Low priority (e.g., historical data) refreshes least frequently
};

/**
 * Determines if a refresh operation should proceed based on throttling rules
 * 
 * @param entityType Unique identifier for the entity being refreshed (e.g., 'token-detail', 'token-list')
 * @param priority Priority level for this entity type
 * @param customThrottleTime Optional custom throttle time to override defaults
 * @returns Boolean indicating whether refresh should proceed
 */
export function shouldRefresh(
  entityType: string,
  priority: EntityPriority = 'medium',
  customThrottleTime?: number
): boolean {
  const now = Date.now();
  const lastRefresh = lastRefreshTimes[entityType] || 0;
  const throttleTime = customThrottleTime || DEFAULT_THROTTLE_TIMES[priority];
  
  // Check if enough time has passed since last refresh
  if (now - lastRefresh > throttleTime) {
    // Update last refresh time
    lastRefreshTimes[entityType] = now;
    return true;
  }
  
  return false;
}

/**
 * Forces a refresh by resetting the last refresh time for an entity
 * 
 * @param entityType Unique identifier for the entity being refreshed
 */
export function forceNextRefresh(entityType: string): void {
  // Set last refresh time to a value that will allow immediate refresh
  lastRefreshTimes[entityType] = 0;
}

/**
 * Gets the remaining time until next possible refresh
 * 
 * @param entityType Unique identifier for the entity being refreshed
 * @param priority Priority level for this entity type
 * @param customThrottleTime Optional custom throttle time to override defaults
 * @returns Milliseconds remaining until refresh is allowed, or 0 if refresh is allowed now
 */
export function timeUntilRefresh(
  entityType: string,
  priority: EntityPriority = 'medium',
  customThrottleTime?: number
): number {
  const now = Date.now();
  const lastRefresh = lastRefreshTimes[entityType] || 0;
  const throttleTime = customThrottleTime || DEFAULT_THROTTLE_TIMES[priority];
  
  const remaining = throttleTime - (now - lastRefresh);
  return remaining > 0 ? remaining : 0;
} 