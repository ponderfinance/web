/**
 * Utility for intelligent throttling of data refresh operations.
 * Helps prevent excessive refreshes while maintaining data freshness.
 */

// Map to track last refresh times by entity type
const lastRefreshTimes: Record<string, number> = {};

// Track active refreshes to prevent concurrent operations
const activeRefreshes: Record<string, boolean> = {};

// Higher priority entities get refreshed more aggressively
type EntityPriority = 'high' | 'medium' | 'low';

// Default throttle times based on priority (in milliseconds)
const DEFAULT_THROTTLE_TIMES: Record<EntityPriority, number> = {
  high: 2000,    // High priority (e.g., active token detail) - 2 seconds minimum
  medium: 3000,  // Medium priority (e.g., list views) - 3 seconds minimum
  low: 5000     // Low priority (e.g., historical data) - 5 seconds minimum
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
  
  // Don't allow refresh if we already have an active refresh for this entity
  if (activeRefreshes[entityType]) {
    return false;
  }
  
  // Check if enough time has passed since last refresh
  if (now - lastRefresh > throttleTime) {
    // Update last refresh time
    lastRefreshTimes[entityType] = now;
    // Mark this entity as being refreshed
    activeRefreshes[entityType] = true;
    return true;
  }
  
  return false;
}

/**
 * Marks a refresh operation as complete
 * 
 * @param entityType Unique identifier for the entity that finished refreshing
 */
export function markRefreshComplete(entityType: string): void {
  // Remove from active refreshes
  activeRefreshes[entityType] = false;
}

/**
 * Forces a refresh by resetting the last refresh time for an entity
 * 
 * @param entityType Unique identifier for the entity being refreshed
 */
export function forceNextRefresh(entityType: string): void {
  // Set last refresh time to a value that will allow immediate refresh
  lastRefreshTimes[entityType] = 0;
  // Ensure it's not marked as actively refreshing
  activeRefreshes[entityType] = false;
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
  
  // If actively refreshing, return the throttle time
  if (activeRefreshes[entityType]) {
    return throttleTime;
  }
  
  const remaining = throttleTime - (now - lastRefresh);
  return remaining > 0 ? remaining : 0;
} 