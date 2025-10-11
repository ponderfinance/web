import { 
  Environment, 
  Network, 
  RecordSource, 
  Store, 
  Observable,
  FetchFunction,
  SubscribeFunction,
  RequestParameters,
  Variables,
  GraphQLResponse,
  RecordSourceProxy,
  RecordProxy
} from 'relay-runtime'

// Store updater registry for efficient updates
interface StoreUpdater {
  pattern: RegExp;
  updater: (store: RecordSourceProxy, data: any) => void;
}

// Registry of store updaters for different entity types
const storeUpdaters: StoreUpdater[] = [];

/**
 * Register a store updater for a specific query pattern
 * This helps optimize updates by making targeted changes instead of refetching
 */
export function registerStoreUpdater(
  pattern: RegExp,
  updater: (store: RecordSourceProxy, data: any) => void
): void {
  storeUpdaters.push({ pattern, updater });
}

/**
 * Apply store update for a specific entity type and data
 * Returns true if an updater was found and applied
 */
export function applyStoreUpdate(
  entityType: string,
  data: any,
  environment: Environment
): boolean {
  // See if we have a registered updater for this entity type
  const matchingUpdater = storeUpdaters.find(entry => entry.pattern.test(entityType));
  
  if (matchingUpdater) {
    // If we have an updater, use it to make targeted store changes
    environment.commitUpdate(store => {
      matchingUpdater.updater(store, data);
    });
    return true;
  }
  
  return false;
}

// Function to fetch query data from GraphQL API
const fetchQuery: FetchFunction = async (
  params: RequestParameters,
  variables: Variables
) => {
  // URL for our GraphQL API endpoint
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: params.text,
      variables,
    }),
  })

  // Get the response as JSON
  const json = await response.json()

  // GraphQL errors can be returned in successful responses, check for those
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    console.error('Error from GraphQL:', json.errors)
    throw new Error(
      `Error fetching GraphQL query '${params.name}' with variables ${JSON.stringify(
        variables
      )}: ${JSON.stringify(json.errors)}`
    )
  }

  return json
}

// Define message handler types
interface MessageHandler {
  matcher: (operationName: string | null | undefined, variables: Variables) => boolean;
  handler: (
    data: any, 
    environment: Environment | undefined, 
    request: RequestParameters, 
    variables: Variables, 
    sink: any
  ) => void;
}

// Registry of message handlers for different message types
const messageHandlerRegistry: Record<string, MessageHandler> = {
  'metrics:updated': {
    matcher: () => true, // Process all metrics updates
    handler: (data, environment, request, variables, sink) => {
      console.log(`Received metrics update for ${request.name}:`, data.payload);
      
      // Try direct store update first
      let updated = false;
      if (environment) {
        updated = applyStoreUpdate('global-metrics', data.payload, environment);
        if (updated) {
          console.log('Applied direct store update for global metrics');
        }
      }
      
      // Fall back to refetch if direct update failed or not possible
      if (!updated) {
        Observable.from(fetchQuery(request, variables, {}))
          .subscribe({
            next: (response) => {
              console.log(`Fetched updated data for ${request.name}`);
              sink.next(response);
            },
            error: (error: any) => {
              console.error(`Error fetching updated data:`, error);
              sink.error(error instanceof Error ? error : new Error(String(error)));
            }
          });
      }
    }
  },
  
  'pair:updated': {
    matcher: (operationName, variables) => {
      if (!operationName) return false;
      return operationName.toLowerCase().includes('pair') && 
        !!variables?.pairId;
    },
    handler: (data, environment, request, variables, sink) => {
      console.log(`Received pair update for ${request.name}:`, data.payload);
      
      // Try direct store update first
      let updated = false;
      if (environment && data.payload?.entityId) {
        updated = applyStoreUpdate(`pair-${data.payload.entityId}`, data.payload, environment);
        if (updated) {
          console.log(`Applied direct store update for pair ${data.payload.entityId}`);
        }
      }
      
      // Fall back to refetch if direct update failed
      if (!updated) {
        Observable.from(fetchQuery(request, variables, {}))
          .subscribe({
            next: (response) => sink.next(response),
            error: (error: any) => sink.error(error instanceof Error ? error : new Error(String(error)))
          });
      }
    }
  },
  
  'token:updated': {
    matcher: (operationName, variables) => {
      if (!operationName) return false;
      return operationName.toLowerCase().includes('token') && 
        (!!variables?.tokenId || !!variables?.tokenAddress);
    },
    handler: (data, environment, request, variables, sink) => {
      console.log(`Received token update for ${request.name}:`, data.payload);
      
      // Try direct store update first
      let updated = false;
      if (environment && data.payload?.entityId) {
        updated = applyStoreUpdate(`token-price-${data.payload.entityId}`, data.payload, environment);
        if (updated) {
          console.log(`Applied direct store update for token ${data.payload.entityId}`);
        }
      }
      
      // Fall back to refetch if direct update failed
      if (!updated) {
        Observable.from(fetchQuery(request, variables, {}))
          .subscribe({
            next: (response) => sink.next(response),
            error: (error: any) => sink.error(error instanceof Error ? error : new Error(String(error)))
          });
      }
    }
  },
  
  'transaction:updated': {
    matcher: (operationName) => {
      if (!operationName) return false;
      return operationName.toLowerCase().includes('transaction');
    },
    handler: (data, environment, request, variables, sink) => {
      // Extract the actual data payload, normalizing the structure of different message formats
      const payload = data.payload || data;
      console.log(`[Relay] Received transaction update for ${request.name}:`, payload);
      
      // The transaction ID might be in different places depending on source
      const entityId = payload.entityId || payload.transactionId;
      const txHash = payload.txHash;
      
      if (!entityId && !txHash) {
        console.error('[Relay] Transaction update missing entityId and txHash', payload);
        // Still fetch fresh data even if we can't do a targeted update
        fetchFreshData();
        return;
      }
      
      // Try store update first (when transaction updater is registered)
      let updated = false;
      if (environment && entityId) {
        console.log(`[Relay] Attempting to applyStoreUpdate for transaction-${entityId}`);
        updated = applyStoreUpdate(`transaction-${entityId}`, payload, environment);
        if (updated) {
          console.log(`[Relay] Applied direct store update for transaction ${entityId}`);
        } else {
          console.log(`[Relay] No direct store update for transaction ${entityId}`);
        }
      }
      
      // For transaction lists, we need special handling
      if (request.name?.toLowerCase().includes('transactionspage') ||
          request.name?.toLowerCase().includes('recenttransactions')) {
          
        if (environment) {
          try {
            // Force invalidation for the transaction connection to guarantee a refresh
            environment.commitUpdate(store => {
              // Find the root record
              const root = store.getRoot();
              
              // Get the transactions connection if it exists
              const transactionsConnection = root.getLinkedRecord('recentTransactions', variables);
              if (transactionsConnection) {
                // Force the connection to be refetched by touching a field
                transactionsConnection.setValue(
                  Date.now().toString(),
                  '__forceRefetch'
                );
                console.log('[Relay] Marked recentTransactions connection for refetch');
                // Also invalidate any existing edge to make sure it's refetched
                try {
                  const edges = transactionsConnection.getLinkedRecords('edges');
                  if (edges && edges.length > 0) {
                    // Mark the first edge for refetch to invalidate the connection
                    edges[0].setValue(Date.now().toString(), '__edgeRefetch');
                    console.log('[Relay] Marked first edge for refetch');
                  }
                } catch (edgeError) {
                  console.log('[Relay] No edges found, will rely on full refetch');
                }
              } else {
                console.log('[Relay] No transactions connection found, will do full refetch');
              }
            });
            
            // Call getStore().notify() to ensure components re-render
            environment.getStore().notify();
            console.log('[Relay] Called environment.getStore().notify() after marking for refetch');
          } catch (error) {
            console.error('[Relay] Error invalidating transaction store:', error);
          }
        }
      }
      
      // Helper function to fetch fresh data
      function fetchFreshData() {
        // Always fetch new data for transaction updates
        Observable.from(fetchQuery(request, variables, {}))
          .subscribe({
            next: (response) => {
              console.log(`[Relay] Fetched updated transaction data for ${request.name}`);
              sink.next(response);
            },
            error: (error: any) => {
              console.error(`[Relay] Error fetching updated transaction data:`, error);
              sink.error(error instanceof Error ? error : new Error(String(error)));
            }
          });
      }
      
      // Fetch fresh data after store updates
      fetchFreshData();
    }
  }
};

// Create a subscription handler using Server-Sent Events
const createSubscription: SubscribeFunction = (
  request: RequestParameters,
  variables: Variables
) => {
  return Observable.create<GraphQLResponse>(sink => {
    // Get operation name to be sent to the server
    const operationName = request.name;
    console.log(`Setting up subscription for operation: ${operationName}`, variables);

    // Create EventSource for SSE connection
    const eventSource = new EventSource(`/api/graphql-subscription`, {
      withCredentials: true,
    });

    // Send initial request with POST
    fetch('/api/graphql-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName,
        variables,
      }),
    }).catch(error => {
      console.error('Error sending subscription request:', error);
      sink.error(error instanceof Error ? error : new Error(String(error)));
    });

    // Handle connection open
    eventSource.onopen = () => {
      console.log(`Subscription connection opened for ${operationName}`);
    };

    // Handle incoming messages with improved handler system
    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        
        // Special case for system messages
        if (data.type === 'connected') {
          console.log(`SSE connection established for ${operationName}`);
          return;
        } else if (data.type === 'error') {
          sink.error(new Error(data.payload?.message || 'Unknown subscription error'));
          return;
        } else if (data.type === 'complete') {
          sink.complete();
          return;
        }
        
        // Get the handler from the registry
        const handlerConfig = messageHandlerRegistry[data.type];
        
        // Use the handler if available and matches the current operation
        if (handlerConfig && handlerConfig.matcher(operationName, variables)) {
          handlerConfig.handler(data, clientEnvironment, request, variables, sink);
        } else if (data.type === 'next') {
          // Legacy handling for older style messages
          Observable.from(fetchQuery(request, variables, {}))
            .subscribe({
              next: (response) => sink.next(response),
              error: (error: any) => sink.error(error instanceof Error ? error : new Error(String(error)))
            });
        } else {
          console.log(`No handler for message type: ${data.type} for operation: ${operationName}`);
        }
      } catch (error) {
        console.error(`Error processing subscription message for ${operationName}:`, error);
        // Don't terminate the subscription on a single message error
      }
    };

    // Handle errors
    eventSource.onerror = (error: Event) => {
      console.error(`Subscription error for ${operationName}:`, error);
      
      // Don't terminate the subscription on connection error
      // The browser will automatically try to reconnect
      
      // Only report the error, don't close the stream
      console.error('EventSource error, will try to reconnect automatically');
    };

    // Return cleanup function
    return () => {
      console.log(`Cleaning up subscription for ${operationName}`);
      eventSource.close();
    };
  });
};

// Create a network layer with fetch and subscribe functions
const network = Network.create(fetchQuery, createSubscription);

// Create a store to cache the data
const source = new RecordSource();
const store = new Store(source, {
  // Enable garbage collection to free up memory
  gcReleaseBufferSize: 10
});

let clientEnvironment: Environment | undefined;

export function createRelayEnvironment() {
  // For SSR, always create a new environment
  if (typeof window === 'undefined') return null;

  // Create the environment once for the client
  if (!clientEnvironment) {
    clientEnvironment = new Environment({
      network,
      store,
      isServer: false,
    });
  }

  return clientEnvironment;
}

// Register transaction list updater
export function registerTransactionListUpdater() {
  registerStoreUpdater(
    /^transaction-/,
    (store, data) => {
      try {
        // Get transaction ID from the data
        const transactionId = data.entityId || data.transactionId || data.txHash;
        if (!transactionId) return;
        
        // Find the root and connections
        const root = store.getRoot();
        const connectionsRecord = root.getLinkedRecord('recentTransactions');
        
        if (!connectionsRecord) {
          console.log('[Relay] No transactions connection found in store');
          return;
        }
        
        // Update specific transaction if it exists in the store
        const transactionRecord = store.get(transactionId);
        if (transactionRecord) {
          // Update all relevant fields if they exist in the data
          const fields = [
            'valueUSD', 'txHash', 'timestamp', 'userAddress',
            'token0', 'token1', 'amountIn0', 'amountIn1',
            'amountOut0', 'amountOut1', 'type', 'status',
            'blockNumber', 'gasUsed', 'gasPrice', 'feeUSD'
          ];
          fields.forEach(field => {
            if (data[field] !== undefined) {
              transactionRecord.setValue(data[field], field);
              console.log(`[Relay] Updated transaction ${transactionId} field ${field} in Relay store`);
            }
          });
        } else {
          // Transaction not in store yet, need to mark the connection for refetch
          console.log(`[Relay] Transaction ${transactionId} not found in store, marking connection for refetch`);
          
          // Mark the entire connection for refetch
          if (connectionsRecord) {
            // Get the edges array
            const edges = connectionsRecord.getLinkedRecords('edges');
            if (edges && edges.length > 0) {
              // Mark first edge to force refetch of the connection
              const firstEdge = edges[0];
              if (firstEdge) {
                // This doesn't actually change data, but marks the record as changed
                // which will trigger Relay to refetch the connection
                firstEdge.setValue(firstEdge.getValue('cursor'), 'cursor');
                console.log('[Relay] Marked first edge for refetch in updater');
              }
            }
          }
        }
      } catch (error) {
        console.error('[Relay] Error updating transaction in store:', error);
      }
    }
  );
}

// Example token price updater (can be registered from components)
export function registerTokenPriceUpdater() {
  registerStoreUpdater(
    /^token-price-/,
    (store, data) => {
      // Get token ID from the data
      const tokenId = data.entityId || data.tokenId;
      if (!tokenId) return;
      
      // Find the token record
      const tokenRecord = store.get(tokenId);
      if (!tokenRecord) return;
      
      // Update price fields
      if (data.priceUsd !== undefined) {
        tokenRecord.setValue(data.priceUsd, 'priceUsd');
      }
      
      // Handle price changes
      if (data.priceChange24h !== undefined) {
        tokenRecord.setValue(data.priceChange24h, 'priceChange24h');
      }
      
      if (data.priceChange1h !== undefined) {
        tokenRecord.setValue(data.priceChange1h, 'priceChange1h');
      }
      
      // Handle volume fields - handle both naming conventions
      if (data.volumeUsd24h !== undefined) {
        tokenRecord.setValue(data.volumeUsd24h, 'volumeUsd24h');
      } else if (data.volume24h !== undefined) {
        tokenRecord.setValue(data.volume24h, 'volumeUsd24h');
      }
      
      // Handle 1h volume
      if (data.volume1h !== undefined) {
        tokenRecord.setValue(data.volume1h, 'volume1h');
      }
      
      // Handle FDV (Fully Diluted Valuation)
      if (data.fdv !== undefined) {
        tokenRecord.setValue(data.fdv, 'fdv');
      }
      
      // Handle market cap if available
      if (data.marketCap !== undefined) {
        tokenRecord.setValue(data.marketCap, 'marketCap');
      }
      
      // Update timestamp to indicate when this data was last updated
      tokenRecord.setValue(Date.now(), '__lastUpdated');
      
      // console.log(`Updated token ${tokenId} price in Relay store without refetching`);
    }
  );
} 