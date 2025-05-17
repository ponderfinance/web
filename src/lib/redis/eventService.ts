/**
 * Redis Event Service
 * 
 * Provides a client for real-time updates via SSE with automatic reconnection.
 * This is implemented as a singleton to ensure only one SSE connection exists.
 */

import { EventEmitter } from 'events';
import { REDIS_CHANNELS } from '@/src/constants/redis-channels';

// Connection states
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SUSPENDED = 'suspended'
}

// Connection events
export enum ConnectionEvent {
  CONNECTED = 'connection:connected',
  DISCONNECTED = 'connection:disconnected',
  ERROR = 'connection:error',
  SUSPENDED = 'connection:suspended'
}

// Re-export the channels for convenience
export { REDIS_CHANNELS };

// Global reference for the EventSource
declare global {
  interface Window {
    __eventSource?: EventSource;
    __REDIS_DEBUG?: boolean;
  }
}

/**
 * Redis events service singleton
 */
class EventService {
  // Singleton instance
  private static instance: EventService;
  
  // Core state
  private emitter = new EventEmitter();
  private state = ConnectionState.DISCONNECTED;
  private userCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private lastMessageTime = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeoutMs = 30000; // 30 seconds between heartbeats
  
  // Development mode helper
  private _lastEventTypeLogs: Record<string, number> = {};
  
  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {
    // Set higher limit for listeners to prevent memory leak warnings
    this.emitter.setMaxListeners(50);
    
    // Initialize heartbeat checker if in browser
    if (typeof window !== 'undefined') {
      this.startHeartbeatChecker();
    }
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }
  
  /**
   * Start a heartbeat checker that will detect stale connections
   */
  private startHeartbeatChecker(): void {
    // Clear any existing interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Start new interval
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      // If connected and no message received for 2x heartbeat interval, 
      // consider the connection stale and reconnect
      if (this.state === ConnectionState.CONNECTED && 
          this.lastMessageTime > 0 && 
          now - this.lastMessageTime > this.heartbeatTimeoutMs * 2) {
        // console.log(`[Events] No messages received for ${Math.round((now - this.lastMessageTime) / 1000)}s, reconnecting`);
        this.disconnect();
        this.connect();
      }
    }, this.heartbeatTimeoutMs);
  }
  
  /**
   * Register a component that uses real-time updates
   */
  public register(): void {
    this.userCount++;
    // console.log(`[Events] Component registered (total: ${this.userCount})`);
    
    // Connect if this is our first subscriber
    if (this.userCount === 1) {
      this.connect();
    }
  }
  
  /**
   * Unregister a component
   */
  public unregister(): boolean {
    this.userCount = Math.max(0, this.userCount - 1);
    // console.log(`[Events] Component unregistered (remaining: ${this.userCount})`);
    
    // If no more users and we have a connection, clean it up
    if (this.userCount === 0 && typeof window !== 'undefined' && window.__eventSource) {
      this.disconnect();
    }
    
    // Return whether this was the last user
    return this.userCount === 0;
  }
  
  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }
  
  /**
   * Connect to the SSE endpoint
   */
  private connect(): void {
    // Browser only
    if (typeof window === 'undefined') return;
    
    // Already connected
    if (this.state === ConnectionState.CONNECTED && window.__eventSource) {
      return;
    }
    
    // Too many failed attempts - go into suspended state
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // console.log('[Events] Too many failed attempts, suspending reconnection');
      this.updateState(ConnectionState.SUSPENDED);
      this.emitter.emit(ConnectionEvent.SUSPENDED, { timestamp: Date.now() });
      return;
    }
    
    // Update state
    this.updateState(ConnectionState.CONNECTING);
    this.reconnectAttempts++;
    
    try {
      // console.log(`[Events] Connecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      // Clean up existing connection if any
      this.disconnect();
      
      // Create new SSE connection
      const url = new URL('/api/graphql-subscription', window.location.origin);
      url.searchParams.append('t', Date.now().toString());
      window.__eventSource = new EventSource(url.toString());
      
      // Set up event handlers
      window.__eventSource.onopen = this.handleOpen.bind(this);
      window.__eventSource.onerror = this.handleError.bind(this);
      window.__eventSource.onmessage = this.handleMessage.bind(this);
      
      // Set a connection timeout
      setTimeout(() => {
        if (this.state === ConnectionState.CONNECTING) {
          // console.log('[Events] Connection timeout, retrying');
          this.handleError(new Error('Connection timeout'));
        }
      }, 15000);
      
    } catch (error) {
      console.error('[Events] Connection error:', error);
      this.handleError(error);
    }
  }
  
  /**
   * Update connection state and emit events
   */
  private updateState(newState: ConnectionState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      // console.log(`[Events] Connection state: ${oldState} → ${newState}`);
      
      // Reset reconnect attempts when connected
      if (newState === ConnectionState.CONNECTED) {
        this.reconnectAttempts = 0;
      }
    }
  }
  
  /**
   * Disconnect from SSE endpoint
   */
  private disconnect(): void {
    if (typeof window === 'undefined' || !window.__eventSource) return;
    
    try {
      window.__eventSource.close();
      delete window.__eventSource;
    } catch (error) {
      console.error('[Events] Error disconnecting:', error);
    }
  }
  
  /**
   * Handle successful connection
   */
  private handleOpen(): void {
    // console.log('[Events] Connection established');
    this.updateState(ConnectionState.CONNECTED);
    this.emitter.emit(ConnectionEvent.CONNECTED, { timestamp: Date.now() });
    this.lastMessageTime = Date.now();
    
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Handle incoming SSE message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Update last message time for heartbeat check
      this.lastMessageTime = Date.now();
      
      // Skip heartbeat messages
      if (event.data.trim() === 'heartbeat') {
        return;
      }
      
      // Handle potential empty or invalid messages
      if (!event.data || event.data.trim() === '') {
        console.warn('[Events] Received empty message, ignoring');
        return;
      }
      
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (jsonError) {
        console.error('[Events] Invalid JSON in message:', jsonError);
        console.log('[Events] Raw message data:', event.data);
        // Don't propagate parsing errors to prevent component crashes
        return;
      }
      
      // In development, log detailed info about the events (but not in production)
      if (process.env.NODE_ENV === 'development') {
        // Only log once per minute per event type to avoid console spam
        const now = Date.now();
        const eventType = data.type;
        const lastLogTimeForType = this._lastEventTypeLogs[eventType] || 0;
        
        if (now - lastLogTimeForType > 60000) { // Only log once per minute
          this._lastEventTypeLogs[eventType] = now;
          
          // Log with some details but not full payload
          const summary = {
            type: data.type,
            entityType: data.payload?.entityType || 'unknown',
            entityId: data.payload?.entityId || 'global',
            hasFields: data.payload ? Object.keys(data.payload).length : 0,
            timestamp: new Date().toISOString(),
          };
          
          // Not using console.log to avoid noise in console
          if (typeof window !== 'undefined' && window.__REDIS_DEBUG) {
            console.log('[Redis Event]', summary);
          }
        }
      }
      
      // Connected message is special
      if (data.type === 'connected') {
        // console.log('[Events] Connected to real-time updates server', data);
        this.updateState(ConnectionState.CONNECTED);
        this.emitter.emit(ConnectionEvent.CONNECTED, data);
        return;
      }
      
      // Error message is special - handle server-side errors properly
      if (data.type === 'error') {
        const errorMessage = data.message || 'Unknown server error';
        console.error('[Events] Server-side error:', errorMessage);
        
        // Emit the error event
        this.emitter.emit(ConnectionEvent.ERROR, { 
          error: errorMessage, 
          timestamp: Date.now(),
          recoverable: true
        });
        
        // Don't disconnect for recoverable errors
        if (data.reconnect === false) {
          // If server explicitly says not to reconnect
          this.updateState(ConnectionState.SUSPENDED);
          this.emitter.emit(ConnectionEvent.SUSPENDED, { timestamp: Date.now() });
        }
        
        return;
      }
      
      // Emit event if it has type and payload
      if (data.type && data.payload) {
        // Handle known types and validate payload before emitting
        try {
          this.emitter.emit(data.type, data.payload);
        } catch (emitError) {
          console.error(`[Events] Error emitting ${data.type} event:`, emitError);
        }
      }
    } catch (error) {
      console.error('[Events] Error processing message:', error);
      // Don't propagate this error to prevent crashes
    }
  }
  
  /**
   * Handle connection error
   */
  private handleError(error: any): void {
    // console.error('[Events] Connection error', error);
    
    // Update state
    const prevState = this.state;
    this.updateState(ConnectionState.DISCONNECTED);
    
    // Clean up connection
    if (typeof window !== 'undefined' && window.__eventSource) {
      try {
        window.__eventSource.close();
      } catch (closeError) {
        console.error('[Events] Error closing EventSource:', closeError);
      }
      delete window.__eventSource;
    }
    
    // Don't attempt to reconnect if suspended
    if (this.state === ConnectionState.SUSPENDED) {
      return;
    }
    
    // Emit error event
    this.emitter.emit(ConnectionEvent.ERROR, { 
      error: error?.message || 'Connection error', 
      timestamp: Date.now(),
      recoverable: this.reconnectAttempts < this.maxReconnectAttempts 
    });
    
    // Implement exponential backoff for reconnection
    const delay = Math.min(
      1000 * Math.pow(1.5, this.reconnectAttempts), 
      30000 // max 30 second delay
    );
    
    // console.log(`[Events] Will reconnect in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Schedule reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      if (this.userCount > 0) {
        this.connect();
      }
    }, delay);
  }
  
  /**
   * Subscribe to events
   */
  public on(channel: string, listener: (data: any) => void): void {
    this.emitter.on(channel, listener);
  }
  
  /**
   * Unsubscribe from events
   */
  public off(channel: string, listener: (data: any) => void): void {
    this.emitter.off(channel, listener);
  }
  
  /**
   * Get event emitter
   */
  public getEmitter(): EventEmitter {
    return this.emitter;
  }
}

// Create singleton instance
const eventService = EventService.getInstance();

// Public API functions
export function registerSubscriber(): void {
  eventService.register();
}

export function unregisterSubscriber(): boolean {
  return eventService.unregister();
}

export function getConnectionState(): ConnectionState {
  return eventService.getState();
}

export function getSubscriberEventEmitter(): EventEmitter {
  return eventService.getEmitter();
}

export function onMetricsUpdated(listener: (data: any) => void): void {
  eventService.on(REDIS_CHANNELS.METRICS_UPDATED, listener);
}

export function onPairUpdated(listener: (data: any) => void): void {
  eventService.on(REDIS_CHANNELS.PAIR_UPDATED, listener);
}

export function onTokenUpdated(listener: (data: any) => void): void {
  eventService.on(REDIS_CHANNELS.TOKEN_UPDATED, listener);
}

export function onTransactionUpdated(listener: (data: any) => void): void {
  eventService.on(REDIS_CHANNELS.TRANSACTION_UPDATED, listener);
}

export function getSubscriberClient(): EventService {
  return eventService;
}

// Backward compatibility functions
export function initStrictSubscriber(): EventEmitter {
  registerSubscriber();
  return getSubscriberEventEmitter();
}

export function closeSubscriber(): void {
  // This is a no-op in the new implementation - connection is managed automatically
}

export function getConnectionEventEmitter(): EventEmitter {
  return eventService.getEmitter();
} 