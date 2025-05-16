/**
 * Standardized Redis Channel Names
 * 
 * This file contains the standard channel names used across both 
 * the indexer and frontend applications.
 * 
 * DO NOT modify these values without updating the indexer counterpart.
 */

export const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated',
  TRANSACTION_UPDATED: 'transaction:updated'
};

// Export as default for ESM compatibility
export default REDIS_CHANNELS; 