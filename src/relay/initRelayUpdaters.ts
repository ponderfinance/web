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
  
  console.log('All Relay store updaters registered successfully');
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
        
        // Update volume fields
        if (data.volumeUSD24h !== undefined) {
          pairRecord.setValue(data.volumeUSD24h, 'volumeUSD24h');
        }
        
        if (data.volumeToken0_24h !== undefined) {
          pairRecord.setValue(data.volumeToken0_24h, 'volumeToken0_24h');
        }
        
        if (data.volumeToken1_24h !== undefined) {
          pairRecord.setValue(data.volumeToken1_24h, 'volumeToken1_24h');
        }
        
        // Update price related fields
        if (data.token0Price !== undefined) {
          pairRecord.setValue(data.token0Price, 'token0Price');
        }
        
        if (data.token1Price !== undefined) {
          pairRecord.setValue(data.token1Price, 'token1Price');
        }
        
        if (data.priceChange24h !== undefined) {
          pairRecord.setValue(data.priceChange24h, 'priceChange24h');
        }
        
        console.log(`Updated pair ${pairId} in Relay store without refetching`);
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
        
        // Update metrics fields
        if (data.dailyVolumeUSD !== undefined) {
          metricsRecord.setValue(data.dailyVolumeUSD, 'dailyVolumeUSD');
        }
        
        if (data.totalValueLockedUSD !== undefined) {
          metricsRecord.setValue(data.totalValueLockedUSD, 'totalValueLockedUSD');
        }
        
        if (data.volume1hChange !== undefined) {
          metricsRecord.setValue(data.volume1hChange, 'volume1hChange');
        }
        
        if (data.volume24hChange !== undefined) {
          metricsRecord.setValue(data.volume24hChange, 'volume24hChange');
        }
        
        console.log('Updated protocol metrics in Relay store without refetching');
      } catch (error) {
        console.error('Error updating metrics in store:', error);
      }
    }
  );
} 