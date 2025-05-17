/**
 * Redis Types
 * 
 * This file contains type definitions for Redis-related functionality.
 * These types are available globally in the application.
 */

// Redis channels used for real-time updates
declare type RedisChannels = {
  METRICS_UPDATED: string;
  PAIR_UPDATED: string;
  TOKEN_UPDATED: string;
  TRANSACTION_UPDATED: string;
};

// Connection states for Redis clients
declare enum RedisConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SUSPENDED = 'suspended'
}

// Connection events emitted by Redis clients
declare enum RedisConnectionEvent {
  CONNECTED = 'connection:connected',
  DISCONNECTED = 'connection:disconnected',
  ERROR = 'connection:error',
  SUSPENDED = 'connection:suspended'
}

// Redis configuration options
declare type RedisConfig = {
  maxRetriesPerRequest: number;
  retryTimeoutMs: number;
  connectTimeoutMs: number;
  keepAliveMs: number;
  maxSuspensionTimeMs: number;
  maxRetryAttempts: number;
  heartbeatIntervalMs: number;
  initialRetryDelayMs: number;
  maxRetryDelayMs: number;
  backoffFactor: number;
}; 