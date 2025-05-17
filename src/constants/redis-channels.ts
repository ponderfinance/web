/**
 * Redis Channels
 * 
 * This file defines the Redis channels used for real-time updates.
 * Import this from any file that needs to use Redis channels to avoid
 * duplicate declarations.
 */

export const REDIS_CHANNELS = {
  METRICS_UPDATED: 'metrics:updated',
  PAIR_UPDATED: 'pair:updated',
  TOKEN_UPDATED: 'token:updated',
  TRANSACTION_UPDATED: 'transaction:updated'
};

// Export as default for ESM compatibility
export default REDIS_CHANNELS; 