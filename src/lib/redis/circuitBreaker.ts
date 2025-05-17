/**
 * Circuit Breaker Pattern for Redis
 * 
 * Prevents connection storms by tracking failures and temporarily
 * suspending connection attempts when the system appears unstable.
 */

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, don't try
  HALF_OPEN = 'half-open' // Testing if system has recovered
}

export class CircuitBreaker {
  private static instance: CircuitBreaker | null = null;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenTime: number = 0;
  private stateChangeListeners: ((state: CircuitState, reason: string) => void)[] = [];
  
  // Circuit configuration
  private failureThreshold: number = 5; // Number of failures before opening circuit
  private resetTimeout: number = 30000; // Time before trying again (30s)
  private halfOpenRetryInterval: number = 5000; // Time between half-open tests (5s)
  
  private constructor() {
    console.log('[CIRCUIT] Circuit breaker initialized in CLOSED state');
  }
  
  public static getInstance(): CircuitBreaker {
    if (!CircuitBreaker.instance) {
      CircuitBreaker.instance = new CircuitBreaker();
    }
    return CircuitBreaker.instance;
  }
  
  /**
   * Record a successful operation
   */
  public recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // If we have a success in half-open state, close the circuit
      this.changeState(CircuitState.CLOSED, 'Successful operation in half-open state');
    }
    
    // Reset failure count
    this.failureCount = 0;
  }
  
  /**
   * Record a failed operation
   */
  public recordFailure(error?: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    const errorMessage = error ? `: ${error.message}` : '';
    
    if (this.state === CircuitState.CLOSED && this.failureCount >= this.failureThreshold) {
      this.changeState(CircuitState.OPEN, `${this.failureCount} consecutive failures${errorMessage}`);
    } else if (this.state === CircuitState.HALF_OPEN) {
      // If we fail in half-open state, go back to open
      this.changeState(CircuitState.OPEN, `Failed test in half-open state${errorMessage}`);
    } else {
      console.log(`[CIRCUIT] Failure ${this.failureCount}/${this.failureThreshold} recorded${errorMessage}`);
    }
  }
  
  /**
   * Check if a request can be attempted
   */
  public canRequest(): boolean {
    const now = Date.now();
    
    // Always allow requests in closed state
    if (this.state === CircuitState.CLOSED) {
      return true;
    }
    
    // Check if we should move to half-open state
    if (this.state === CircuitState.OPEN && (now - this.lastFailureTime) > this.resetTimeout) {
      this.changeState(CircuitState.HALF_OPEN, 'Circuit breaker timeout elapsed');
      this.halfOpenTime = now;
      return true;
    }
    
    // In half-open state, only allow one test request every retry interval
    if (this.state === CircuitState.HALF_OPEN) {
      if (now - this.halfOpenTime > this.halfOpenRetryInterval) {
        this.halfOpenTime = now;
        console.log('[CIRCUIT] Allowing test request in half-open state');
        return true;
      }
      return false;
    }
    
    return false;
  }
  
  /**
   * Get the current circuit state
   */
  public getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Configure the circuit breaker
   */
  public configure(config: { 
    failureThreshold?: number, 
    resetTimeout?: number, 
    halfOpenRetryInterval?: number 
  }): void {
    if (config.failureThreshold !== undefined) this.failureThreshold = config.failureThreshold;
    if (config.resetTimeout !== undefined) this.resetTimeout = config.resetTimeout;
    if (config.halfOpenRetryInterval !== undefined) this.halfOpenRetryInterval = config.halfOpenRetryInterval;
    
    console.log(`[CIRCUIT] Configured: threshold=${this.failureThreshold}, resetTimeout=${this.resetTimeout}ms, retryInterval=${this.halfOpenRetryInterval}ms`);
  }
  
  /**
   * Add a listener for state changes
   */
  public onStateChange(listener: (state: CircuitState, reason: string) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Reset the circuit breaker state to CLOSED
   */
  public reset(): void {
    this.changeState(CircuitState.CLOSED, 'Manual reset');
    this.failureCount = 0;
  }
  
  private changeState(newState: CircuitState, reason: string): void {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    
    console.log(`[CIRCUIT] State changed: ${oldState} → ${newState} (${reason})`);
    
    // Notify all listeners
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(newState, reason);
      } catch (error) {
        console.error('[CIRCUIT] Error in state change listener:', error);
      }
    });
  }
}

// Export a singleton getter
export const getCircuitBreaker = (): CircuitBreaker => CircuitBreaker.getInstance(); 