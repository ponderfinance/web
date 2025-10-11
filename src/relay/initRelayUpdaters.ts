import { 
  registerStoreUpdater, 
  registerTransactionListUpdater, 
  registerTokenPriceUpdater 
} from './createRelayEnvironment';

/**
 * Register all store updaters for the Relay environment
 * This function should be called once when the app initializes
 */
export function initializeRelayUpdaters() {
  // Register the transaction list updater
  registerTransactionListUpdater();
  
  // Register the token price updater
  registerTokenPriceUpdater();
  
  // Register pair updater
  registerPairUpdater();
  
  // Register metrics updater
  registerMetricsUpdater();
  
  // console.log('All Relay store updaters registered successfully');
}

/**
 * Register pair data updater for real-time updates
 */
function registerPairUpdater() {
  registerStoreUpdater(
    /^pair-/,
    (store, data) => {
      try {
        // Get pair ID from the data
        const pairId = data.entityId;
        if (!pairId) return;
        
        // Find the pair record
        const pairRecord = store.get(pairId);
        if (!pairRecord) return;
        
        // Update volume fields - handle both field naming conventions
        // volumeUsd24h is the Redis event field, volume24h is the GraphQL field
        if (data.volumeUsd24h !== undefined) {
          pairRecord.setValue(data.volumeUsd24h, 'volume24h');
        } else if (data.volume24h !== undefined) {
          pairRecord.setValue(data.volume24h, 'volume24h');
        }
        
        // Handle volume change
        if (data.volumeChange24h !== undefined) {
          pairRecord.setValue(data.volumeChange24h, 'volumeChange24h');
        }
        
        // Handle TVL/reserves with both naming conventions
        if (data.reserveUsd !== undefined) {
          pairRecord.setValue(data.reserveUsd, 'reserveUsd');
          // Also update tvl field if it exists in the record
          if (pairRecord.getType() === 'Pair') {
            pairRecord.setValue(data.reserveUsd, 'tvl');
          }
        }
        
        if (data.tvl !== undefined) {
          pairRecord.setValue(data.tvl, 'tvl');
          // Also update reserveUsd if it exists
          if (pairRecord.getType() === 'Pair') {
            pairRecord.setValue(data.tvl, 'reserveUsd');
          }
        }
        
        // Update reserve values
        if (data.reserve0 !== undefined) {
          pairRecord.setValue(data.reserve0, 'reserve0');
        }
        
        if (data.reserve1 !== undefined) {
          pairRecord.setValue(data.reserve1, 'reserve1');
        }
        
        // Handle APR fields
        if (data.poolApr !== undefined) {
          pairRecord.setValue(data.poolApr, 'poolApr');
        }
        
        if (data.rewardApr !== undefined) {
          pairRecord.setValue(data.rewardApr, 'rewardApr');
        }
        
        // Add last updated timestamp
        pairRecord.setValue(Date.now(), '__lastUpdated');
      } catch (error) {
        console.error('Error updating pair in store:', error);
      }
    }
  );
}

/**
 * Register global metrics updater for real-time updates
 */
function registerMetricsUpdater() {
  registerStoreUpdater(
    /^global-metrics$/,
    (store, data) => {
      try {
        // Get the root record
        const root = store.getRoot();
        
        // Find the protocolMetrics record
        const metricsRecord = root.getLinkedRecord('protocolMetrics');
        if (!metricsRecord) {
          console.log('No protocol metrics record found in store');
          return;
        }
        
        // Update metrics fields - handle main metrics
        if (data.dailyVolumeUsd !== undefined) {
          metricsRecord.setValue(data.dailyVolumeUsd, 'dailyVolumeUsd');
        }
        
        if (data.totalValueLockedUsd !== undefined) {
          metricsRecord.setValue(data.totalValueLockedUsd, 'totalValueLockedUsd');
        }
        
        // Handle volume change percentages
        if (data.volume1hChange !== undefined) {
          metricsRecord.setValue(data.volume1hChange, 'volume1hChange');
        }
        
        if (data.volume24hChange !== undefined) {
          metricsRecord.setValue(data.volume24hChange, 'volume24hChange');
        }
        
        // Handle weekly volume with different possible field names
        if (data.weeklyVolumeUsd !== undefined) {
          metricsRecord.setValue(data.weeklyVolumeUsd, 'weeklyVolumeUsd');
        } else if (data.volume7d !== undefined) {
          metricsRecord.setValue(data.volume7d, 'weeklyVolumeUsd');
        }
        
        // Handle additional metrics if they exist
        if (data.txCount !== undefined) {
          metricsRecord.setValue(data.txCount, 'txCount');
        }
        
        if (data.pairCount !== undefined) {
          metricsRecord.setValue(data.pairCount, 'pairCount');
        }
        
        if (data.tokenCount !== undefined) {
          metricsRecord.setValue(data.tokenCount, 'tokenCount');
        }
        
        // Add last updated timestamp
        metricsRecord.setValue(Date.now(), '__lastUpdated');
      } catch (error) {
        console.error('Error updating metrics in store:', error);
      }
    }
  );
} 